import { describe, expect, it } from "vitest";
import REGISTRY from "../../open-sse/providers/registry/index.js";

describe("OpenCode providers disabled by upstream free-tier restrictions", () => {
  it("disables only unauthenticated OpenCode Free while retaining keyed routes", () => {
    expect(REGISTRY.find((provider) => provider.id === "opencode")?.disabled).toBe(true);
    expect(REGISTRY.find((provider) => provider.id === "opencode-zen")?.disabled).toBeUndefined();
    expect(REGISTRY.find((provider) => provider.id === "opencode-go")?.disabled).toBeUndefined();
  });
});
