'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAgent } from '@/lib/store/agent';
import { useEditor } from '@/lib/store/editor';
import { consumeAgentStream } from '@/lib/ai/stream';
import { emitAgentAction } from '@/lib/ai/bus';
import { estimateCost, findModel } from '@/lib/ai/providers';
import type { ToolOutput } from '@/lib/ai/tools';
import { uid } from '@/lib/utils';

export interface AITarget { provider: string; model: string }

const TARGET_KEY = 'prism:ai-target';

export function loadTarget(): AITarget | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TARGET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AITarget;
    return parsed.provider && parsed.model ? parsed : null;
  } catch { return null; }
}

export function saveTarget(target: AITarget) {
  try { localStorage.setItem(TARGET_KEY, JSON.stringify(target)); } catch { /* quota */ }
}

export function useAgentRun() {
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    useAgent.getState().cancel();
  }, []);

  const send = useCallback(async (prompt: string, target?: AITarget | null) => {
    if (abortRef.current) abortRef.current.abort();
    const agent = useAgent.getState();
    const editor = useEditor.getState();
    if (!target) {
      agent.fail('Pick a provider and model first — open the model picker above.');
      return;
    }

    pausedRef.current = false;
    const runId = uid('run');
    agent.begin(prompt, runId);
    agent.addUsage(0, 0, 0);
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);

    const history = useAgent.getState().messages.slice(-12).map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
      images: m.role === 'user' ? m.attachments?.slice(0, 6).map((a) => a.dataUrl).filter((u) => u.startsWith('data:image/') || u.startsWith('http')) : undefined,
    }));

    let streamed = '';
    let inferenceProvider = target.provider;
    let inferenceModel = target.model;
    const started = Date.now();

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history,
          provider: target.provider,
          model: target.model,
          mode: useAgent.getState().mode,
          outputKind: useAgent.getState().outputKind,
          project: editor.project,
          runId,
        }),
      });

      inferenceProvider = res.headers.get('x-prism-provider') ?? target.provider;
      inferenceModel = res.headers.get('x-prism-model') ?? target.model;

      if (!res.ok || !res.body) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        agent.fail(payload.error ?? `The agent request failed (${res.status}).`);
        setRunning(false);
        return;
      }

      agent.setStatus('thinking');

      const streamResult = await consumeAgentStream(res.body, {
        onReasoning: (delta) => {
          useAgent.getState().appendReasoning(delta);
          if (useAgent.getState().status === 'preparing') useAgent.getState().setStatus('thinking');
        },
        onText: (delta) => {
          streamed += delta;
          const s = useAgent.getState();
          s.appendNarration(delta);
          if (s.status === 'thinking' || s.status === 'preparing' || s.status === 'planning') s.setStatus('building');
        },
        onToolCall: (call) => {
          useAgent.getState().addToolCall({ id: call.id, name: call.name, args: call.args, status: 'running' });
          useAgent.getState().setStatus('building');
          useAgent.getState().setProgress(Math.min(92, 12 + useAgent.getState().toolCalls.length * 6));
        },
        onToolResult: (result) => {
          const payload = (result.result ?? {}) as Partial<ToolOutput>;
          const ok = payload.ok !== false;
          useAgent.getState().updateToolCall(result.id, {
            status: ok ? 'success' : 'failed',
            endedAt: Date.now(),
            summary: payload.summary,
            error: payload.error,
            result: payload.data ?? null,
          });
          if (payload.ops?.length) {
            try { useEditor.getState().applyAgentOps(payload.ops, { label: result.name ?? 'AI edit' }); }
            catch (err) { console.warn('[prism] failed to apply agent ops', err); }
          }
          const action = payload.clientAction;
          if (action?.type === 'plan') {
            const plan = (action.steps as { title: string; detail?: string }[] | undefined) ?? [];
            useAgent.getState().setPlan(plan.map((p, i) => ({ id: `plan-${i}`, title: p.title, detail: p.detail, status: i === 0 ? 'active' : 'pending' })));
            useAgent.getState().setStatus('planning');
            emitAgentAction({ type: 'plan', summary: String(action.summary ?? ''), steps: plan });
          } else if (action?.type === 'step') {
            useAgent.getState().advancePlan(Number(action.index) + 1);
            emitAgentAction({ type: 'step', index: Number(action.index), note: action.note as string | undefined });
          } else if (action?.type === 'ask') {
            pausedRef.current = true;
            const isApproval = action.kind === 'approval';
            useAgent.getState().askQuestion({ question: String(action.question), options: (action.options as string[]) ?? [] });
            useAgent.getState().setPaused(true);
            useAgent.getState().setAwaitingApproval(isApproval);
            emitAgentAction({ type: 'ask', kind: isApproval ? 'approval' : 'question', question: String(action.question), options: (action.options as string[]) ?? [], reason: action.reason as string | undefined });
            controller.abort();
          } else if (action?.type === 'cutout') {
            emitAgentAction({ type: 'cutout', layerId: String(action.layerId ?? '') });
          } else if (action?.type === 'preview') {
            emitAgentAction({ type: 'preview', autoplay: action.autoplay !== false });
          } else if (action?.type === 'export') {
            emitAgentAction({ type: 'export', options: action.options as { format: string } });
          } else if (action?.type === 'saved') {
            emitAgentAction({ type: 'saved', id: String((action as { id?: string }).id ?? '') });
          }
        },
        onError: (message) => {
          useAgent.getState().fail(message);
        },
      }, controller.signal);

      if (pausedRef.current) {
        setRunning(false);
        return;
      }

      const state = useAgent.getState();
      const modelInfo = findModel(inferenceProvider, inferenceModel);
      const cost = estimateCost(modelInfo, streamResult.usage.promptTokens, streamResult.usage.completionTokens);
      state.addUsage(streamResult.usage.promptTokens, streamResult.usage.completionTokens, cost);
      const project = useEditor.getState().project;
      const keyframeCount = project.layers.reduce((acc, l) => acc + Object.values(l.keyframes ?? {}).reduce((n, list) => n + (list?.length ?? 0), 0), 0);

      if (streamed.trim()) {
        useAgent.getState().pushMessage({ role: 'assistant', content: streamed.trim(), provider: inferenceProvider, model: inferenceModel, runId });
      }
      const latest = useAgent.getState();
      latest.finish({
        tokensIn: latest.tokensIn, tokensOut: latest.tokensOut, cost: latest.cost,
        duration: (Date.now() - started) / 1000,
        tools: latest.toolCalls.length,
        layers: project.layers.length,
        keyframes: keyframeCount,
      });
      useAgent.getState().setPreviewReady(true);
    } catch (err) {
      if (pausedRef.current) { setRunning(false); return; }
      const aborted = (err as { name?: string })?.name === 'AbortError';
      if (aborted) useAgent.getState().cancel();
      else useAgent.getState().fail(err instanceof Error ? err.message : 'The agent run failed.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
      useAgent.getState().setAwaitingApproval(false);
    }
  }, []);

  const answer = useCallback((text: string) => {
    useAgent.getState().askQuestion(null);
    useAgent.getState().setPaused(false);
    useAgent.getState().setAwaitingApproval(false);
    pausedRef.current = false;
    void send(text, loadTarget());
  }, [send]);

  return { send, stop, answer, running };
}
