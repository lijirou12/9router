"use client";

import { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { Card, Badge } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

// Mirrors the server-side gate in /api/providers/[id]/overrides — client check is UX only
const BLOCKED_HEADERS = ["host", "content-length", "content-type", "connection", "transfer-encoding", "authorization", "cookie"];
const HEADER_NAME_RE = /^[A-Za-z0-9-]+$/;

export default function CustomConfigCard({ providerId }) {
  const notify = useNotificationStore();
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState([{ name: "", value: "" }]);
  const [builtin, setBuiltin] = useState({});
  const [dynamicHeaders, setDynamicHeaders] = useState({});
  const [hasOverride, setHasOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadHeaders = useCallback(async () => {
    const res = await fetch(`/api/providers/${providerId}/overrides`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const builtinHeaders = data.builtinHeaders || {};
    const effective = { ...builtinHeaders, ...(data.headers || {}) };
    const dynamic = data.dynamicHeaders || {};
    setDynamicHeaders(dynamic);
    for (const name of Object.keys(dynamic)) {
      for (const key of Object.keys(effective)) {
        if (key.toLowerCase() === name.toLowerCase()) delete effective[key];
      }
    }
    const headerRows = Object.entries(effective).map(([name, value]) => ({ name, value }));
    setBuiltin(builtinHeaders);
    setRows(headerRows.length ? headerRows : [{ name: "", value: "" }]);
    setHasOverride(Object.keys(data.headers || {}).length > 0);
    setLoaded(true);
  }, [providerId]);

  const setRow = (i, field, value) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const save = useCallback(async () => {
    // Diff-on-save: only rows differing from the registry default become overrides,
    // so a code-side registry bump still wins for everything the user left alone.
    const headers = {};
    for (const r of rows.filter((r) => r.name.trim())) {
      const name = r.name.trim();
      if (!HEADER_NAME_RE.test(name)) {
        notify.error(`Invalid header name: ${name}`);
        return;
      }
      if (BLOCKED_HEADERS.includes(name.toLowerCase())) {
        notify.error(`Header ${name} cannot be overridden`);
        return;
      }
      if (name in headers) {
        notify.error(`Duplicate header name: ${name}`);
        return;
      }
      if (r.value !== builtin[name]) headers[name] = r.value;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/providers/${providerId}/overrides`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify.error(err.error || "Failed to save");
        return;
      }
      setHasOverride(Object.keys(headers).length > 0);
      notify.success("Custom headers saved");
    } finally {
      setSaving(false);
    }
  }, [rows, builtin, providerId, notify]);

  const resetToBuiltin = () => {
    setRows(Object.entries(builtin).map(([name, value]) => ({ name, value })));
  };

  return (
    <Card padding="xs">
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
          if (!loaded) loadHeaders().catch(() => {});
        }}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
          <span className="text-sm font-semibold">Custom Headers</span>
          {hasOverride && (
            <Badge variant="success" size="sm">Active</Badge>
          )}
        </div>
        <span className="material-symbols-outlined text-text-muted">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex flex-col gap-2">
            {!loaded && <span className="text-xs text-text-muted">Loading headers…</span>}
            {Object.entries(dynamicHeaders).map(([name, dynamic]) => (
              <div key={`dynamic-${name}`} className="flex items-center gap-2">
                <input
                  value={name}
                  readOnly
                  aria-label={`${name} header name`}
                  className="w-44 rounded-md border border-border bg-background px-2 py-1.5 text-sm opacity-80"
                />
                <input
                  value={dynamic?.value || "Waiting for first OpenCode Free request"}
                  readOnly
                  aria-label={`${name} automatically generated value`}
                  title={dynamic?.description || "Generated automatically"}
                  className="min-w-0 flex-1 rounded-md border border-dashed border-primary/50 bg-background px-2 py-1.5 text-sm text-text-muted"
                />
                <button
                  type="button"
                  title="Refresh generated session value"
                  onClick={() => loadHeaders().catch(() => {})}
                  className="shrink-0 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                >
                  Refresh
                </button>
              </div>
            ))}
            {rows.map((row, i) => {
              const overridden = row.name.trim() in builtin && row.value !== builtin[row.name.trim()];
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => setRow(i, "name", e.target.value)}
                    placeholder="Header-Name"
                    spellCheck={false}
                    className="w-44 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                  <input
                    value={row.value}
                    onChange={(e) => setRow(i, "value", e.target.value)}
                    placeholder="Value"
                    spellCheck={false}
                    title={overridden ? "Overridden" : row.name.trim() in builtin ? "Registry default" : ""}
                    className={`min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none ${
                      overridden ? "border-amber-400/60" : "border-border"
                    }`}
                  />
                  <button
                    type="button"
                    title="Remove header"
                    onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [{ name: "", value: "" }]))}
                    className="shrink-0 text-text-muted hover:text-red-500"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { name: "", value: "" }])}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add header
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={resetToBuiltin}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/[0.03] disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

CustomConfigCard.propTypes = {
  providerId: PropTypes.string.isRequired,
};
