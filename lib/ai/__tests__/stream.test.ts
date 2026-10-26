import { describe, expect, it } from 'vitest';
import { consumeAgentStream } from '../stream';

const frame = (code: string, value: unknown) => `${code}:${JSON.stringify(value)}\n`;

/** A byte-for-byte sample of the AI SDK v4 data stream, captured from a real run. */
const PROTOCOL = [
  frame('f', { messageId: 'msg-1' }),
  frame('g', 'Thinking about composition…'),
  frame('0', 'Building the headline. '),
  frame('9', { toolCallId: 'call_1', toolName: 'add_text', args: { content: 'Hello', x: 0.1 } }),
  frame('a', { toolCallId: 'call_1', result: { ok: true, summary: 'Added text', ops: [{ op: 'update_layer', id: 'a', patch: {} }] } }),
  frame('e', { finishReason: 'tool-calls', usage: { promptTokens: 120, completionTokens: 30 } }),
  frame('f', { messageId: 'msg-2' }),
  frame('0', 'Done.'),
  frame('e', { finishReason: 'stop', usage: { promptTokens: 200, completionTokens: 40 } }),
  frame('d', { finishReason: 'stop', usage: { promptTokens: 320, completionTokens: 70 } }),
].join('');

const toStream = (text: string) => new ReadableStream<Uint8Array>({
  start(controller) {
    const bytes = new TextEncoder().encode(text);
    // Split mid-frame to prove the line buffering handles partial chunks.
    controller.enqueue(bytes.slice(0, 37));
    controller.enqueue(bytes.slice(37));
    controller.close();
  },
});

describe('agent stream consumer', () => {
  it('parses text, reasoning, tool calls/results, steps and usage from the SDK protocol', async () => {
    const seen = {
      text: '', reasoning: '', toolCalls: [] as { id: string; name: string; args: unknown }[],
      toolResults: [] as unknown[], stepsStarted: 0, finishSteps: 0,
    };
    const result = await consumeAgentStream(toStream(PROTOCOL), {
      onText: (t) => { seen.text += t; },
      onReasoning: (t) => { seen.reasoning += t; },
      onToolCall: (c) => seen.toolCalls.push(c),
      onToolResult: (r) => seen.toolResults.push(r.result),
      onStartStep: () => { seen.stepsStarted += 1; },
      onFinishStep: () => { seen.finishSteps += 1; },
    });

    expect(seen.text).toBe('Building the headline. Done.');
    expect(seen.reasoning).toBe('Thinking about composition…');
    expect(seen.toolCalls).toEqual([{ id: 'call_1', name: 'add_text', args: { content: 'Hello', x: 0.1 } }]);
    expect(seen.toolResults[0]).toMatchObject({ ok: true, summary: 'Added text' });
    expect(seen.stepsStarted).toBe(2);
    expect(seen.finishSteps).toBe(2);
    expect(result.text).toBe('Building the headline. Done.');
    expect(result.finishReason).toBe('stop');
    expect(result.usage).toEqual({ promptTokens: 320, completionTokens: 70 });
  });

  it('surfaces stream errors instead of hanging', async () => {
    const errors: string[] = [];
    const result = await consumeAgentStream(toStream(frame('3', 'Provider returned 429: rate limited') + frame('d', { finishReason: 'error' })), {
      onError: (m) => errors.push(m),
    });
    expect(errors.join(' ')).toMatch(/429/);
    expect(result.finishReason).toBe('error');
  });
});
