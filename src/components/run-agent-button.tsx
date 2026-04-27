"use client";

import { useState } from 'react';

type CronAction = 'deploy' | 'run' | 'stop' | 'reset';

export function RunAgentButton({ agentName }: { agentName: string }) {
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<CronAction | null>(null);
  const [result, setResult] = useState<{ message: string; success: boolean } | null>(null);

  const runAction = async (action: CronAction) => {
    setLoading(true);
    setActiveAction(action);
    setResult(null);
    try {
      const res = await fetch('/api/agents/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, action }),
      });
      const data = await res.json();
      setResult({ message: data.message, success: data.success });
      // Refresh page to show updated state
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
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => runAction('deploy')} disabled={loading} className={btnClass('success')}>
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
