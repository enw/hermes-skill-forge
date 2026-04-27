import { BDIAgent, BDIState } from './agent-state';

// Map of AGENT.md tool names to Hermes toolset names
export const TOOLSET_MAP: Record<string, string> = {
  'terminal': 'terminal',
  'file': 'file',
  'search_files': 'file',
  'read_file': 'file',
  'write_file': 'file',
  'patch': 'file',
  'web_search': 'web',
  'web_extract': 'web',
  'browser_navigate': 'browser',
  'browser_click': 'browser',
  'browser_type': 'browser',
  'browser_snapshot': 'browser',
  'browser_scroll': 'browser',
  'browser_press': 'browser',
  'browser_back': 'browser',
  'browser_console': 'browser',
  'browser_vision': 'browser',
  'browser_get_images': 'browser',
  'delegate_task': 'delegation',
  'cronjob': 'cronjob',
  'memory': 'memory',
  'session_search': 'session_search',
  'skill_manage': 'skills',
  'skill_view': 'skills',
  'skills_list': 'skills',
  'vision_analyze': 'vision',
  'image_generate': 'image_gen',
  'text_to_speech': 'tts',
};

export function extractToolsets(allowedTools: string[]): string[] {
  const toolsets = new Set<string>();
  for (const tool of allowedTools) {
    const ts = TOOLSET_MAP[tool];
    if (ts) toolsets.add(ts);
  }
  return Array.from(toolsets);
}

export function generateBDIPrompt(agent: BDIAgent, prevState: BDIState | null): string {
  const prevStateBlock = prevState ? `
### PREVIOUS STATE (from last tick)
\`\`\`json
${JSON.stringify(prevState, null, 2)}
\`\`\`
` : '';

  return `# BDI Agent: ${agent.name}

You are ${agent.soul.persona}. Your voice: ${agent.soul.voice}.

## DESIRES (your goals)
${agent.desires.goals.map(g => `- ${g}`).join('\n')}
${agent.desires.priority ? `\n**Priority:** ${agent.desires.priority}` : ''}
${agent.desires.successCriteria ? `\n**Success when:** ${agent.desires.successCriteria}` : ''}

## INTENTIONS (your constraints)
${agent.intentions.constraints.map(c => `- ${c}`).join('\n')}
${agent.intentions.planningStrategy ? `\n**Strategy:** ${agent.intentions.planningStrategy}` : ''}

## ALLOWED TOOLS
${agent.tools.allowed.join(', ')}

## FORBIDDEN ACTIONS
${agent.tools.forbidden.join(', ')}

## BELIEFS SCHEMA (state fields you track)
${agent.beliefs.schema.map(s => `- ${s}`).join('\n')}

${prevStateBlock}

---

## INSTRUCTIONS

Execute one complete BDI cycle:

### Step 1: PERCEIVE — Update your beliefs
Use your available tools to scan the current state of your domain. Observe reality. Update your worldState with concrete, measurable findings.

### Step 2: DELIBERATE — Compare beliefs vs desires
- Are any goals now met?
- What's the gap between current beliefs and desired state?
- Given what you see, should you adjust your plan?
- Pick the next best 1-3 actions toward your goals.

### Step 3: ACT — Execute on your intentions
Take concrete actions using your allowed tools. Do NOT ask questions — decide and act. Respect all intention constraints and forbidden actions. If you encounter something ambiguous, log it in observations rather than asking.

### Step 4: PERSIST — Save your updated BDI state
Write a JSON file to ${agent.beliefs.statePath} with this exact structure:
\`\`\`json
{
  "beliefs": {
    "worldState": { /* your observed state numbers/facts */ },
    "lastObserved": "${new Date().toISOString()}",
    "observations": ["what you saw this tick"]
  },
  "intentions": {
    "activePlan": "what you're working on next",
    "nextActions": ["1-3 specific next actions or empty if done"],
    "progress": "quantified progress toward goals"
  },
  "tickCount": ${prevState ? prevState.tickCount + 1 : 1},
  "goalsMet": true/false,
  "lastTickResult": "2-3 sentence summary of what happened this tick"
}
\`\`\`

Use the write_file tool (or your available file tool) to persist this state.

### Step 5: REPORT
In your final response, print a brief summary: what you observed, what you did, and current goal progress.
`;
}

export function generateAgentInstallPrompt(agent: BDIAgent): string {
  return `Set up this BDI agent as an autonomous agent in Hermes.

Agent name: ${agent.name}
Type: ${agent.type}

1. Create the AGENT.md file at ~/.hermes/agents/${agent.name}/AGENT.md with the full YAML frontmatter and BDI structure.

2. Create the initial BDI state file at ${agent.beliefs.statePath} with:
   - tickCount: 0
   - goalsMet: false
   - Empty beliefs/intentions

3. Deploy this as a Hermes cron job:
   - Name: agent-${agent.name}
   - Schedule: ${agent.heartbeat.schedule}
   - Model: ${agent.heartbeat.model || 'use default'}
   - Enabled toolsets: ${extractToolsets(agent.tools.allowed).join(', ')}
   - Prompt: The BDI cycle prompt (perceive → deliberate → act → persist → report)

The agent should run on its heartbeat, update its BDI state file each tick, and report results.`;
}
