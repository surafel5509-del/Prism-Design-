export type AgentAction =
  | { type: 'plan'; summary: string; steps: { title: string; detail?: string }[] }
  | { type: 'step'; index: number; note?: string }
  | { type: 'ask'; kind: 'question' | 'approval'; question: string; options: string[]; reason?: string }
  | { type: 'preview'; autoplay?: boolean }
  | { type: 'export'; options: { format: string; preset?: string; fps?: number; scale?: number; transparent?: boolean } }
  | { type: 'saved'; id: string }
  | { type: 'cutout'; layerId: string };

type Listener = (action: AgentAction) => void;
const listeners = new Set<Listener>();

export function onAgentAction(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitAgentAction(action: AgentAction): void {
  for (const fn of listeners) {
    try { fn(action); } catch (err) { console.warn('[prism] agent action listener failed', err); }
  }
}
