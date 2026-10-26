'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp, Brain, FileJson, Film, Image as ImageIcon, Loader2, Mic, MicOff, Paperclip, Sparkles, Square, Wand2, X, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, uid } from '@/lib/utils';
import { useAgent, type ChatAttachment } from '@/lib/store/agent';
import { useEditor } from '@/lib/store/editor';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MAX_FILES = 10;
const MAX_BYTES = 12 * 1024 * 1024;

interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

const KINDS = [
  { id: 'design', label: 'Design', icon: <ImageIcon className="h-3 w-3" /> },
  { id: 'motion', label: 'Motion', icon: <Film className="h-3 w-3" /> },
  { id: 'image', label: 'Image Gen', icon: <Sparkles className="h-3 w-3" /> },
  { id: 'edit', label: 'Edit', icon: <Wand2 className="h-3 w-3" /> },
] as const;

const MODES = [
  { id: 'thinking', label: 'High Thinking', icon: <Brain className="h-3 w-3" /> },
  { id: 'agent', label: 'Agent', icon: <Zap className="h-3 w-3" /> },
  { id: 'fast', label: 'Fast', icon: <Sparkles className="h-3 w-3" /> },
] as const;

const SUGGESTIONS = [
  'A cinematic 8s title sequence for a fintech launch',
  'Instagram carousel cover: bold type, electric palette',
  'Animate a product photo into a parallax hero',
  'Design a minimal event poster with my brand kit',
];

