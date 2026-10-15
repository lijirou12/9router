export default {
  id: "opencode-local",
  priority: 41,
  hasFree: true,
  alias: "ocl",
  aliases: [
    "ocl",
  ],
  uiAlias: "ocl",
  display: {
    name: "OpenCode Local",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OL",
  },
  category: "free",
  noAuth: true,
  transport: {
    baseUrl: "https://opencode.ai",
    headers: {
      "x-opencode-client": "cli",
    },
    forceStream: true,
    noAuth: true,
    quirks: {
      forceAutoToolChoiceModels: ["muse-spark-1.3-contributor-free"],
    },
  },
  transports: [
    { format: "openai", baseUrl: "https://opencode.ai/inference/v1/chat/completions", auth: { combined: true, header: "Authorization", scheme: "bearer" } },
    { format: "openai-responses", baseUrl: "https://opencode.ai/inference/v1/responses", auth: { combined: true, header: "Authorization", scheme: "bearer" } },
  ],
  models: [
    // Muse Spark models require OpenAI Responses protocol on the v2 inference lane.
    { id: "muse-spark-1.2-contributor-free", name: "Muse Spark 1.2 Contributor Free", targetFormat: "openai-responses", supportedFormats: ["openai-responses"] },
    { id: "muse-spark-1.3-contributor-free", name: "Muse Spark 1.3 Contributor Free", targetFormat: "openai-responses", supportedFormats: ["openai-responses"] },
    { id: "muse-spark-1.2-free", name: "Muse Spark 1.2 Free", targetFormat: "openai-responses", supportedFormats: ["openai-responses"] },
    { id: "muse-spark-1.3-free", name: "Muse Spark 1.3 Free", targetFormat: "openai-responses", supportedFormats: ["openai-responses"] },
    { id: "space-bunny-free", name: "Space Bunny Free", supportedFormats: ["openai"] },
    { id: "big-pickle", name: "Big Pickle", supportedFormats: ["openai"] },
    { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free", supportedFormats: ["openai"] },
    { id: "mimo-v2.6-flash-free", name: "MiMo V2.6 Flash Free", supportedFormats: ["openai"] },
    { id: "ling-3.1-flash-free", name: "Ling 3.1 Flash Free", supportedFormats: ["openai"] },
    { id: "cat-jam-free", name: "Cat Jam Free", supportedFormats: ["openai"] },
    { id: "nemotron-3.5-lightning-free", name: "Nemotron 3.5 Lightning Free", supportedFormats: ["openai"] },
    { id: "step-5-preview-free", name: "Step 5 Preview Free", supportedFormats: ["openai"] },
    { id: "longcat-2.5-preview-free", name: "LongCat 2.5 Preview Free", supportedFormats: ["openai"] },
  ],
  modelsFetcher: { url: "https://opencode.ai/zen/v1/models", type: "opencode-free" },
  passthroughModels: true,
};
