'use server';

import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { createAgentScaffold, BDIAgent } from '@/lib/agent-state';

const bdiAgentSchema = z.object({
  name: z.string().describe('Kebab-case agent name, e.g., vault-gardener'),
  type: z.string().describe('Agent type, e.g., corpus-steward, watcher, researcher'),
  personality: z.string().describe("The agent's persona — a short descriptive phrase"),
  voice: z.string().describe('How the agent communicates — e.g., quiet, systematic, no-nonsense'),
  goals: z.array(z.string()).describe('Concrete goals with measurable targets, e.g., "broken_link_count must be 0"'),
  priority: z.string().optional().describe('Overall priority or guiding principle'),
  successCriteria: z.string().optional().describe('When the agent should consider itself done'),
  constraints: z.array(z.string()).describe('Behavioral constraints — what the agent must respect while acting'),
  planningStrategy: z.string().optional().describe('How the agent should prioritize its work'),
  beliefSchema: z.array(z.string()).describe('State fields to track, e.g., "total_notes: number", "broken_links: number"'),
  statePath: z.string().describe('Path to persist BDI state, e.g., ~/.cache/hermes/agents/vault-gardener/bdi-state.json'),
  toolsAllowed: z.array(z.string()).describe('Tool names the agent may use: terminal, file, search_files, read_file, write_file, patch, web_search, web_extract'),
  toolsForbidden: z.array(z.string()).describe('Tool names the agent must NOT use: clarify, delegate_task'),
  schedule: z.string().describe('Cron schedule, e.g., "every 6h", "0 9 * * *"'),
  model: z.string().optional().describe('Model to use, e.g., "anthropic/claude-sonnet-4"'),
  profile: z.string().optional().describe('Hermes profile to run under, e.g., "default", "work", "research"'),
});

function checkApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set. Export it in your shell or add it to .env.local');
  }
}

export async function interviewAgent(messages: Array<{role: 'user'|'assistant', content: string}>) {
  checkApiKey();
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: `You are Hermes Agent Forge, an expert BDI (Belief-Desire-Intention) agent design assistant. You help users create autonomous agents that run on a periodic heartbeat inside Hermes.

WORKFLOW: You interview the user about their agent requirements. After enough detail is gathered, the user clicks "Forge Agent" which generates a complete AGENT.md file, then "Save Agent" writes it to disk. You DO NOT write files yourself — the UI handles that after the interview is complete.

Ask focused questions to understand:
1. What domain the agent operates in (what it observes/scans)
2. What its goals are — concrete, measurable targets (desires)
3. What constraints it must follow — what it must not do
4. What tools it needs to accomplish its work
5. How often it should run (heartbeat schedule)

RESPONSE FORMAT — ALWAYS:
1. Start by confirming what the user said in one short paragraph.
2. Make intelligent assumptions about any missing detail (schedule, tools, paths, model, etc.). State each assumption explicitly in a numbered list.
3. End with: "Any corrections?" and list the items you want the user to confirm or fix as a numbered list.
4. Use numbered lists for everything — no bullet points anywhere.
5. Keep it short: 1-3 assumptions and 1-3 correction items per turn.
6. When you have enough detail, say: "Ready to forge this agent? Click the Forge Agent button."

Build toward a complete BDI agent spec with beliefs schema, desires, intentions constraints, allowed tools, and heartbeat.`,
    messages,
  });
  return text;
}

export async function generateAgent(messages: Array<{role: 'user'|'assistant', content: string}>) {
  checkApiKey();
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    system: `You are an AGENT.md generator for BDI (Belief-Desire-Intention) agents. Based on the conversation, produce a complete agent spec.

Map the user's requirements to the exact schema fields. Key principles:
- Goals should be concrete and measurable (not "keep vault clean" but "broken_link_count must be 0")
- Belief schema should list the specific state fields the agent tracks
- Constraints should prevent destructive or unsafe behavior
- Schedule should match the domain — vault maintenance needs hours, not seconds
- Allowed tools should be minimal — only what the agent actually needs
- Forbidden tools should always include "clarify" (agents decide, they don't ask)

Infer reasonable defaults:
- Schedule: every 6h for maintenance, every 1h for monitoring
- State path: ~/.cache/hermes/agents/{name}/bdi-state.json
- Model: anthropic/claude-sonnet-4 (if user has no preference)`,
    schema: bdiAgentSchema,
    messages,
  });

  // Build the full BDIAgent
  const agent: Omit<BDIAgent, 'name'> = {
    type: object.type,
    soul: {
      persona: object.personality,
      voice: object.voice,
    },
    desires: {
      goals: object.goals,
      ...(object.priority ? { priority: object.priority } : {}),
      ...(object.successCriteria ? { successCriteria: object.successCriteria } : {}),
    },
    intentions: {
      constraints: object.constraints,
      ...(object.planningStrategy ? { planningStrategy: object.planningStrategy } : {}),
    },
    beliefs: {
      schema: object.beliefSchema,
      statePath: object.statePath,
    },
    tools: {
      allowed: object.toolsAllowed,
      forbidden: object.toolsForbidden,
    },
    heartbeat: {
      schedule: object.schedule,
      ...(object.model ? { model: object.model } : {}),
      ...(object.profile ? { profile: object.profile } : {}),
    },
  };

  return agent;
}

export async function saveAgent(name: string, agent: Omit<BDIAgent, 'name'>) {
  const agentDir = await createAgentScaffold(name, agent);
  return { success: true, path: agentDir };
}
