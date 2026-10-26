'use client';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Tiny, dependency-free markdown renderer tuned for agent narration. */
function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyBase}-${i++}`;
    if (token.startsWith('**')) nodes.push(<strong key={key} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) nodes.push(<code key={key} className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[0.86em] text-cyan-200">{token.slice(1, -1)}</code>);
    else if (token.startsWith('[')) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      nodes.push(mm ? <a key={key} href={mm[2]} target="_blank" rel="noreferrer" className="text-violet-300 underline decoration-violet-400/40 underline-offset-2 hover:text-violet-200">{mm[1]}</a> : token);
    } else nodes.push(<em key={key} className="italic text-foreground/90">{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  const lines = children.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1.5 space-y-1 pl-3.5">
        {list.map((item, i) => (
          <li key={i} className="relative pl-3 before:absolute before:left-0 before:top-[0.55em] before:h-1 before:w-1 before:rounded-full before:bg-violet-400/70">
            {inline(item, `li-${blocks.length}-${i}`)}
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/^[-*•]\s+/.test(trimmed)) { list.push(trimmed.replace(/^[-*•]\s+/, '')); return; }
    if (/^\d+\.\s+/.test(trimmed)) { list.push(trimmed.replace(/^\d+\.\s+/, '')); return; }
    flush();
    if (!trimmed) { blocks.push(<div key={`sp-${idx}`} className="h-1.5" />); return; }
    if (/^#{1,4}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)![0].length;
      blocks.push(
        <div key={`h-${idx}`} className={cn('font-semibold tracking-tight text-foreground', level <= 2 ? 'mt-2 text-[13px]' : 'mt-1.5 text-[12px]')}>
          {inline(trimmed.replace(/^#+\s/, ''), `h-${idx}`)}
        </div>,
      );
      return;
    }
    blocks.push(<p key={`p-${idx}`} className="leading-relaxed">{inline(line, `p-${idx}`)}</p>);
  });
  flush();

  return <div className={cn('text-[12.5px] text-foreground/80 [overflow-wrap:anywhere]', className)}><Fragment>{blocks}</Fragment></div>;
}
