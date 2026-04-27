'use client';

import { useState, useCallback } from 'react';
import { formatDistanceToNow, format } from 'date-fns';

interface AgentInfo {
  name: string;
  status: string;
  lastRun?: string;
  iteration?: number;
  maxIterations?: number;
  qualityMetrics?: Record<string, number>;
  corpusType?: string;
  corpusPath?: string;
  startedAt?: string;
}

interface ActionResult {
  success: boolean;
  message: string;
  status: string;
}

export default function AgentDashboard({ initialAgents }: { initialAgents: AgentInfo[] }) {
  const [agents, setAgents] = useState<AgentInfo[]>(initialAgents);
  const [actionLoading, setActionLoading] = useState<Record<string, string | null>>({});
  const [lastResult, setLastResult] = useState<{ agentName: string; result: ActionResult } | null>(null);

  const execAction = useCallback(async (agentName: string, action: string) => {
    setActionLoading(prev => ({ ...prev, [agentName]: action }));
    setLastResult(null);

    const res = await fetch('/api/agents/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName, action }),
    });

    const result = (await res.json()) as ActionResult;
    setLastResult({ agentName, result });

    // Refresh agent list
    const refreshRes = await fetch('/api/agents');
    const refreshed = await refreshRes.json();
    setAgents(refreshed);

    setActionLoading(prev => ({ ...prev, [agentName]: null }));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Control Panel</h1>
          <p className="text-muted-foreground">
            Manage, monitor, and control autonomous agents.
          </p>
        </div>
      </div>

      {lastResult && (
        <div className={`rounded-md border p-4 ${
          lastResult.result.success
            ? 'border-green-600/30 bg-green-500/5'
            : 'border-red-600/30 bg-red-500/5'
        }`}>
          <p className="text-sm font-medium">
            {lastResult.agentName}: {lastResult.result.message}
          </p>
        </div>
      )}

      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No agents configured yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-muted-foreground">
            <div className="col-span-3">Agent</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Progress</div>
            <div className="col-span-2">Last Activity</div>
            <div className="col-span-1 text-right">Metrics</div>
            <div className="col-span-2 text-right">Controls</div>
          </div>

          {/* Agent rows */}
          {agents.map((agent) => (
            <div key={agent.name} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
              <div className="col-span-3">
                <div className="flex items-center gap-2">
                  <a href={`/agents/${agent.name}`} className="font-semibold hover:underline">
                    {agent.name}
                  </a>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {agent.corpusType} · {agent.corpusPath}
                </div>
              </div>

              <div className="col-span-2">
                <StatusBadge status={agent.status} />
              </div>

              <div className="col-span-2">
                {agent.iteration !== undefined ? (
                  <div>
                    <div className="text-sm font-medium">
                      {agent.iteration} / {agent.maxIterations || '?'}
                    </div>
                    <ProgressBar value={agent.iteration} max={agent.maxIterations || 50} />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              <div className="col-span-2">
                {agent.lastRun ? (
                  <div>
                    <div className="text-sm">
                      {formatDistanceToNow(new Date(agent.lastRun))} ago
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(agent.lastRun), 'PPpp')}
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Never</span>
                )}
              </div>

              <div className="col-span-1 text-right">
                {agent.qualityMetrics && Object.keys(agent.qualityMetrics).length > 0 ? (
                  <div className="text-xs space-y-0.5 text-right">
                    {Object.entries(agent.qualityMetrics).map(([k, v]) => (
                      <div key={k}>{k}: {v}</div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              <div className="col-span-2 flex justify-end gap-1">
                <ControlButton
                  label="▶"
                  tooltip="Run one iteration"
                  loading={actionLoading[agent.name] === 'run'}
                  disabled={agent.status === 'running' || !!actionLoading[agent.name]}
                  onClick={() => execAction(agent.name, 'run')}
                />
                <ControlButton
                  label="⏸"
                  tooltip="Pause"
                  loading={actionLoading[agent.name] === 'pause'}
                  disabled={agent.status !== 'running' || !!actionLoading[agent.name]}
                  onClick={() => execAction(agent.name, 'pause')}
                />
                <ControlButton
                  label="▶️"
                  tooltip="Resume"
                  loading={actionLoading[agent.name] === 'resume'}
                  disabled={agent.status !== 'paused' || !!actionLoading[agent.name]}
                  onClick={() => execAction(agent.name, 'resume')}
                />
                <ControlButton
                  label="↺"
                  tooltip="Reset"
                  loading={actionLoading[agent.name] === 'reset'}
                  disabled={agent.iteration === 0 || !!actionLoading[agent.name]}
                  onClick={() => execAction(agent.name, 'reset')}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    not_started: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.not_started}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full mt-1">
      <div
        className="h-full bg-primary rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ControlButton({
  label,
  tooltip,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  tooltip: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={tooltip}
      className="inline-flex items-center justify-center w-7 h-7 rounded text-sm transition-colors disabled:opacity-30 hover:bg-accent"
    >
      {loading ? '⋯' : label}
    </button>
  );
}
