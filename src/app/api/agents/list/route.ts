import { loadAgent, type BDIAgent } from '@/lib/agent-state';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agent = searchParams.get('agent');
  if (!agent) {
    // List all agents
    try {
      const agents = await listAllAgents();
      return NextResponse.json({ agents });
    } catch (err: any) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // Get specific agent's deployed status
  try {
    const agentData = await loadAgent(agent);
    if (!agentData) {
      return NextResponse.json({ agent: null, isDeployed: false });
    }
    return NextResponse.json({ agent: agentData, isDeployed: false }); // TODO: check cron
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

async function listAllAgents(): Promise<BDIAgent[]> {
  const { execSync } = require('child_process');
  const { homedir } = require('os');
  const home = homedir();
  const agentsDir = `${home}/.hermes/agents`;
  
  try {
    const result = execSync(`ls -1 "${agentsDir}" 2>/dev/null || true`, { encoding: 'utf8' });
    const entries = result.trim().split('\n').filter(Boolean);
    const agents: BDIAgent[] = [];
    
    for (const entry of entries) {
      try {
        const ag = await loadAgent(entry);
        if (ag) agents.push(ag);
      } catch {
        // skip non-agent dirs
      }
    }
    return agents;
  } catch {
    return [];
  }
}
