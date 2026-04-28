'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RunAgentButton } from '@/components/run-agent-button';
import type { BDIAgent, BDIState } from '@/lib/agent-state';

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
    <div className="space-y-6">
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

      {/* Control Bar */}
      <div className="rounded-lg border bg-card p-4">
        <RunAgentButton agentName={agent.name} agentProfile={agent.heartbeat?.profile} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Desires */}
        {agent.desires && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Desires (Goals)</h2>
            <ul className="space-y-2">
              {agent.desires.goals.map((g, i) => (
                <li key={i} className="text-sm text-muted-foreground">&bull; {g}</li>
              ))}
            </ul>
            {agent.desires.priority && (
              <p className="mt-3 text-sm text-muted-foreground"><span className="font-medium">Priority:</span> {agent.desires.priority}</p>
            )}
            {agent.desires.successCriteria && (
              <p className="mt-2 text-sm text-muted-foreground"><span className="font-medium">Success:</span> {agent.desires.successCriteria}</p>
            )}
          </div>
        )}

        {/* Intentions */}
        {agent.intentions && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Intentions (Constraints)</h2>
            <ul className="space-y-2">
              {agent.intentions.constraints.map((c, i) => (
                <li key={i} className="text-sm text-muted-foreground">&bull; {c}</li>
              ))}
            </ul>
            {agent.intentions.planningStrategy && (
              <p className="mt-3 text-sm text-muted-foreground"><span className="font-medium">Strategy:</span> {agent.intentions.planningStrategy}</p>
            )}
          </div>
        )}

        {/* Beliefs */}
        {agent.beliefs && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Beliefs (State Schema)</h2>
            <ul className="space-y-1">
              {agent.beliefs.schema.map((s, i) => (
                <li key={i} className="text-sm font-mono bg-muted px-2 py-1 rounded">{s}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tools */}
        {agent.tools && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Tools</h2>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Allowed:</span>{' '}
                {agent.tools.allowed.map(t => <code key={t} className="bg-muted px-1 py-0.5 rounded text-xs mr-1">{t}</code>)}
              </div>
              {agent.tools.forbidden.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Forbidden:</span>{' '}
                  {agent.tools.forbidden.map(t => <code key={t} className="bg-red-500/10 px-1 py-0.5 rounded text-xs text-red-400 mr-1">{t}</code>)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Heartbeat */}
      {agent.heartbeat && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-2">Heartbeat</h2>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Schedule:</span> <code className="bg-muted px-1 py-0.5 rounded">{agent.heartbeat.schedule}</code>
            {agent.heartbeat.model && <span className="ml-4"><span className="font-medium">Model:</span> {agent.heartbeat.model}</span>}
            {agent.heartbeat.profile && <span className="ml-4"><span className="font-medium">Profile:</span> {agent.heartbeat.profile}</span>}
          </div>
        </div>
      )}

      {/* Live State */}
      {state && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-2">Live State</h2>
          <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-64">
            {JSON.stringify(state, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
