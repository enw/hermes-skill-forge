import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const matter = require('gray-matter');
import { z } from 'zod';

// ─── BDI Agent Schema (AGENT.md frontmatter) ───────────────────────

export const BDIDesiresSchema = z.object({
  goals: z.array(z.string()).min(1),
  priority: z.string().optional(),
  successCriteria: z.string().optional(),
});

export const BDIIntentionsSchema = z.object({
  constraints: z.array(z.string()),
  planningStrategy: z.string().optional(),
});

export const BDIBeliefsSchema = z.object({
  schema: z.array(z.string()),
  statePath: z.string(),
});

export const BDIAgentFullSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  soul: z.object({
    persona: z.string().min(1),
    voice: z.string().min(1),
  }),
  desires: BDIDesiresSchema.optional(),
  intentions: BDIIntentionsSchema.optional(),
  beliefs: BDIBeliefsSchema.optional(),
  tools: z.object({
    allowed: z.array(z.string()),
    forbidden: z.array(z.string()),
  }).optional(),
  heartbeat: z.object({
    schedule: z.string(),
    model: z.string().optional(),
    profile: z.string().optional(),
  }).optional(),
});

export type BDIAgent = z.infer<typeof BDIAgentFullSchema>;

// ─── Persisted BDI State (updated each cron tick) ──────────────────

export const BDIStateSchema = z.object({
  beliefs: z.object({
    worldState: z.record(z.unknown()),
    lastObserved: z.string(),
    observations: z.array(z.string()),
  }),
  intentions: z.object({
    activePlan: z.string(),
    nextActions: z.array(z.string()),
    progress: z.string(),
  }),
  tickCount: z.number(),
  goalsMet: z.boolean(),
  lastTickResult: z.string().optional(),
  lastCronRunId: z.string().optional(),
});

export type BDIState = z.infer<typeof BDIStateSchema>;

// ─── Agent listing (lightweight) ───────────────────────────────────

export interface AgentInfo {
  name: string;
  type: string;
  status: string;
  lastTick?: string;
}

// ─── Core functions ─────────────────────────────────────────────────

export async function loadAgent(agentName: string): Promise<BDIAgent | null> {
  const agentPath = path.join(homedir(), '.hermes', 'agents', agentName, 'AGENT.md');
  try {
    const content = await fs.readFile(agentPath, 'utf-8');
    const parsed = matter(content);
    const result = BDIAgentFullSchema.safeParse(parsed.data);
    if (!result.success) {
      console.error(`Invalid AGENT.md for ${agentName}:`, result.error);
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export async function loadBDIState(agentName: string): Promise<BDIState | null> {
  const agent = await loadAgent(agentName);
  if (!agent || !agent.beliefs) return null;

  const statePath = agent.beliefs.statePath.replace('~', homedir());
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content) as BDIState;
  } catch {
    return null;
  }
}

export async function saveBDIState(agentName: string, state: BDIState): Promise<void> {
  const agent = await loadAgent(agentName);
  if (!agent || !agent.beliefs) throw new Error(`Agent ${agentName} not found or missing beliefs config`);

  const statePath = agent.beliefs.statePath.replace('~', homedir());
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function initializeBDIState(agentName: string): Promise<string> {
  const agent = await loadAgent(agentName);
  if (!agent) throw new Error(`Agent ${agentName} not found`);

  const statePath = agent.beliefs.statePath.replace('~', homedir());
  const initialState: BDIState = {
    beliefs: {
      worldState: {},
      lastObserved: new Date().toISOString(),
      observations: [],
    },
    intentions: {
      activePlan: '',
      nextActions: [],
      progress: '',
    },
    tickCount: 0,
    goalsMet: false,
  };

  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(initialState, null, 2), 'utf-8');
  return statePath;
}

export async function listAgents(): Promise<AgentInfo[]> {
  const agentsDir = path.join(homedir(), '.hermes', 'agents');
  const results: AgentInfo[] = [];

  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      const agent = await loadAgent(entry.name);
      const state = await loadBDIState(entry.name);

      if (!agent) continue;

      results.push({
        name: entry.name,
        type: agent.type,
        status: state?.goalsMet ? 'completed' : state ? 'active' : 'not_started',
        lastTick: state?.beliefs.lastObserved,
      });
    }
  } catch {
    // Agents directory doesn't exist yet
  }

  return results;
}

export async function createAgentScaffold(
  agentName: string,
  agentState: Omit<BDIAgent, 'name'>
): Promise<string> {
  const agentDir = path.join(homedir(), '.hermes', 'agents', agentName);
  const agentMdPath = path.join(agentDir, 'AGENT.md');

  await fs.mkdir(agentDir, { recursive: true });

  const yamlHeader = matter.stringify('', { name: agentName, ...agentState });
  const agentMdContent = `---\n${yamlHeader.split('---\n')[1]}---\n\n# ${agentName}\n\nBDI Agent.\n`;

  await fs.writeFile(agentMdPath, agentMdContent, 'utf-8');

  // Initialize BDI state
  await initializeBDIState(agentName);

  return agentDir;
}
