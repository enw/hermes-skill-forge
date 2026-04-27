"use server";

import { homedir } from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { loadAgent, loadAgentCheckpoint, AgentState, AgentCheckpoint, saveAgentCheckpoint } from '@/lib/agent-state';
import { createHash } from 'crypto';

// Maximum duration in minutes from AGENT.md format like "30m"
function parseDuration(duration: string): number {
  const match = duration.match(/(\d+)([mhs])/);
  if (!match) return 30; // default 30 minutes

  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'm': return value;
    case 'h': return value * 60;
    case 's': return value / 60;
    default: return value;
  }
}

// Corpus snapshot hash for change detection
async function hashCorpus(corpusPath: string): Promise<string> {
  const resolvedPath = corpusPath.replace('~', homedir());
  
  try {
    // Use find + md5sum to get a deterministic hash of the corpus
    const result = execSync(
      `find "${resolvedPath}" -type f -name "*.md" | sort | xargs md5sum 2>/dev/null | md5sum`,
      { encoding: 'utf-8' }
    ).trim();
    return result.split(' ')[0] || 'empty';
  } catch {
    return 'error';
  }
}

// Corpus-specific analyzers
async function analyzeObsidianVault(corpusPath: string): Promise<{ issues: string[]; metrics: Record<string, number> }> {
  const resolvedPath = corpusPath.replace('~', homedir());
  const issues: string[] = [];
  const metrics: Record<string, number> = {
    totalNotes: 0,
    brokenLinks: 0,
    orphanedNotes: 0,
    paraViolations: 0,
  };

  try {
    // Get all markdown files
    const files = execSync(
      `find "${resolvedPath}" -name "*.md" -not -path "*/node_modules/*"`,
      { encoding: 'utf-8' }
    ).split('\n').filter(Boolean);

    metrics.totalNotes = files.length;

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      
      // Check wiki-links
      const wikiLinkMatches = content.match(/\[\[([^\]]+)\]\]/g) || [];
      for (const match of wikiLinkMatches) {
        const target = match.slice(2, -2).split('|')[0].trim(); // Handle link aliases
        const targetPath = path.join(path.dirname(file), target.endsWith('.md') ? target : `${target}.md`);
        
        try {
          await fs.access(targetPath);
        } catch {
          // Try finding the file somewhere in the vault
          const findResult = execSync(
            `find "${resolvedPath}" -name "${target}.md" 2>/dev/null | head -1`,
            { encoding: 'utf-8' }
          ).trim();
          
          if (!findResult) {
            issues.push(`Broken wiki-link in ${file.replace(resolvedPath, '~')}: ${match}`);
            metrics.brokenLinks++;
          }
        }
      }

      // Check PARA compliance
      const relativePath = file.replace(resolvedPath + '/', '');
      const parts = relativePath.split('/');
      if (parts.length >= 2) {
        const validFolders = ['Projects', 'Areas', 'Resources', 'Archive', 'Inbox'];
        if (!validFolders.includes(parts[0])) {
          issues.push(`PARA violation: ${relativePath} is not under a valid PARA folder`);
          metrics.paraViolations++;
        }
      }
    }

    // Find orphaned notes (no inbound links)
    const allContent = await Promise.all(
      files.map(f => fs.readFile(f, 'utf-8').catch(() => ''))
    );
    
    const linkedTargets = new Set<string>();
    for (const content of allContent) {
      const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
      for (const m of matches) {
        linkedTargets.add(m.slice(2, -2).split('|')[0].trim());
      }
    }
    
    for (const file of files) {
      const basename = path.basename(file, '.md');
      let hasInbound = false;
      for (const target of linkedTargets) {
        if (target === basename || target.includes(basename)) {
          hasInbound = true;
          break;
        }
      }
      if (!hasInbound) {
        metrics.orphanedNotes++;
      }
    }

  } catch (err) {
    issues.push(`Error analyzing corpus: ${String(err)}`);
  }

  return { issues, metrics };
}

