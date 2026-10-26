// Minimal client for the AI SDK v4 data-stream protocol. Parsing it ourselves
// keeps the editor's live canvas updates, tool log and reasoning display under
// full control (and version-proof).
export interface StreamUsage { promptTokens: number; completionTokens: number }

export interface AgentStreamHandlers {
  onText?: (text: string) => void;
  onReasoning?: (text: string) => void;
  onToolCall?: (call: { id: string; name: string; args: Record<string, unknown> }) => void;
  onToolResult?: (result: { id: string; name?: string; result: unknown }) => void;
  onStartStep?: () => void;
  onFinishStep?: (v: { finishReason: string; usage?: StreamUsage }) => void;
  onFinish?: (v: { finishReason: string; usage?: StreamUsage }) => void;
  onError?: (message: string) => void;
  onData?: (value: unknown) => void;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export async function consumeAgentStream(
  stream: ReadableStream<Uint8Array>,
  handlers: AgentStreamHandlers,
  signal?: AbortSignal,
): Promise<{ text: string; reasoning: string; finishReason: string; usage: StreamUsage }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let reasoning = '';
  let finishReason = 'stop';
  let usage: StreamUsage = { promptTokens: 0, completionTokens: 0 };
  const names = new Map<string, string>();

  const handle = (line: string) => {
    if (!line.trim()) return;
    const idx = line.indexOf(':');
    if (idx <= 0) return;
    const code = line.slice(0, idx);
    let value: unknown;
    try { value = JSON.parse(line.slice(idx + 1)); } catch { return; }
    switch (code) {
      case '0': {
        const delta = typeof value === 'string' ? value : '';
        text += delta;
        handlers.onText?.(delta);
        break;
      }
      case 'g': {
        const delta = typeof value === 'string' ? value : '';
        reasoning += delta;
        handlers.onReasoning?.(delta);
        break;
      }
      case '9': {
        const v = value as { toolCallId: string; toolName: string; args: Record<string, unknown> };
        names.set(v.toolCallId, v.toolName);
        handlers.onToolCall?.({ id: v.toolCallId, name: v.toolName, args: v.args ?? {} });
        break;
      }
      case 'a': {
        const v = value as { toolCallId: string; result: unknown; toolName?: string };
        handlers.onToolResult?.({ id: v.toolCallId, name: v.toolName ?? names.get(v.toolCallId), result: v.result });
        break;
      }
      case 'e': {
        const v = value as { finishReason?: string; usage?: { promptTokens?: number; completionTokens?: number } };
        if (v.usage) usage = { promptTokens: num(v.usage.promptTokens), completionTokens: num(v.usage.completionTokens) };
        handlers.onFinishStep?.({ finishReason: v.finishReason ?? 'stop', usage: v.usage ? { promptTokens: num(v.usage.promptTokens), completionTokens: num(v.usage.completionTokens) } : undefined });
        break;
      }
      case 'd': {
        const v = value as { finishReason?: string; usage?: { promptTokens?: number; completionTokens?: number } };
        finishReason = v.finishReason ?? finishReason;
        if (v.usage) usage = { promptTokens: num(v.usage.promptTokens), completionTokens: num(v.usage.completionTokens) };
        break;
      }
      case 'f':
        handlers.onStartStep?.();
        break;
      case '3': {
        const msg = typeof value === 'string' ? value : 'The model stream failed.';
        handlers.onError?.(msg);
        break;
      }
      case '2':
        handlers.onData?.(value);
        break;
      default:
        break;
    }
  };

  try {
    for (;;) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf('\n');
      }
    }
    if (buffer) handle(buffer);
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }

  handlers.onFinish?.({ finishReason, usage });
  return { text, reasoning, finishReason, usage };
}
