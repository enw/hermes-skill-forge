'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { BDIAgent, BDIState } from '@/lib/agent-state';
import { AgentEditor } from '@/components/agent-editor';

async function safeJson<T>(response: Response, fallback: T): Promise<T> {
  if (!response.ok) return fallback;
  const text = await response.text();
  if (!text.startsWith('{') && !text.startsWith('[')) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export default function AgentDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const [name, setName] = useState('');
  const [agent, setAgent] = useState<BDIAgent | null>(null);
  const [state, setState] = useState<BDIState | null>(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const resolved = await params;
      setName(resolved.name);

      const [agentRes, stateRes, cronRes] = await Promise.all([
        fetch(`/api/agents/list?agent=${resolved.name}`),
        fetch(`/api/agents/state?agent=${resolved.name}`),
        fetch(`/api/agents/cron?agent=${resolved.name}`),
      ]);

      const agentData = await safeJson(agentRes, { agent: null });
      const stateData = await safeJson(stateRes, { state: null });
      const cronData = await safeJson(cronRes, { success: false, isDeployed: false });

      setAgent(agentData.agent);
      setState(stateData.state);
      setIsDeployed(cronData.isDeployed || false);
      setLoading(false);
    };
    load();
  }, [params]);

  const handleDeploy = async () => {
    if (!agent) return;
    try {
      const response = await fetch(`/api/agents/cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: agent.name, action: 'deploy' })
      });
      if (response.ok) {
        setIsDeployed(true);
      }
    } catch (error) {
      console.error('Deploy error:', error);
    }
  };

  const handleRun = async () => {
    if (!agent) return;
    try {
      const response = await fetch(`/api/agents/cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: agent.name, action: 'run' })
      });
      if (response.ok) {
        // Optionally refresh state
        const stateRes = await fetch(`/api/agents/state?agent=${agent.name}`);
        const stateData = await safeJson(stateRes, { state: null });
        setState(stateData.state);
      }
    } catch (error) {
      console.error('Run error:', error);
    }
  };

  const handleStop = async () => {
    if (!agent) return;
    try {
      const response = await fetch(`/api/agents/cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName: agent.name, action: 'stop' })
      });
      if (response.ok) {
        setIsDeployed(false);
      }
    } catch (error) {
      console.error('Stop error:', error);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading agent...</div>;
  }

  if (!agent) {
    return (
      <div className="py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Agent Not Found</h1>
        <p className="text-muted-foreground">No AGENT.md found for '{name}'</p>
        <Link href="/agents" className="text-primary hover:underline">&larr; Back to agents</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/agents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
          isDeployed ? 'bg-green-500/10 text-green-400 ring-1 ring-inset ring-green-500/20' : 'bg-muted text-muted-foreground'
        }`}>
          {isDeployed ? 'Deployed' : 'Not deployed'}
        </span>
      </div>

      <AgentEditor
        agentName={agent.name}
        agentData={agent}
        isDeployed={isDeployed}
        onDeploy={handleDeploy}
        onRun={handleRun}
        onStop={handleStop}
      />

      {/* State Display (read-only) */}
      {state && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-2">Live State</h2>
          <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-48">
            {JSON.stringify(state, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
