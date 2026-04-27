import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import * as matter from 'gray-matter';

// AGENT.md schema types
export interface Soul {
  persona: string;
  voice: string;
  communication: string;
}

export interface CorpusConvention {
  rule: string;
  check?: string;
}

export interface Corpus {
  path: string;
  type: string;
  conventions: string[];
}

export interface Action {
  allowed: string[];
  forbidden: string[];
}

export interface Quality {
  // YAML parses "broken_link_count: 0" into { broken_link_count: 0 },
  // but in the agent schema spec we also accept string forms.
  metrics: Array<string | Record<string, unknown>>;
}

export interface Stopping {
  condition: string;
  max_iterations: number;
  max_duration: string;
  checkpoint_every: number;
}

export interface EscalationRule {
  condition: string;
  action: string;
  review_queue?: string;
}

export interface Escalation {
  rules: EscalationRule[];
}

export interface Checkpoint {
  path: string;
  contains: string[];
}

export interface AgentState {
  name: string;
  type: string;
  soul: Soul;
  corpus: Corpus;
  actions: Action;
  quality: Quality;
  stopping: Stopping;
  escalation: Escalation;
  checkpoint: Checkpoint;
}

export interface AgentCheckpoint {
  agentName: string;
  iteration: number;
  corpusSnapshotHash: string;
  pendingActions: string[];
  startedAt: string;
  lastCheckpoint: string;
  qualityMetrics: Record<string, any>;
  status: 'running' | 'completed' | 'failed' | 'paused';
  result?: string;
}

export function parseAgentMd(content: string): AgentState {
  const parsed = matter(content);
  return parsed.data as unknown as AgentState;
}

export async function loadAgent(agentName: string): Promise<AgentState | null> {
  const agentPath = path.join(homedir(), '.hermes', 'agents', agentName, 'AGENT.md');
  try {
    const content = await fs.readFile(agentPath, 'utf-8');
    return parseAgentMd(content);
  } catch {
    return null;
  }
}

export async function loadAgentCheckpoint(agentName: string): Promise<AgentCheckpoint | null> {
  const agentDir = path.join(homedir(), '.hermes', 'agents', agentName);
  const agent = await loadAgent(agentName);
  if (!agent) return null;

  const checkpointPath = agent.checkpoint?.path 
    ? agent.checkpoint.path.replace('~', homedir())
    : path.join(agentDir, 'checkpoint.json');

  try {
    const content = await fs.readFile(checkpointPath, 'utf-8');
    return JSON.parse(content) as AgentCheckpoint;
  } catch {
    return null;
  }
}

export async function saveAgentCheckpoint(
  agentName: string,
  checkpoint: AgentCheckpoint
): Promise<void> {
  const agentDir = path.join(homedir(), '.hermes', 'agents', agentName);
  const agent = await loadAgent(agentName);
  if (!agent) throw new Error(`Agent ${agentName} not found`);

  const checkpointPath = agent.checkpoint?.path 
    ? agent.checkpoint.path.replace('~', homedir())
    : path.join(agentDir, 'checkpoint.json');

  await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
  await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
}

export async function createAgentScaffold(
  agentName: string,
  agentState: AgentState
): Promise<string> {
  const agentDir = path.join(homedir(), '.hermes', 'agents', agentName);
  const agentMdPath = path.join(agentDir, 'AGENT.md');

  // Create directories
  await fs.mkdir(agentDir, { recursive: true });
  
  const checkpointDir = agentState.checkpoint?.path
    ? path.dirname(agentState.checkpoint.path.replace('~', homedir()))
    : path.join(agentDir, 'checkpoint');
  await fs.mkdir(checkpointDir, { recursive: true });

  const logDir = path.join(agentDir, 'logs');
  await fs.mkdir(logDir, { recursive: true });

  // Generate AGENT.md
  const yamlHeader = matter.stringify('', agentState);
  const agentMdContent = `---\n${yamlHeader.split('---\n')[1]}---\n\n# ${agentName}\n\nAutonomous corpus steward agent.\n`;

  await fs.writeFile(agentMdPath, agentMdContent, 'utf-8');

  // Create initial checkpoint
  const initialCheckpoint: AgentCheckpoint = {
    agentName,
    iteration: 0,
    corpusSnapshotHash: '',
    pendingActions: [],
    startedAt: new Date().toISOString(),
    lastCheckpoint: new Date().toISOString(),
    qualityMetrics: {},
    status: 'running',
  };

  await saveAgentCheckpoint(agentName, initialCheckpoint);

  return agentDir;
}

export async function listAgents(): Promise<Array<{ name: string; status: string; lastRun?: string }>> {
  const agentsDir = path.join(homedir(), '.hermes', 'agents');
  const results: Array<{ name: string; status: string; lastRun?: string }> = [];

  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      const checkpointPath = path.join(agentsDir, entry.name, 'checkpoint.json');
      let status = 'unknown';
      let lastRun: string | undefined;

      try {
        const cp = await fs.readFile(checkpointPath, 'utf-8');
        const data = JSON.parse(cp) as AgentCheckpoint;
        status = data.status;
        lastRun = data.lastCheckpoint;
      } catch {
        // No checkpoint yet
      }

      results.push({ name: entry.name, status, lastRun });
    }
  } catch {
    // Agents directory doesn't exist yet
  }

  return results;
}
