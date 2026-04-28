import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { agentName, message, content } = await request.json();
    
    if (!agentName || !message || !content) {
      return NextResponse.json(
        { success: false, message: 'agentName, message, and content required' },
        { status: 400 }
      );
    }

    const agentDir = path.join(process.env.HOME || '/Users/enw', '.hermes', 'agents', agentName);
    const filePath = path.join(agentDir, 'AGENT.md');

    // Write the file
    await fs.writeFile(filePath, content, 'utf-8');

    // Run git add and commit
    const addResult = await execWithOutput(`git -C "${agentDir}" add AGENT.md`);
    const commitResult = await execWithOutput(`git -C "${agentDir}" commit -m "${message}"`);

    // Get commit info
    const commitInfo = await execWithOutput(`git -C "${agentDir}" log -1 --format="%H|%s|%cd" --date=iso`);

    return NextResponse.json({
      success: true,
      message: 'Git commit successful',
      commit: {
        hash: commitInfo.stdout.trim().split('\n')[0]?.split('|')[0],
        message: commitInfo.stdout.trim().split('\n')[0]?.split('|')[1],
        date: commitInfo.stdout.trim().split('\n')[0]?.split('|')[2]
      },
      addOutput: addResult.stdout,
      commitOutput: commitResult.stdout
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: String(err) },
      { status: 500 }
    );
  }
}

const fs = await import('fs/promises');
const path = await import('path');
const { execSync } = await import('child_process');

async function execWithOutput(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const output = execSync(command, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
    return { stdout: output.toString(), stderr: '' };
  } catch (error: any) {
    return { stdout: error.stdout?.toString() || '', stderr: error.stderr?.toString() || String(error) };
  }
}