// Generic quality check based on AGENT.md metrics
async function checkQualityMetrics(agent: AgentState, metrics: Record<string, number>): Promise<{ allMet: boolean; results: string[] }> {
  const results: string[] = [];
  let allMet = true;

  for (const metric of agent.quality.metrics) {
    // Parse metric like "broken_link_count: 0" or "orphan_note_count: < 10"
    const match = metric.match(/(\w+):\s*(.*)/);
    if (!match) continue;

    const metricName = match[1];
    const expectedValue = match[2].trim();
    const actualValue = metrics[metricName] ?? 'N/A';

    // Simple comparison
    if (expectedValue.includes('<')) {
      const threshold = parseInt(expectedValue.replace('<', '').trim(), 10);
      const passed = typeof actualValue === 'number' && actualValue < threshold;
      results.push(`${metricName}: ${actualValue} (require <${threshold}) ${passed ? '✓' : '✗'}`);
      if (!passed) allMet = false;
    } else if (expectedValue === '0') {
      const passed = actualValue === 0 || actualValue === '0';
      results.push(`${metricName}: ${actualValue} (require 0) ${passed ? '✓' : '✗'}`);
      if (!passed) allMet = false;
    } else {
      // Equality check
      const passed = actualValue == expectedValue;
      results.push(`${metricName}: ${actualValue} (require ${expectedValue}) ${passed ? '✓' : '✗'}`);
      if (!passed) allMet = false;
    }
  }

  return { allMet, results };
}

