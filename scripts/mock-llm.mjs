/**
 * Local OpenAI-compatible MOCK endpoint for end-to-end agent verification.
 * It speaks streamed chat-completions with REAL function/tool calling so you
 * can watch Prism's full pipeline (AI SDK streamText → tools → canvas ops)
 * without a paid key. It is a test double for the *provider wire protocol* —
 * Prism itself never fakes AI; point it at any real provider for real models.
 *
 * Usage: node scripts/mock-llm.mjs   (listens on :11499)
 * Then in Prism: Settings → Custom (OpenAI-compatible) → Base URL
 * http://localhost:11499/v1 → Save → run the agent with model "prism-mock".
 */
import http from "node:http";

const PORT = 11499;
let callSeq = 0;

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}
function chunk(delta, finishReason = null) {
  return { id: "chatcmpl-mock", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "prism-mock", choices: [{ index: 0, delta, finish_reason: finishReason }] };
}
function toolCallChunks(name, args) {
  const id = `call_${++callSeq}`;
  return [
    chunk({ role: "assistant", tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: "" } }] }),
    chunk({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args) } }] }),
    chunk({}, "tool_calls"),
  ];
}
function textChunks(text) {
  return [chunk({ role: "assistant", content: text }), chunk({}, "stop")];
}

function decide(messages) {
  const toolResults = messages.filter((m) => m.role === "tool");
  const done = new Set();
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.tool_calls)) m.tool_calls.forEach((t) => done.add(t.function?.name));
  }
  let lastLayerId = null;
  for (const m of toolResults) {
    try { const j = JSON.parse(m.content); if (j.layerId) lastLayerId = j.layerId; } catch { /* content may be non-JSON */ }
  }

  if (!done.has("create_project")) {
    return toolCallChunks("create_project", { name: "Mock Launch", width: 1080, height: 1080, fps: 30, duration: 4, background: "#0b0b14", backgroundGradient: { kind: "radial", stops: [{ offset: 0, color: "#2e1065" }, { offset: 1, color: "#0b0b14" }] } });
  }
  if (!done.has("generate_palette")) {
    return toolCallChunks("generate_palette", { name: "Mock Neon", colors: ["#7c3aed", "#06b6d4", "#d946ef", "#ffffff", "#0b0b14"], displayFont: "Space Grotesk", bodyFont: "Inter", rationale: "Prism signature spectrum on deep ink." });
  }
  if (!done.has("add_text")) {
    return toolCallChunks("add_text", { text: "HELLO PRISM", x: 90, y: 420, width: 900, height: 160, fontSize: 110, fontFamily: "Space Grotesk", fontWeight: 700, color: "#ffffff", align: "center", letterSpacing: 2, lineHeight: 1.05 });
  }
  if (lastLayerId && !done.has("add_keyframe")) {
    return toolCallChunks("add_keyframe", { layerId: lastLayerId, time: 0.2, property: "opacity", value: 0, easing: "linear" });
  }
  if (lastLayerId && ![...done].includes("add_keyframe#2")) {
    // second keyframe: same tool name, so key off tool-result count instead
    const kfCount = messages.filter((m) => m.role === "assistant" && m.tool_calls?.some((t) => t.function?.name === "add_keyframe")).length;
    if (kfCount < 2) {
      // find layerId from the add_text result
      let lid = lastLayerId;
      for (const m of toolResults) { try { const j = JSON.parse(m.content); if (j.layerId) lid = j.layerId; } catch { /* noop */ } }
      return toolCallChunks("add_keyframe", { layerId: lid, time: 1.1, property: "opacity", value: 1, easing: "easeOutCubic" });
    }
  }
  return textChunks("Built a 1080×1080 launch card: radial violet backdrop, 'HELLO PRISM' headline fading in over 0.9s. This came from the local mock endpoint — swap in a real provider key for a real model.");
}

const server = http.createServer((req, res) => {
  if (req.url?.endsWith("/models")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ id: "prism-mock" }] }));
    return;
  }
  if (req.method === "POST" && req.url?.includes("/chat/completions")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = JSON.parse(body || "{}");
      const chunks = decide(json.messages ?? []);
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      chunks.forEach((c, i) => setTimeout(() => sse(res, c), i * 40));
      setTimeout(() => { res.write("data: [DONE]\n\n"); res.end(); }, chunks.length * 40 + 20);
    });
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => console.log(`[mock-llm] OpenAI-compatible mock on http://localhost:${PORT}/v1 (model: prism-mock)`));
