import { NextRequest, NextResponse } from 'next/server';
import { loadAgent, loadBDIState, saveBDIState, BDIState } from '@/lib/agent-state';
import { generateBDIPrompt, extractToolsets } from '@/lib/cron-prompt-template';
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