// Main executor loop
export async function executeAgent(agentName: string): Promise<{ success: boolean; message: string; actions: string[] }> {
  const agent = await loadAgent(agentName);
  if (!agent) {
    return { success: false, message: `Agent '${agentName}' not found`, actions: [] };
  }

  const checkpoint = await loadAgentCheckpoint(agentName);
  const startTime = new Date();
  
  // Restore state or initialize
  let iteration = checkpoint?.iteration ?? 0;
  const pendingActions: string[] = checkpoint?.pendingActions ?? [];
  const startedAt = checkpoint?.startedAt ?? startTime.toISOString();
  const maxIterations = agent.stopping.max_iterations;
  const maxDuration = parseDuration(agent.stopping.max_duration);
  const checkpointEvery = agent.stopping.checkpoint_every;

  // Check duration limit
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / (1000 * 60); // minutes
  if (elapsed >= maxDuration) {
    return { success: false, message: `Agent exceeded maximum duration (${maxDuration}m)`, actions: [] };
  }

  const actions: string[] = [];
  let currentIssues: string[] = [];
  let currentMetrics: Record<string, number> = {};

  try {
    // Phase 1: Corpus scan and hash
    const corpusHash = await hashCorpus(agent.corpus.path);
    
    if (checkpoint?.corpusSnapshotHash === corpusHash && iteration === 0) {
      return { success: true, message: 'No changes detected in corpus. Agent halted.', actions: [] };
    }

    // Phase 2: Analyze corpus based on type
    if (agent.corpus.type === 'obsidian') {
      const analysis = await analyzeObsidianVault(agent.corpus.path);
      currentIssues = analysis.issues;
      currentMetrics = analysis.metrics;
    } else {
      return { success: false, message: `Unsupported corpus type: ${agent.corpus.type}`, actions: [] };
    }

    // Phase 3: Quality check
    const qualityCheck = await checkQualityMetrics(agent, currentMetrics);
    if (qualityCheck.allMet && iteration > 0) {
      // All metrics met - halt successfully
      const finalCheckpoint: AgentCheckpoint = {
        agentName,
        iteration,
        corpusSnapshotHash: corpusHash,
        pendingActions: [],
        startedAt,
        lastCheckpoint: new Date().toISOString(),
        qualityMetrics: currentMetrics,
        status: 'completed',
        result: qualityCheck.results.join('; '),
      };
      await saveAgentCheckpoint(agentName, finalCheckpoint);
      return { success: true, message: 'All quality metrics met. Agent halted successfully.', actions };
    }

    if (iteration >= maxIterations) {
      // Max iterations reached - halt
      const finalCheckpoint: AgentCheckpoint = {
        agentName,
        iteration: maxIterations,
        corpusSnapshotHash: corpusHash,
        pendingActions: [],
        startedAt,
        lastCheckpoint: new Date().toISOString(),
        qualityMetrics: currentMetrics,
        status: 'completed',
        result: `Max iterations reached. Issues remaining: ${currentIssues.length}`,
      };
      await saveAgentCheckpoint(agentName, finalCheckpoint);
      return { success: false, message: `Max iterations reached (${maxIterations}). ${currentIssues.length} issues remain.`, actions };
    }

    // Phase 4: Act on top N issues
    const issuesToFix = currentIssues.slice(0, 5); // Fix up to 5 per iteration
    for (const issue of issuesToFix) {
      // Check if any action matches this issue
      if (issue.includes('PARA violation')) {
        if (agent.actions.allowed.includes('move_to_correct_para_folder')) {
          actions.push(`ACTION: Fixing ${issue}`);
          // Would implement actual move logic here
        } else {
          actions.push(`ESCALATE: ${issue} (move action not allowed)`);
        }
      } else if (issue.includes('Broken wiki-link')) {
        if (agent.actions.allowed.includes('create_missing_linked_note')) {
          actions.push(`ACTION: Creating missing note for ${issue}`);
          // Would implement missing note creation
        } else {
          actions.push(`ESCALATE: ${issue} (create action not allowed)`);
        }
      } else {
        actions.push(`ESCALATE: ${issue}`);
      }
    }

    iteration++;

    // Phase 5: Write checkpoint
    const newCheckpoint: AgentCheckpoint = {
      agentName,
      iteration,
      corpusSnapshotHash: corpusHash,
      pendingActions: currentIssues.slice(issuesToFix.length),
      startedAt,
      lastCheckpoint: new Date().toISOString(),
      qualityMetrics: currentMetrics,
      status: 'running',
    };

    // Only save checkpoint at the configured interval
    if (iteration % checkpointEvery === 0) {
      await saveAgentCheckpoint(agentName, newCheckpoint);
    }

    return { 
      success: true, 
      message: `Iteration ${iteration}/${maxIterations} complete. ${currentIssues.length} issues found, ${actions.length} actions taken.`, 
      actions 
    };

  } catch (err) {
    const errorCheckpoint: AgentCheckpoint = {
      agentName,
      iteration,
      corpusSnapshotHash: '',
      pendingActions: [],
      startedAt,
      lastCheckpoint: new Date().toISOString(),
      qualityMetrics: {},
      status: 'failed',
      result: `Error: ${String(err)}`,
    };
    await saveAgentCheckpoint(agentName, errorCheckpoint);
    return { success: false, message: `Agent execution failed: ${String(err)}`, actions };
  }
}

export async function validateAgent(agentName: string): Promise<{ valid: boolean; issues: string[] }> {
  const agent = await loadAgent(agentName);
  if (!agent) {
    return { valid: false, issues: [`Agent '${agentName}' not found`] };
  }

  const issues: string[] = [];

  if (!agent.name) issues.push('Missing agent name');
  if (!agent.type) issues.push('Missing agent type');
  if (!agent.soul?.persona) issues.push('Missing soul/persona');
  if (!agent.corpus?.path) issues.push('Missing corpus path');
  if (!agent.corpus?.type) issues.push('Missing corpus type');
  if (!agent.actions?.allowed) issues.push('Missing allowed actions');
  if (!agent.quality?.metrics) issues.push('Missing quality metrics');
  if (!agent.stopping?.condition) issues.push('Missing stopping condition');

  // Validate corpus path exists
  try {
    const resolvedPath = agent.corpus.path.replace('~', homedir());
    await fs.access(resolvedPath);
  } catch {
    issues.push(`Corpus path not found: ${agent.corpus.path}`);
  }

  return { valid: issues.length === 0, issues };
}
