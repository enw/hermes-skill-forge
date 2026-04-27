"use client";

import { useState } from 'react';
import { executeAgent } from '@/app/agents/actions';

export function RunAgentButton({ agentName }: { agentName: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message: string; actions: string[]; success: boolean } | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    const r = await executeAgent(agentName);
    setResult({ message: r.message, actions: r.actions, success: r.success });
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
      >
        {loading ? 'Running...' : 'Run Now'}
      </button>

      {result && (
        <div className={`rounded-md border p-4 ${result.success ? 'border-green-600/30 bg-green-500/5' : 'border-red-600/30 bg-red-500/5'}`}>
          <p className="text-sm font-medium mb-2">{result.message}</p>
          {result.actions.length > 0 && (
            <ul className="text-sm space-y-1 mt-2">
              {result.actions.map((a, i) => (
                <li key={i} className="font-mono">{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
