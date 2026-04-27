import { NextResponse } from 'next/server';
import { loadBDIState } from '@/lib/agent-state';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentName = searchParams.get('agent');

  if (!agentName) {
    return NextResponse.json({ error: 'agent query param is required' }, { status: 400 });
  }

  const state = await loadBDIState(agentName);
  return NextResponse.json({ state });
}
