import type { Metadata } from 'next';
import { EditorShell } from '@/components/editor/EditorShell';

export const metadata: Metadata = { title: 'Studio — Prism', description: 'Design and animate in Prism Studio.' };

export default function EditorPage({ params }: { params: { id: string } }) {
  return <EditorShell projectId={params.id} />;
}
