'use client';
import { create } from 'zustand';
import { uid } from '@/lib/utils';

export type RunStatus = 'idle' | 'preparing' | 'thinking' | 'planning' | 'building' | 'paused' | 'done' | 'error' | 'cancelled';
export type ToolStatus = 'pending' | 'running' | 'success' | 'failed' | 'awaiting_approval';

export interface PlanStep { id: string; title: string; detail?: string; status: 'pending' | 'active' | 'done' | 'skipped' }
export interface ToolCallLog {
  id: string; name: string; args: Record<string, unknown>; status: ToolStatus; result?: unknown; error?: string;
  startedAt: number; endedAt?: number; step?: number; summary?: string;
}
export interface ChatAttachment { id: string; name: string; type: string; dataUrl: string; thumb?: string; w?: number; h?: number; analysis?: string }
export interface ChatMessage {
  id: string; role: 'user' | 'assistant' | 'system'; content: string; attachments?: ChatAttachment[];
  createdAt: number; mode?: string; provider?: string; model?: string; runId?: string;
}
export interface PendingQuestion { question: string; options?: string[] }
export interface RunSummaryData { tokensIn: number; tokensOut: number; cost: number; duration: number; tools: number; layers: number; keyframes: number }

interface AgentStore {
  messages: ChatMessage[];
  reasoning: string;
  narration: string;
  plan: PlanStep[];
  toolCalls: ToolCallLog[];
  status: RunStatus;
  progress: number;
  error: string | null;
  startedAt: number | null;
  endedAt: number | null;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  summary: RunSummaryData | null;
  currentStep: number;
  totalSteps: number;
  pendingQuestion: PendingQuestion | null;
  paused: boolean;
  awaitingApproval: boolean;
  previewReady: boolean;
  attachments: ChatAttachment[];
  mode: 'agent' | 'thinking' | 'fast';
  outputKind: 'design' | 'motion' | 'image' | 'edit';
  lastRunId: string | null;
  draftPrompt: string;
  runLog: { id: string; prompt: string; at: number; status: RunStatus; tools: number; tokens: number }[];

