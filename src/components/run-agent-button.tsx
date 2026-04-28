"use client";

import { useState } from 'react';

type CronAction = 'deploy' | 'run' | 'stop' | 'reset';

const KNOWN_PROFILES = ['default', 'local', 'tbai'];

export function RunAgentButton({ agentName, agentProfile }: { agentName: string; agentProfile?: string }) {
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<CronAction | null>(null);
  const [result, setResult] = useState<{ message: string; success: boolean } | null>(null);
  const [deployProfile, setDeployProfile] = useState(agentProfile || 'default');

  const runAction = async (action: CronAction, profile?: string) => {
    setLoading(true);
    setActiveAction(action);
    setResult(null);
    try {
      const body: Record<string, string> = { agentName, action };
      if (action === 'deploy' && profile) {
        body.profile = profile;
      }
      const res = await fetch('/api/agents/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult({ message: data.message, success: data.success });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setResult({ message: `Error: ${String(err)}`, success: false });
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  const btnClass = (variant: 'primary' | 'success' | 'danger' | 'warning') => {
    const base = 'inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 disabled:opacity-50 transition-colors';
    switch (variant) {
      case 'primary':
        return `${base} bg-primary text-primary-foreground hover:bg-primary/90`;
      case 'success':
        return `${base} bg-green-600 text-white hover:bg-green-700`;
      case 'danger':
        return `${base} bg-red-600 text-white hover:bg-red-700`;
      case 'warning':
        return `${base} bg-amber-600 text-white hover:bg-amber-700`;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={deployProfile}
          onChange={(e) => setDeployProfile(e.target.value)}
          className="inline-flex rounded-md border border-input bg-background px-3 py-1.5 text-sm h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={loading && activeAction === 'deploy'}
        >
          {KNOWN_PROFILES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
          {!KNOWN_PROFILES.includes(deployProfile) && (
            <option value={deployProfile}>{deployProfile}</option>
          )}
        </select>

        <button onClick={() => runAction('deploy', deployProfile)} disabled={loading} className={btnClass('success')}>
          {loading && activeAction === 'deploy' ? 'Deploying...' : 'Deploy'}
        </button>
        <button onClick={() => runAction('run')} disabled={loading} className={btnClass('primary')}>
          {loading && activeAction === 'run' ? 'Running...' : 'Run Now'}
        </button>
        <button onClick={() => runAction('stop')} disabled={loading} className={btnClass('danger')}>
          {loading && activeAction === 'stop' ? 'Stopping...' : 'Stop'}
        </button>
        <button onClick={() => runAction('reset')} disabled={loading} className={btnClass('warning')}>
          {loading && activeAction === 'reset' ? 'Resetting...' : 'Reset State'}
        </button>
      </div>

      {result && (
        <div className={`rounded-md border p-3 text-sm ${result.success ? 'border-green-600/30 bg-green-500/5' : 'border-red-600/30 bg-red-500/5'}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
