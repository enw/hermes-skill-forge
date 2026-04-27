import { loadAgent, listAgents, loadBDIState } from '@/lib/agent-state';

export default async function AgentsPage() {
  const agentsList = await listAgents();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">BDI Agent Forge</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agentsList.map(agent => (
          <a
            key={agent.name}
            href={`/agents/${agent.name}`}
            className="rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="text-lg font-semibold">{agent.name}</div>
            <div className="text-sm text-muted-foreground">{agent.type}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${
                agent.status === 'completed' ? 'bg-green-400' :
                agent.status === 'active' ? 'bg-yellow-400' : 'bg-muted-foreground/30'
              }`}></span>
              <span className="text-xs text-muted-foreground">{agent.status}</span>
            </div>
          </a>
        ))}
        <a
          href="/agents/new"
          className="rounded-lg border-2 border-dashed p-4 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors min-h-[80px]"
        >
          + New Agent
        </a>
      </div>
    </div>
  );
}