export function Composer(props: {
  onSend: (prompt: string) => void;
  onStop: () => void;
  running: boolean;
  onAnswer: (text: string) => void;
}) {
  const { onSend, onStop, running, onAnswer } = props;
  const draft = useAgent((s) => s.draftPrompt);
  const setDraft = useAgent((s) => s.setDraftPrompt);
  const attachments = useAgent((s) => s.attachments);
  const addAttachment = useAgent((s) => s.addAttachment);
  const removeAttachment = useAgent((s) => s.removeAttachment);
  const mode = useAgent((s) => s.mode);
  const setMode = useAgent((s) => s.setMode);
  const outputKind = useAgent((s) => s.outputKind);
  const setOutputKind = useAgent((s) => s.setOutputKind);
  const pendingQuestion = useAgent((s) => s.pendingQuestion);
  const brandKits = useEditor((s) => s.brandKits);
  const activeBrandKitId = useEditor((s) => s.activeBrandKitId);

  const [dragging, setDragging] = useState(false);
  const [listening, setListening] = useState(false);
  const [brandId, setBrandId] = useState<string>('');
  const [showKinds, setShowKinds] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(180, Math.max(44, el.scrollHeight))}px`;
  }, [draft]);

  useEffect(() => {
    if (pendingQuestion) areaRef.current?.focus();
  }, [pendingQuestion]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, MAX_FILES - useAgent.getState().attachments.length);
    for (const file of list) {
      if (file.size > MAX_BYTES) { toast.error(`${file.name} is over 12 MB`); continue; }
      const allowed = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.type) || /^video\/mp4$/.test(file.type) || /json$/.test(file.type);
      if (!allowed) { toast.error(`${file.name} is not a supported asset (PNG, JPG, GIF, SVG, MP4, Lottie JSON).`); continue; }
      try {
        const dataUrl = await fileToDataUrl(file);
        let thumb = dataUrl;
        if (file.type.startsWith('image/') && !file.type.includes('svg')) thumb = await downscale(dataUrl, 240);
        addAttachment({ id: uid('att'), name: file.name, type: file.type || 'application/octet-stream', dataUrl, thumb, w: undefined, h: undefined });
      } catch {
        toast.error(`Could not read ${file.name}`);
      }
    }
  }, [addAttachment]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.files ?? []);
      if (items.length) { e.preventDefault(); void addFiles(items); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const toggleVoice = () => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) { toast.error('Voice input is not supported in this browser.'); return; }
    if (listening) { recognition.current?.stop(); setListening(false); return; }
    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(' ');
      setDraft((useAgent.getState().draftPrompt + ' ' + text).trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); toast.error('Voice input stopped.'); };
    recognition.current = rec;
    rec.start();
    setListening(true);
  };

  const submit = () => {
    const text = useAgent.getState().draftPrompt.trim();
    if (running) return;
    if (pendingQuestion) {
      if (!text) return;
      setDraft('');
      onAnswer(text);
      return;
    }
    if (!text && !useAgent.getState().attachments.length) return;
    const kit = useEditor.getState().brandKits.find((k) => k.id === brandId);
    const brief = kit
      ? `${text}\n\nBrand kit “${kit.name}” — colors ${kit.colors.join(', ')}; heading font ${kit.fonts.heading}; body font ${kit.fonts.body}. Keep it on-brand.`
      : text;
    setDraft('');
    onSend(brief || 'Design something striking from these references.');
  };

  const hasContent = draft.trim().length > 0 || attachments.length > 0;

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {pendingQuestion && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-2.5">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-amber-100">The agent needs your call</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-100/80">{pendingQuestion.question}</p>
                {pendingQuestion.options?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pendingQuestion.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => { setDraft(''); onAnswer(opt); }}
                        className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10.5px] text-amber-100 transition-colors hover:bg-amber-300/20"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!useAgent.getState().messages.length && !running && (
        <div className="flex flex-wrap gap-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => { setDraft(s); areaRef.current?.focus(); }} className="rounded-full border border-border/70 bg-white/[0.02] px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-violet-400/30 hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          'relative rounded-xl border bg-[linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012))] transition-colors',
          dragging ? 'border-violet-400/60 ring-2 ring-violet-500/25' : 'border-border/80 focus-within:border-violet-400/40 focus-within:ring-1 focus-within:ring-violet-500/20',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files); }}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border/60 px-2 py-1.5">
            {attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
            ))}
          </div>
        )}

        <textarea
          id="prism-ai-input"
          ref={areaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            if (e.key === 'Escape' && running) onStop();
          }}
          placeholder={pendingQuestion ? 'Type your answer…' : running ? 'Building — add guidance or press stop…' : 'Describe the design or motion you want…'}
          rows={1}
          className="max-h-[180px] w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[12.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
        />

        <div className="flex items-center gap-1 px-1.5 pb-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => fileRef.current?.click()} disabled={attachments.length >= MAX_FILES} className="text-muted-foreground hover:text-foreground">
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach references (up to 10)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={toggleVoice} className={cn('text-muted-foreground hover:text-foreground', listening && 'text-rose-400')}>
                {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{listening ? 'Stop dictation' : 'Dictate a prompt'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="h-6 max-w-[92px] truncate rounded-md border border-transparent bg-transparent px-1 text-[10px] text-muted-foreground outline-none transition-colors hover:border-border hover:text-foreground"
            >
              <option value="">Brand kit</option>
              {brandKits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              {activeBrandKitId && !brandKits.some((k) => k.id === activeBrandKitId) && <option value={activeBrandKitId}>Active kit</option>}
            </select>
            </TooltipTrigger>
            <TooltipContent>Attach a brand kit</TooltipContent>
          </Tooltip>

          <div className="ml-auto flex items-center gap-1">
            {showKinds ? (
              <div className="flex items-center gap-0.5 rounded-md border border-border/70 bg-black/30 p-0.5">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => { setOutputKind(k.id); setShowKinds(false); }}
                    className={cn('inline-flex h-5 items-center gap-1 rounded px-1.5 text-[9.5px] transition-colors', outputKind === k.id ? 'bg-violet-500/20 text-violet-200' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {k.icon}{k.label}
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => setShowKinds(true)} className="inline-flex h-6 items-center gap-1 rounded-md border border-transparent px-1.5 text-[10px] text-muted-foreground transition-colors hover:border-border hover:text-foreground">
                {KINDS.find((k) => k.id === outputKind)?.icon}
                {KINDS.find((k) => k.id === outputKind)?.label ?? 'Design'}
              </button>
            )}

            <ModeSwitch mode={mode} onChange={setMode} />

            {running ? (
              <Button size="icon-sm" variant="secondary" onClick={onStop} className="h-7 w-7" aria-label="Stop run">
                <Square className="h-3 w-3 fill-current" />
              </Button>
            ) : (
              <Button size="icon-sm" variant="prism" onClick={submit} disabled={!hasContent} className="h-7 w-7 rounded-full" aria-label="Send">
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,video/mp4,application/json,.json"
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>
      <div className="flex items-center justify-between px-0.5 text-[9px] text-muted-foreground/60">
        <span>Enter to send · Shift+Enter for a new line · ⌘⏎ to run</span>
        <span className="font-mono">{running ? 'streaming' : `${attachments.length}/${MAX_FILES} refs`}</span>
      </div>
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: 'agent' | 'thinking' | 'fast'; onChange: (m: 'agent' | 'thinking' | 'fast') => void }) {
  const active = MODES.find((m) => m.id === mode) ?? MODES[1];
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-6 items-center gap-1 rounded-md border border-violet-400/25 bg-violet-500/10 px-1.5 text-[10px] font-medium text-violet-200 transition-colors hover:bg-violet-500/15"
      >
        {active.icon}{active.label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute bottom-8 right-0 z-40 w-40 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-float"
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors', mode === m.id ? 'bg-violet-500/15 text-violet-200' : 'text-foreground/75 hover:bg-white/[0.05]')}
              >
                {m.icon}{m.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AttachmentChip({ attachment, onRemove }: { attachment: ChatAttachment; onRemove: () => void }) {
  const isImage = attachment.type.startsWith('image/');
  return (
    <div className="group relative h-11 w-11 overflow-hidden rounded-lg border border-border/70 bg-black/40">
      {isImage ? (
        <img src={attachment.thumb ?? attachment.dataUrl} alt={attachment.name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground">
          {attachment.type.includes('json') ? <FileJson className="h-4 w-4" /> : <Film className="h-4 w-4" />}
        </div>
      )}
      <button onClick={onRemove} className="absolute right-0 top-0 grid h-3.5 w-3.5 place-items-center rounded-bl bg-black/80 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-label={`Remove ${attachment.name}`}>
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function downscale(dataUrl: string, max: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function ComposerLoading() {
  return (
    <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing the agent…
    </div>
  );
}
