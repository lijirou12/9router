import { OpenCodeExecutor } from "./opencode.js";
import { PROVIDERS } from "../config/providers.js";
import { isMuseSparkModel } from "../providers/models/helpers.js";

// The parent executor implements PR #4842's v2 free-tier contract. This alias
// preserves an independently selectable `ocl` provider with the same contract.
const INFERENCE_BASE = "https://opencode.ai";

export class OpenCodeLocalExecutor extends OpenCodeExecutor {
  constructor() {
    super();
    this.provider = "opencode-local";
    if (PROVIDERS["opencode-local"]) this.config = PROVIDERS["opencode-local"];
  }

  buildUrl(model) {
    if (isMuseSparkModel(model)) return `${INFERENCE_BASE}/inference/v1/responses`;
    return `${INFERENCE_BASE}/inference/v1/chat/completions`;
  }
}

export default OpenCodeLocalExecutor;
