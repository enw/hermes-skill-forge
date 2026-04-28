import { NextRequest, NextResponse } from 'next/server';
import { loadAgent, loadBDIState, saveBDIState, BDIState } from '@/lib/agent-state';
import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';

function hermesHome(): string {
  return process.env.HOME || '/root';
}

function safeExec(file: string, args: string[]): { success: boolean; output: string } {
  try {
    const output = execFileSync(file, args, { encoding: 'utf-8', timeout: 30000 });
    return { success: true, output: output.trim() };
  } catch (err: any) {
    return { success: false, output: err.stdout || err.stderr || String(err) };
  }
}

function hermesBinary(): string {
  return 'hermes';
}

// Generate BDI prompt from agent and previous state
function generateBDIPrompt(agent: any, prevState: BDIState | null): string {
  const prevStateBlock = prevState ? `\n### PREVIOUS STATE (from last tick)\n${JSON.stringify(prevState, null, 2)}` : '';
  
  return `# BDIAgent: ${agent.name}

You are ${agent.soul.persona}. Your voice: ${agent.soul.voice}.

## DESIRES (your goals)
${agent.desires.goals.map(g => `- ${g}`).join('\n')}
${agent.desires.priority ? `\nPriority: ${agent.desires.priority}` : ''}
${agent.desires.successCriteria ? `\nSuccess when: ${agent.desires.successCriteria}` : ''}

## INTENTIONS CONSTRAINTS
${agent.intentions.constraints.map(c => `- ${c}`).join('\n')}
${agent.intentions.planningStrategy ? `\nStrategy: ${agent.intentions.planningStrategy}` : ''}

## ALLOWED TOOLS
${agent.tools.allowed.join(', ')}

## FORBIDDEN
${agent.tools.forbidden.join(', ')}

## BELIEFS SCHEMA
Track the following state fields:
${agent.beliefs.schema.map(s => `- ${s}`).join('\n')}

${prevStateBlock}

---

## INSTRUCTIONS

Execute one BDI cycle:

### 1. PERCEIVE — Update your beliefs
Use available tools to scan the current state of your domain. Update the worldState with real observations.

### 2. DELIBERATE — Compare beliefs vs desires
- Are any goals met?
- Is there a gap between current beliefs and desired state?
- Should you change your active plan based on what you see?

### 3. ACT — Execute on your intentions
Take 1-3 concrete actions using your allowed tools. Do not ask questions — decide and act.
Respect all intention constraints and forbidden actions.

### 4. PERSIST — Save your updated BDI state
Write a JSON file to ${agent.beliefs.statePath} with this exact structure:
{
  "beliefs": {
    "worldState": { ... },
    "lastObserved": "<ISO timestamp>",
    "observations": ["what you observed this tick"]
  },
  "intentions": {
    "activePlan": "what you're working on next",
    "nextActions": ["1-3 specific next actions"],
    "progress": "quantified progress toward goals"
  },
  "tickCount": ${prevState ? prevState.tickCount + 1 : 1},
  "goalsMet": true/false,
  "lastTickResult": "brief summary of what happened this tick"
}

### 5. REPORT
In your final response, print a 2-3 line summary: what you observed, what you did, and goal progress.`;
}

// Map agent tool names to Hermes toolset names
const TOOLSET_MAP: Record<string, string> = {
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
  'delegate_task': 'delegation',
};

function extractToolsets(allowedTools: string[]): string[] {
  const toolsets = new Set<string>();
  for (const tool of allowedTools) {
    const ts = TOOLSET_MAP[tool];
    if (ts) toolsets.add(ts);
  }
  return Array.from(toolsets);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentName, action, profile } = body;

    if (!agentName || !action) {
      return NextResponse.json({ success: false, message: 'agentName and action required' }, { status: 400 });
    }

    const agent = await loadAgent(agentName);
    if (!agent) {
      return NextResponse.json({ success: false, message: `Agent '${agentName}' not found` }, { status: 404 });
    }

    const jobName = `agent-${agentName}`;

    switch (action) {
      case 'deploy': {
        // Generate the BDI prompt
        if (!agent.beliefs) {
          return NextResponse.json({ success: false, message: `Agent '${agentName}' has no beliefs config` }, { status: 400 });
        }
        if (!agent.heartbeat?.schedule) {
          return NextResponse.json({ success: false, message: `Agent '${agentName}' has no heartbeat schedule` }, { status: 400 });
        }

        const prevState = await loadBDIState(agentName);
        const prompt = generateBDIPrompt(agent, prevState);
        const allowedTools = agent.tools?.allowed ?? [];
        const toolsets = extractToolsets(allowedTools);

        // Create initial state if it doesn't exist
        const statePath = agent.beliefs.statePath.replace('~', hermesHome());
        const stateExists = await fs.access(statePath).then(() => true).catch(() => false);
        if (!stateExists) {
          const initialState: BDIState = {
            beliefs: { worldState: {}, lastObserved: new Date().toISOString(), observations: [] },
            intentions: { activePlan: '', nextActions: [], progress: '' },
            tickCount: 0,
            goalsMet: false,
            lastTickResult: null,
            lastCronRunId: null,
          };
          await saveBDIState(agentName, initialState);
        }

        const schedule = agent.heartbeat.schedule;
        const deployProfile = profile || agent.heartbeat?.profile;

        // Build args: hermes [--profile P] cron create SCHEDULE PROMPT --name NAME
        const args: string[] = [];
        if (deployProfile && deployProfile !== 'default') {
          args.push('--profile', deployProfile);
        }
        args.push('cron', 'create', schedule, prompt, '--name', jobName);

        const result = safeExec(hermesBinary(), args);
        if (!result.success) {
          return NextResponse.json({ success: false, message: `Failed to create cron job: ${result.output}` }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: `Agent '${agentName}' deployed as cron job '${jobName}' on schedule '${schedule}'`,
        });
      }

      case 'run': {
        const result = safeExec(hermesBinary(), ['cron', 'run', jobName]);
        if (!result.success) {
          return NextResponse.json({ success: false, message: `Failed to trigger: ${result.output}` }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: `Triggered agent '${agentName}'` });
      }

      case 'stop': {
        const result = safeExec(hermesBinary(), ['cron', 'remove', jobName]);
        if (!result.success) {
          return NextResponse.json({ success: false, message: `Failed to remove: ${result.output}` }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: `Agent '${agentName}' stopped and cron job removed` });
      }

      case 'reset': {
        // Clear BDI state but keep the cron job
        try {
          const initialState: BDIState = {
            beliefs: { worldState: {}, lastObserved: new Date().toISOString(), observations: [] },
            intentions: { activePlan: '', nextActions: [], progress: '' },
            tickCount: 0,
            goalsMet: false,
            lastTickResult: null,
            lastCronRunId: null,
          };
          await saveBDIState(agentName, initialState);
          return NextResponse.json({ success: true, message: `Agent '${agentName}' state reset` });
        } catch (err: any) {
          return NextResponse.json({ success: false, message: `Failed to reset: ` + String(err) }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentName = searchParams.get('agent');

    if (agentName) {
      // Check if this specific agent has a cron job
      const jobName = `agent-${agentName}`;
      const result = safeExec(hermesBinary(), ['cron', 'list']);
      const isActive = result.success && result.output.includes(jobName);
      return NextResponse.json({ success: true, agent: agentName, isDeployed: isActive });
    }

    // List all agent cron jobs
    const result = safeExec(hermesBinary(), ['cron', 'list']);
    return NextResponse.json({ success: true, output: result.output });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  }
}
