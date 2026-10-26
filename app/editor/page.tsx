import { redirect } from 'next/navigation';

export default function EditorIndex() {
  redirect(`/editor/new-${Math.random().toString(36).slice(2, 8)}`);
}