  pushMessage: (m: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => void;
  setAttachments: (a: ChatAttachment[]) => void;
  addAttachment: (a: ChatAttachment) => void;
  removeAttachment: (id: string) => void;
  setMode: (m: AgentStore['mode']) => void;
  setOutputKind: (k: AgentStore['outputKind']) => void;
  begin: (prompt: string, runId: string) => void;
  setStatus: (s: RunStatus) => void;
  appendReasoning: (t: string) => void;
  appendNarration: (t: string) => void;
  setPlan: (p: PlanStep[]) => void;
  advancePlan: (index: number) => void;
  addToolCall: (t: Omit<ToolCallLog, 'startedAt' | 'id'> & { id?: string }) => void;
  updateToolCall: (id: string, patch: Partial<ToolCallLog>) => void;
  updateToolCallByName: (name: string, patch: Partial<ToolCallLog>) => void;
  setProgress: (p: number) => void;
  setSteps: (current: number, total: number) => void;
  addUsage: (inTok: number, outTok: number, cost: number) => void;
  finish: (summary?: Partial<RunSummaryData>) => void;
  fail: (message: string) => void;
  cancel: () => void;
  setPaused: (v: boolean) => void;
  setAwaitingApproval: (v: boolean) => void;
  setPreviewReady: (v: boolean) => void;
  setDraftPrompt: (v: string) => void;
  askQuestion: (q: PendingQuestion | null) => void;
  reset: () => void;
  clearConversation: () => void;
  hydrate: () => void;
}

const MAX_MESSAGES = 60;

export const useAgent = create<AgentStore>((set, get) => ({
  messages: [],
  reasoning: '',
  narration: '',
  plan: [],
  toolCalls: [],
  status: 'idle',
  progress: 0,
  error: null,
  startedAt: null,
  endedAt: null,
  tokensIn: 0,
  tokensOut: 0,
  cost: 0,
  summary: null,
  currentStep: 0,
  totalSteps: 0,
  pendingQuestion: null,
  paused: false,
  awaitingApproval: false,
  previewReady: false,
  attachments: [],
  mode: 'agent',
  outputKind: 'motion',
  lastRunId: null,
  draftPrompt: '',
  runLog: [],

  pushMessage: (m) => set((s) => ({
    messages: [...s.messages, { id: m.id ?? uid('msg'), createdAt: m.createdAt ?? Date.now(), ...m }].slice(-MAX_MESSAGES),
  })),
  setAttachments: (a) => set({ attachments: a }),
  addAttachment: (a) => set((s) => ({ attachments: [...s.attachments, a].slice(0, 10) })),
  removeAttachment: (id) => set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),
  setMode: (m) => set({ mode: m }),
  setOutputKind: (k) => set({ outputKind: k }),

  begin: (prompt, runId) => set((s) => ({
    reasoning: '', narration: '', plan: [], toolCalls: [], status: 'preparing', progress: 2, error: null,
    startedAt: Date.now(), endedAt: null, tokensIn: 0, tokensOut: 0, cost: 0, summary: null,
    currentStep: 0, totalSteps: 0, pendingQuestion: null, paused: false, awaitingApproval: false, previewReady: false,
    lastRunId: runId,
    messages: [...s.messages, { id: uid('msg'), role: 'user' as const, content: prompt, createdAt: Date.now(), attachments: s.attachments, mode: s.mode }].slice(-MAX_MESSAGES),
    attachments: [],
    runLog: [{ id: runId, prompt, at: Date.now(), status: 'preparing' as RunStatus, tools: 0, tokens: 0 }, ...s.runLog].slice(0, 40),
  })),

  setStatus: (status) => set({ status }),
  appendReasoning: (t) => set((s) => ({ reasoning: (s.reasoning + t).slice(-12000) })),
  appendNarration: (t) => set((s) => ({ narration: (s.narration + t).slice(-8000) })),
  setPlan: (plan) => set({ plan, totalSteps: plan.length }),
  advancePlan: (index) => set((s) => ({ plan: s.plan.map((p, i) => ({ ...p, status: i < index ? 'done' : i === index ? 'active' : 'pending' })), currentStep: index + 1 })),
  addToolCall: (t) => set((s) => ({ toolCalls: [...s.toolCalls, { ...t, id: t.id ?? uid('tc'), startedAt: Date.now() }] })),
  updateToolCall: (id, patch) => set((s) => ({ toolCalls: s.toolCalls.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  updateToolCallByName: (name, patch) => set((s) => {
    const idx = [...s.toolCalls].reverse().findIndex((t) => t.name === name && (t.status === 'running' || t.status === 'pending'));
    if (idx < 0) return {};
    const real = s.toolCalls.length - 1 - idx;
    return { toolCalls: s.toolCalls.map((t, i) => (i === real ? { ...t, ...patch } : t)) };
  }),
  setProgress: (p) => set({ progress: Math.max(0, Math.min(100, p)) }),
  setSteps: (current, total) => set({ currentStep: current, totalSteps: total }),
  addUsage: (i, o, c) => set((s) => ({ tokensIn: s.tokensIn + i, tokensOut: s.tokensOut + o, cost: s.cost + c })),
  finish: (summary) => set((s) => ({
    status: 'done', progress: 100, endedAt: Date.now(), previewReady: true,
    summary: {
      tokensIn: s.tokensIn, tokensOut: s.tokensOut, cost: s.cost,
      duration: (Date.now() - (s.startedAt ?? Date.now())) / 1000,
      tools: s.toolCalls.length, layers: 0, keyframes: 0, ...summary,
    },
    plan: s.plan.map((p) => ({ ...p, status: p.status === 'pending' ? 'skipped' : 'done' })),
    narration: s.narration || 'Scene ready. Preview rendered below.',
    runLog: s.runLog.map((r) => (r.id === s.lastRunId ? { ...r, status: 'done', tools: s.toolCalls.length, tokens: s.tokensIn + s.tokensOut } : r)),
  })),
  fail: (message) => set((s) => ({
    status: 'error', error: message, endedAt: Date.now(),
    narration: s.narration || 'The run stopped.',
    runLog: s.runLog.map((r) => (r.id === s.lastRunId ? { ...r, status: 'error' } : r)),
  })),
  cancel: () => set((s) => ({
    status: 'cancelled', endedAt: Date.now(), paused: false,
    runLog: s.runLog.map((r) => (r.id === s.lastRunId ? { ...r, status: 'cancelled' } : r)),
  })),
  setPaused: (v) => set({ paused: v, status: v ? 'paused' : 'building' }),
  setAwaitingApproval: (v) => set({ awaitingApproval: v }),
  setPreviewReady: (v) => set({ previewReady: v }),
  setDraftPrompt: (v) => set({ draftPrompt: v }),
  askQuestion: (q) => set({ pendingQuestion: q }),
  reset: () => set({
    reasoning: '', narration: '', plan: [], toolCalls: [], status: 'idle', progress: 0, error: null,
    startedAt: null, endedAt: null, tokensIn: 0, tokensOut: 0, cost: 0, summary: null,
    currentStep: 0, totalSteps: 0, pendingQuestion: null, paused: false, awaitingApproval: false, previewReady: false,
  }),
  clearConversation: () => set({ messages: [], toolCalls: [], plan: [], reasoning: '', narration: '', summary: null, error: null, status: 'idle', progress: 0 }),

  hydrate: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('prism:chat');
      if (!raw) return;
      const data = JSON.parse(raw) as { messages: ChatMessage[]; runLog: AgentStore['runLog'] };
      set({ messages: data.messages ?? [], runLog: data.runLog ?? [] });
    } catch { /* noop */ }
    const persist = () => {
      try {
        const s = get();
        const messages = s.messages.slice(-30).map((m) => ({
          ...m,
          attachments: m.attachments?.map((a) => ({ ...a, dataUrl: a.dataUrl.length > 20_000 ? (a.thumb ?? '') : a.dataUrl })),
        }));
        localStorage.setItem('prism:chat', JSON.stringify({ messages, runLog: s.runLog.slice(0, 12) }));
      } catch { /* noop */ }
    };
    persist();
    useAgent.subscribe(persist);
  },
}));
