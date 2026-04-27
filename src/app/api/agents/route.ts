import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import matter from 'gray-matter';

const AGENTS_DIR = path.join(homedir(), '.hermes', 'agents');

export async function GET() {
  const agents = [];
  try {
    const entries = await fs.readdir(AGENTS_DIR, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      // Read AGENT.md for metadata
      const agentMdPath = path.join(AGENTS_DIR, entry.name, 'AGENT.md');
      let corpusType = '';
      let corpusPath = '';
      let maxIterations: number | undefined;
      
      try {
        const content = await fs.readFile(agentMdPath, 'utf-8');
        const parsed = matter(content);
        corpusType = parsed.data?.corpus?.type || '';
        corpusPath = parsed.data?.corpus?.path || '';
        maxIterations = parsed.data?.stopping?.max_iterations;
      } catch { /* skip */ }

      // Read checkpoint for state
      const cpPath = path.join(AGENTS_DIR, entry.name, 'checkpoint.json');
      let status = 'not_started';
      let lastRun: string | undefined;
      let iteration: number | undefined;
      let qualityMetrics: Record<string, number> = {};
      let startedAt: string | undefined;

      try {
        const cp = JSON.parse(await fs.readFile(cpPath, 'utf-8'));
        status = cp.status || 'not_started';
        lastRun = cp.lastCheckpoint;
        iteration = cp.iteration;
        qualityMetrics = cp.qualityMetrics || {};
        startedAt = cp.startedAt;
      } catch { /* no checkpoint */ }

      agents.push({
        name: entry.name,
        status,
        lastRun,
        iteration,
        maxIterations,
        qualityMetrics,
        corpusType,
        corpusPath,
        startedAt,
      });
    }
  } catch { /* dir doesn't exist yet */ }

  return NextResponse.json(agents);
}
