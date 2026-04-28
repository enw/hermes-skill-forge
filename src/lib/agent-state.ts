import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as matter from 'gray-matter';

// BDI Agent definition (AGENT.md frontmatter)
export interface BDIDesires {
  goals: string[];
  priority?: string;
  successCriteria?: string;
}

export interface BDIIntentions {
  constraints: string[];
  planningStrategy?: string;
}

export interface BDIBeliefs {
  schema: string[];
  statePath: string;
}

export interface BDIAgent {
  name: string;
  type: string;
  soul: {
    persona: string;
    voice: string;
  };
  desires: BDIDesires;
  intentions: BDIIntentions;
  beliefs: BDIBeliefs;
  tools: {
    allowed: string[];
    forbidden: string[];
  };
  heartbeat: {
    schedule: string;
    model?: string;
    profile?: string;
  };
}

// Persisted BDI state (updated each cron tick)
export interface BDIState {
  beliefs: {
    worldState: Record<string, unknown>;
    lastObserved: string;
    observations: string[];
  };
  intentions: {
    activePlan: string;
    nextActions: string[];
    progress: string;
  };
  tickCount: number;
  goalsMet: boolean;
  lastTickResult?: string;
  lastCronRunId?: string;
}

// Zod schema for validation
export const BDIAgentSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  soul: z.object({
    persona: z.string().min(1),
    voice: z.string().min(1),
  }),
  desires: z.object({
    goals: z.array(z.string()).min(1),
    priority: z.string().optional(),
    successCriteria: z.string().optional(),
  }),
  intentions: z.object({
    constraints: z.array(z.string()),
    planningStrategy: z.string().optional(),
  }),
  beliefs: z.object({
    schema: z.array(z.string()),
    statePath: z.string(),
  }),
  tools: z.object({
    allowed: z.array(z.string()),
    forbidden: z.array(z.string()),
  }),
  heartbeat: z.object({
    schedule: z.string(),
    model: z.string().optional(),
    profile: z.string().optional(),
  }),
});

export async function loadAgent(agentName: string): Promise<BDIAgent | null> {
  const agentPath = path.join(process.env.HOME || '/Users/enw', '.hermes', 'agents', agentName, 'AGENT.md');
  try {
    const content = await fs.readFile(agentPath, 'utf-8');
    const { data } = matter(content);
    const result = BDIAgentSchema.safeParse(data);
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
  if (!agent) return null;
  
  const statePath = agent.beliefs.statePath.replace('~', process.env.HOME || '/Users/enw');
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content) as BDIState;
  } catch {
    return null;
  }
}

export async function saveBDIState(agentName: string, state: BDIState): Promise<void> {
  const agent = await loadAgent(agentName);
  if (!agent) throw new Error(`Agent ${agentName} not found`);
  
  const statePath = agent.beliefs.statePath.replace('~', process.env.HOME || '/Users/enw');
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function listAgents(): Promise<Array<{ name: string; type: string; status: string; lastTick?: string }>> {
  const agentsDir = path.join(process.env.HOME || '/Users/enw', '.hermes', 'agents');
  const results: Array<{ name: string; type: string; status: string; lastTick?: string }> = [];

  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      const agent = await loadAgent(entry.name);
      const state = await loadBDIState(entry.name);
      results.push({
        name: entry.name,
        type: agent?.type ?? 'unknown',
        status: state?.goalsMet ? 'completed' : state ? 'active' : 'not_started',
        lastTick: state?.beliefs.lastObserved,
      });
    }
  } catch {
    // Agents directory doesn't exist yet
  }

  return results;
}
