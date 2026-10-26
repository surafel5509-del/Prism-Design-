import { AppShell } from '@/components/app/AppShell';
import { AISettingsPage } from '@/components/settings/AISettingsPage';

export const metadata = { title: 'AI providers — Prism' };

export default function AISettingsRoute() {
  return (
    <AppShell title="AI providers" subtitle="Bring your own models — encrypted, server-side, production-ready">
      <AISettingsPage />
    </AppShell>
  );
}
