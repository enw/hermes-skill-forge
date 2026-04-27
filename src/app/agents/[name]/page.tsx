import { loadAgent, loadAgentCheckpoint } from '@/lib/agent-state';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { RunAgentButton } from '@/components/run-agent-button';

export default async function AgentDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const agent = await loadAgent(name);
  
  if (!agent) {
    notFound();
  }

  const checkpoint = await loadAgentCheckpoint(name);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
          <p className="text-muted-foreground">Type: {agent.type}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/agents"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            Back to Agents
          </Link>
          <RunAgentButton agentName={name} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Soul</h2>
          <div className="space-y-2">
            <div><span className="text-sm font-medium">Persona:</span> {agent.soul.persona}</div>
            <div><span className="text-sm font-medium">Voice:</span> {agent.soul.voice}</div>
            <div><span className="text-sm font-medium">Communication:</span> {agent.soul.communication}</div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Corpus</h2>
          <div className="space-y-2">
            <div><span className="text-sm font-medium">Path:</span> <code className="text-sm bg-muted px-1 py-0.5 rounded">{agent.corpus.path}</code></div>
            <div><span className="text-sm font-medium">Type:</span> {agent.corpus.type}</div>
            <div>
              <span className="text-sm font-medium">Conventions:</span>
              <ul className="text-sm mt-1 space-y-1">
                {agent.corpus.conventions.map((c, i) => (
                  <li key={i} className="text-muted-foreground">• {c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Quality Metrics</h2>
          <ul className="space-y-2">
            {agent.quality.metrics.map((m, i) => {
              if (typeof m === 'string') return <li key={i} className="text-sm">• {m}</li>;
              const [name, value] = Object.entries(m)[0] || ['', ''];
              return <li key={i} className="text-sm">• {name}: {String(value)}</li>;
            })}
          </ul>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div>
            <div className="mb-3">
              <span className="text-sm font-medium text-green-600">Allowed:</span>
              <ul className="text-sm mt-1 space-y-1">
                {agent.actions.allowed.map((a, i) => (
                  <li key={i} className="text-muted-foreground">✅ {a}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-sm font-medium text-red-600">Forbidden:</span>
              <ul className="text-sm mt-1 space-y-1">
                {agent.actions.forbidden.map((a, i) => (
                  <li key={i} className="text-muted-foreground">❌ {a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Current State</h2>
        {checkpoint ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <span className="text-sm font-medium">Status:</span>
              <div className="text-2xl font-bold mt-1 capitalize">{checkpoint.status}</div>
            </div>
            <div>
              <span className="text-sm font-medium">Iteration:</span>
              <div className="text-2xl font-bold mt-1">{checkpoint.iteration} / {agent.stopping.max_iterations}</div>
            </div>
            <div>
              <span className="text-sm font-medium">Last Checkpoint:</span>
              <div className="text-lg font-medium mt-1">
                {format(new Date(checkpoint.lastCheckpoint), 'PPpp')}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No checkpoint data yet. Run the agent to start.</p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Agent Definition</h2>
        <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-96">
          {JSON.stringify(agent, null, 2)}
        </pre>
      </div>
    </div>
  );
}
