import { AppShell } from "@/components/layout/AppShell";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="mt-6 rounded-xl border border-border bg-surface p-5 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">API URL</span>
            <span className="font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Storage</span>
            <span>Local filesystem</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Database</span>
            <span>SQLite (local)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Authentication</span>
            <span>Disabled (local MVP)</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
