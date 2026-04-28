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
  priority: z.string().describe('Overall priority or guiding principle. Use "none" if not applicable.'),
  successCriteria: z.string().describe('When the agent should consider itself done. Use "none" if ongoing.'),
  constraints: z.array(z.string()).describe('Behavioral constraints — what the agent must respect while acting'),
  planningStrategy: z.string().describe('How the agent should prioritize its work. Use "none" if not applicable.'),
  beliefSchema: z.array(z.string()).describe('State fields to track, e.g., "total_notes: number", "broken_links: number"'),
  statePath: z.string().describe('Path to persist BDI state, e.g., ~/.cache/hermes/agents/vault-gardener/bdi-state.json'),
  toolsAllowed: z.array(z.string()).describe('Tool names the agent may use: terminal, file, search_files, read_file, write_file, patch, web_search, web_extract'),
  toolsForbidden: z.array(z.string()).describe('Tool names the agent must NOT use: clarify, delegate_task'),
  schedule: z.string().describe('Cron schedule, e.g., "every 6h", "0 9 * * *"'),
  model: z.string().describe('Model to use. Use "default" if no preference.'),
  profile: z.string().describe('Hermes profile to run under. Use "default" if not specified.'),
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

RESPONSE FORMAT — ALWAYS. Match this exact structure:

You've set [one-sentence summary of what the user said].

Assumptions:
1. [assumption 1]
2. [assumption 2]
3. [assumption 3]

Any objections? Answer any questions, or do you trust me to build now?

Rules:
- One paragraph confirmation. Always start with "You've set...".
- "Assumptions:" header followed by a numbered list (1., 2., 3.). Max 3.
- Make intelligent assumptions about missing BDI details (schedule, tools, paths, model, constraints).
- End with: "Any objections? Answer any questions, or do you trust me to build now?"
- If you need clarifying info, weave it into the assumptions (e.g. "1. The agent should check ~/tmp — correct?").
- When you have enough detail, say only: "Ready to forge this agent? Click the Forge Agent button."

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
      ...(object.priority !== 'none' ? { priority: object.priority } : {}),
      ...(object.successCriteria !== 'none' ? { successCriteria: object.successCriteria } : {}),
    },
    intentions: {
      constraints: object.constraints,
      ...(object.planningStrategy !== 'none' ? { planningStrategy: object.planningStrategy } : {}),
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
      ...(object.model !== 'default' ? { model: object.model } : {}),
      ...(object.profile !== 'default' ? { profile: object.profile } : {}),
    },
  };

  return agent;
}

export async function saveAgent(name: string, agent: Omit<BDIAgent, 'name'>) {
  const agentDir = await createAgentScaffold(name, agent);
  return { success: true, path: agentDir };
}
