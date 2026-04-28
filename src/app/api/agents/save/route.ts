import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as matter from 'gray-matter';
import { BDIAgentSchema } from '@/lib/agent-state';

export async function POST(request: NextRequest) {
  try {
    const { agentName, content } = await request.json();
    
    if (!agentName || !content) {
      return NextResponse.json(
        { success: false, message: 'agentName and content required' },
        { status: 400 }
      );
    }

    // Parse and validate the AGENT.md content
    const { data } = matter(content);
    const result = BDIAgentSchema.safeParse(data);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid agent definition', errors: result.error.errors },
        { status: 400 }
      );
    }

    const agentDir = path.join(process.env.HOME || '/Users/enw', '.hermes', 'agents', agentName);
    await fs.mkdir(agentDir, { recursive: true });

    const filePath = path.join(agentDir, 'AGENT.md');
    await fs.writeFile(filePath, content, 'utf-8');

    // Also create a state file if it doesn't exist
    const statePath = path.join(agentDir, 'state.json');
    const initialState = {
      beliefs: { worldState: {}, lastObserved: new Date().toISOString(), observations: [] },
      intentions: { activePlan: '', nextActions: [], progress: '' },
      tickCount: 0,
      goalsMet: false,
      lastTickResult: null,
      lastCronRunId: null,
    };
    await fs.writeFile(statePath, JSON.stringify(initialState, null, 2), 'utf-8');

    return NextResponse.json({ 
      success: true, 
      message: `Agent '${agentName}' saved successfully`,
      path: filePath 
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: String(err) },
      { status: 500 }
    );
  }
}
