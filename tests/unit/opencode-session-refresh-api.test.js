import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn().mockResolvedValue({ providerOverrides: {} }),
  updateSettings: vi.fn(),
  refreshGeneratedSession: vi.fn(() => "ses_eca12f584ffeDHZWQFX2jTz4OC"),
  getLatestGeneratedSession: vi.fn(() => "ses_eca12f584ffeDHZWQFX2jTz4OC"),
}));

vi.mock("@/lib/localDb", () => ({ getSettings: mocks.getSettings, updateSettings: mocks.updateSettings }));
vi.mock("open-sse/executors/opencode.js", () => ({
  refreshGeneratedSession: mocks.refreshGeneratedSession,
  getLatestGeneratedSession: mocks.getLatestGeneratedSession,
}));

describe("OpenCode session refresh API", () => {
  it("creates a new session on refresh and exposes the active session on read", async () => {
    const { POST, GET } = await import("../../src/app/api/providers/[id]/overrides/route.js");
    const post = await POST(new Request("http://localhost/api/providers/opencode/overrides", { method: "POST" }), {
      params: Promise.resolve({ id: "opencode" }),
    });
    expect(await post.json()).toEqual({ sessionId: "ses_eca12f584ffeDHZWQFX2jTz4OC" });
    expect(mocks.refreshGeneratedSession).toHaveBeenCalledOnce();

    const get = await GET(new Request("http://localhost/api/providers/opencode/overrides"), {
      params: Promise.resolve({ id: "opencode" }),
    });
    const body = await get.json();
    expect(body.dynamicHeaders["x-opencode-session"].value).toBe("ses_eca12f584ffeDHZWQFX2jTz4OC");
  });
});
