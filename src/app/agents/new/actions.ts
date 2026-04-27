'use server';

import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { createAgentScaffold, AgentState } from '@/lib/agent-state';

const agentSchema = z.object({
  name: z.string().describe('Kebab-case agent name, e.g., vault-gardener'),
  type: z.string().describe('Agent type: corpus-steward, watcher, researcher'),
  soulPersona: z.string().describe('The agent\'s persona in a short phrase'),
  soulVoice: z.string().describe('How the agent communicates'),
  soulCommunication: z.string().describe('Communication/output format preference'),
  corpusPath: z.string().describe('Path to the corpus, e.g., ~/Documents/Areas/vault'),
  corpusType: z.string().describe('Corpus type: obsidian, skills, codebase'),
  corpusConventions: z.array(z.string()).describe('List of conventions the agent should enforce'),
  actionsAllowed: z.array(z.string()).describe('Actions the agent is allowed to take'),
  actionsForbidden: z.array(z.string()).describe('Actions the agent must NOT take'),
  qualityMetrics: z.array(z.string()).describe('Quality metrics with thresholds, e.g., broken_link_count: 0'),
  stoppingCondition: z.string().describe('Natural language stopping condition'),
  maxIterations: z.number().int().positive(),
  maxDuration: z.string().describe('Duration like 30m, 1h'),
  checkpointEvery: z.number().int().positive(),
  escalationRules: z.array(z.object({
    condition: z.string(),
    action: z.string(),
    reviewQueue: z.string().optional(),
  })),
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
    system: `You are Hermes Agent Forge, an expert autonomous-agent design assistant. You help users create "corpus steward" agents that scan a knowledge corpus (Obsidian vault, skill directory, codebase), assess quality, fix issues, and run until a quality threshold is met.

Ask focused questions to understand:
1. What corpus they want to manage (path, type)
2. What quality means for them (metrics, thresholds)
3. What actions the agent should take (and what it should NEVER do)
4. When the agent should stop (stopping conditions)
5. What should trigger escalation to human review

Keep questions short and specific. Build toward a complete AGENT.md spec.`,
    messages,
  });
  return text;
}

export async function generateAgent(messages: Array<{role: 'user'|'assistant', content: string}>) {
  checkApiKey();
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    system: `You are an AGENT.md generator. Based on the conversation, produce a complete agent specification following the Corpus Steward pattern.

Map the user's requirements to the exact schema fields. Infer reasonable defaults for:
- max_iterations: 50 (unless user specifies)
- max_duration: 30m (unless user specifies)
- checkpoint_every: 5
- escalation: always have a review_queue for ambiguous cases

Ensure all generated strings are concrete and actionable. No placeholders.`,
    schema: agentSchema,
    messages,
  });

  // Build the full AgentState
  const agentState: AgentState = {
    name: object.name,
    type: object.type,
    soul: {
      persona: object.soulPersona,
      voice: object.soulVoice,
      communication: object.soulCommunication,
    },
    corpus: {
      path: object.corpusPath,
      type: object.corpusType,
      conventions: object.corpusConventions,
    },
    actions: {
      allowed: object.actionsAllowed,
      forbidden: object.actionsForbidden,
    },
    quality: {
      metrics: object.qualityMetrics,
    },
    stopping: {
      condition: object.stoppingCondition,
      max_iterations: object.maxIterations,
      max_duration: object.maxDuration,
      checkpoint_every: object.checkpointEvery,
    },
    escalation: {
      rules: object.escalationRules,
    },
    checkpoint: {
      path: `~/Library/Caches/hermes/agents/${object.name}/state.json`,
      contains: ['iteration', 'corpus_snapshot_hash', 'pending_actions', 'review_queue'],
    },
  };

  return agentState;
}

export async function saveAgent(name: string, agentState: AgentState) {
  const agentDir = await createAgentScaffold(name, agentState);
  return { success: true, path: agentDir };
}
