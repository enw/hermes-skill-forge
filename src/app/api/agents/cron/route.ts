import { NextRequest, NextResponse } from 'next/server';
import { loadAgent, loadBDIState, saveBDIState, initializeBDIState, BDIState } from '@/lib/agent-state';
import { generateBDIPrompt, extractToolsets } from '@/lib/cron-prompt-template';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

function hermesHome(): string {
  return process.env.HOME || '/root';
}

function safeExec(cmd: string): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
    return { success: true, output: output.trim() };
  } catch (err: any) {
    return { success: false, output: err.stdout || err.stderr || String(err) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentName, action } = body;

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
          await initializeBDIState(agentName);
        }

        // Write prompt to temp file for cronjob create
        const promptFile = `/tmp/bdi-prompt-${agentName}.txt`;
        await fs.writeFile(promptFile, prompt);

        // Build the hermes cron create command
        // hermes cron create SCHEDULE [PROMPT] --name NAME
        const schedule = agent.heartbeat.schedule;
        const profile = agent.heartbeat.profile;
        const profilePrefix = profile && profile !== 'default' ? `hermes --profile "${profile}"` : 'hermes';

        let cmd = `${profilePrefix} cron create "${schedule}" --name "${jobName}"`;
        
        // Prompt is positional
        cmd += ` "$(cat ${promptFile})"`;

        const result = safeExec(cmd);
        if (!result.success) {
          return NextResponse.json({ success: false, message: `Failed to create cron job: ${result.output}` }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: `Agent '${agentName}' deployed as cron job '${jobName}' on schedule '${schedule}'`,
        });
      }

      case 'run': {
        const result = safeExec(`hermes cron run "${jobName}"`);
        if (!result.success) {
          return NextResponse.json({ success: false, message: `Failed to trigger: ${result.output}` }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: `Triggered agent '${agentName}'` });
      }

      case 'stop': {
        const result = safeExec(`hermes cron remove "${jobName}"`);
        if (!result.success) {
          return NextResponse.json({ success: false, message: `Failed to remove: ${result.output}` }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: `Agent '${agentName}' stopped and cron job removed` });
      }

      case 'reset': {
        // Clear BDI state but keep the cron job
        try {
          await initializeBDIState(agentName);
          return NextResponse.json({ success: true, message: `Agent '${agentName}' state reset` });
        } catch (err: any) {
          return NextResponse.json({ success: false, message: `Failed to reset: ${String(err)}` }, { status: 500 });
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
      const result = safeExec(`hermes cron list 2>&1`);
      const isActive = result.success && result.output.includes(jobName);
      return NextResponse.json({ success: true, agent: agentName, isDeployed: isActive });
    }

    // List all agent cron jobs
    const result = safeExec(`hermes cron list 2>&1`);
    return NextResponse.json({ success: true, output: result.output });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  }
}
