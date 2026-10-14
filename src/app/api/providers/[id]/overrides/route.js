import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { PROVIDERS } from "open-sse/config/providers.js";
import { resolveProviderAlias } from "open-sse/services/model.js";
import { getLatestGeneratedSession } from "open-sse/executors/opencode.js";

export const dynamic = "force-dynamic";

// Validation at the trust boundary — the UI also validates, but this is the gate.
const MAX_HEADERS = 20;
const MAX_HEADER_VALUE_LENGTH = 8192;
// RFC 7230 token subset: letters, digits, hyphen (no spaces, no unicode)
const HEADER_NAME_RE = /^[A-Za-z0-9-]+$/;
// Request-structure / auth headers a user override must never touch
const BLOCKED_HEADERS = new Set([
  "host",
  "content-length",
  "content-type",
  "connection",
  "transfer-encoding",
  "authorization",
  "cookie",
  // Generated per request by the OpenCode executor; a saved static override
  // would break session reuse and free-tier fingerprinting.
  "x-opencode-session",
]);

function containsHeader(headers, target) {
  return headers && typeof headers === "object" && Object.keys(headers).some((name) => name.toLowerCase() === target);
}

/**
 * Validate + normalize an override payload. Returns { override } or { error }.
 * An override with no headers is normalized to null (= delete).
 */
function normalizeOverride({ headers }) {
  const out = {};

  if (headers !== undefined && headers !== null) {
    if (typeof headers !== "object" || Array.isArray(headers)) {
      return { error: "headers must be an object" };
    }
    const entries = Object.entries(headers).filter(([, v]) => v !== "" && v != null);
    if (entries.length > MAX_HEADERS) {
      return { error: `Too many headers (max ${MAX_HEADERS})` };
    }
    const clean = {};
    for (const [name, value] of entries) {
      if (!HEADER_NAME_RE.test(name)) {
        return { error: `Invalid header name: ${name}` };
      }
      if (typeof value !== "string" || /[\r\n]/.test(value)) {
        return { error: `Invalid value for header ${name}` };
      }
      if (value.length > MAX_HEADER_VALUE_LENGTH) {
        return { error: `Header ${name} value too long (max ${MAX_HEADER_VALUE_LENGTH})` };
      }
      if (BLOCKED_HEADERS.has(name.toLowerCase())) {
        return { error: `Header ${name} cannot be overridden` };
      }
      clean[name] = value;
    }
    if (Object.keys(clean).length) out.headers = clean;
  }

  return { override: Object.keys(out).length ? out : null };
}

async function readOverrides() {
  const settings = await getSettings();
  return settings.providerOverrides || {};
}

/**
 * GET /api/providers/[id]/overrides — user override for this provider
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    // URL may use an alias (gcli, cc…) — key everything by canonical registry id
    const canonical = resolveProviderAlias(id);
    const allOverrides = await readOverrides();
    const override = allOverrides[canonical] || {};
    const overrideHeaders = { ...(override.headers || {}) };
    // Older versions allowed a static session override. Remove it from the
    // effective configuration so the generated per-request value always wins.
    if (canonical === "opencode") {
      let removed = false;
      for (const name of Object.keys(overrideHeaders)) {
        if (name.toLowerCase() === "x-opencode-session") {
          delete overrideHeaders[name];
          removed = true;
        }
      }
      if (removed) {
        const next = { ...allOverrides };
        if (Object.keys(overrideHeaders).length) next[canonical] = { ...override, headers: overrideHeaders };
        else delete next[canonical];
        await updateSettings({ providerOverrides: next });
      }
    }
    // Built-in headers come straight from the registry transport — single source of
    // truth, so the UI pre-fills exactly what this provider sends upstream.
    return NextResponse.json({
      headers: overrideHeaders,
      builtinHeaders: PROVIDERS[canonical]?.headers || {},
      dynamicHeaders: canonical === "opencode" ? {
        "x-opencode-session": {
          value: getLatestGeneratedSession(),
          description: "Latest x-opencode-session used upstream by OpenCode Free",
        },
      } : {},
    });
  } catch (error) {
    console.log("Error getting provider overrides:", error);
    return NextResponse.json({ error: "Failed to get overrides" }, { status: 500 });
  }
}

/**
 * PUT /api/providers/[id]/overrides — body: { headers: {name: value} }
 * Empty payload clears the override.
 */
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const canonical = resolveProviderAlias(id);
    const body = await request.json().catch(() => ({}));
    if (canonical === "opencode" && containsHeader(body.headers, "x-opencode-session")) {
      return NextResponse.json({ error: "x-opencode-session is generated automatically for OpenCode Free and cannot be overridden." }, { status: 400 });
    }
    const { override, error } = normalizeOverride(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const current = await readOverrides();
    const next = { ...current };
    if (override) {
      if (canonical === "opencode") {
        const headers = { ...(override.headers || {}) };
        for (const name of Object.keys(headers)) {
          if (name.toLowerCase() === "x-opencode-session") delete headers[name];
        }
        override.headers = headers;
        if (Object.keys(headers).length === 0) delete override.headers;
      }
      next[canonical] = override;
    }
    else delete next[canonical];
    await updateSettings({ providerOverrides: next });
    return NextResponse.json({ headers: override?.headers || {} });
  } catch (error) {
    console.log("Error saving provider overrides:", error);
    return NextResponse.json({ error: "Failed to save overrides" }, { status: 500 });
  }
}
