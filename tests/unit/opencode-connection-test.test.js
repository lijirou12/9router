import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderConnectionById: vi.fn(),
  updateProviderConnection: vi.fn(),
  refreshGeneratedSession: vi.fn(),
  getLatestGeneratedSession: vi.fn(),
  resolveConnectionProxyConfig: vi.fn(),
  testProxyUrl: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnectionById: mocks.getProviderConnectionById,
  updateProviderConnection: mocks.updateProviderConnection,
}));
vi.mock("@/lib/network/connectionProxy", () => ({ resolveConnectionProxyConfig: mocks.resolveConnectionProxyConfig }));
vi.mock("@/lib/network/proxyTest", () => ({ testProxyUrl: mocks.testProxyUrl }));
vi.mock("open-sse/executors/opencode.js", () => ({
  refreshGeneratedSession: mocks.refreshGeneratedSession,
  getLatestGeneratedSession: mocks.getLatestGeneratedSession,
}));
const originalFetch = global.fetch;

describe("OpenCode Free connection test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mocks.fetchMock;
    mocks.getProviderConnectionById.mockResolvedValue({ id: "conn-oc", provider: "opencode", authType: "apikey" });
    mocks.getLatestGeneratedSession.mockReturnValue("ses_eca12f584ffeDHZWQFX2jTz4OC");
    mocks.refreshGeneratedSession.mockReturnValue("ses_eca12f584ffeDHZWQFX2jTz4OC");
    mocks.resolveConnectionProxyConfig.mockResolvedValue({ connectionProxyEnabled: false });
    mocks.fetchMock.mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"content":"pong"}}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { "content-type": "text/event-stream" } },
    ));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends the refreshed in-memory session to inference and only passes on pong", async () => {
    const { testSingleConnection } = await import("../../src/app/api/providers/[id]/test/testUtils.js");
    const result = await testSingleConnection("conn-oc");
    const [url, options] = mocks.fetchMock.mock.calls[0];

    expect(url).toBe("https://opencode.ai/inference/openai/v1/chat/completions");
    expect(options.headers["x-opencode-session"]).toBe("ses_eca12f584ffeDHZWQFX2jTz4OC");
    expect(options.headers["x-opencode-client"]).toBe("desktop");
    const sentBody = JSON.parse(options.body);
    expect(sentBody.model).toBe("space-bunny-free");
    expect(sentBody.tool_choice).toBe("none");
    expect(sentBody.tools.map((tool) => tool.function.name)).toEqual(["bash", "read"]);
    expect(options.headers["User-Agent"]).toBe("opencode/1.19.0");
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("returns the upstream FreeTierError instead of treating models-list access as success", async () => {
    mocks.fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ type: "error", error: { type: "FreeTierError", message: "official client only" } }),
      { status: 403, headers: { "content-type": "application/json" } },
    ));
    const { testSingleConnection } = await import("../../src/app/api/providers/[id]/test/testUtils.js");
    const result = await testSingleConnection("conn-oc");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("FreeTierError");
  });
});
