# BDI Agent Forge Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Transform the Agent Forge section of Hermes Skill Forge from a standalone execution engine into an IDE for authoring, deploying, and monitoring BDI-based agents that run as Hermes cron jobs.

**Architecture:** Agent Forge is a Next.js UI that:
1. Authors BDI agent definitions (AGENT.md with beliefs schema, desires, intentions constraints)
2. Deploys agents as Hermes cron jobs via API calls to a local management endpoint
3. Monitors agent BDI state by reading persisted JSON state files
4. Provides controls (start/stop/run-now) that map to cronjob CRUD operations

**Key Principle:** The Next.js app NEVER executes agents itself. Agents run ONLY via Hermes cron jobs. The app is purely an authoring IDE and monitoring dashboard.

**Tech Stack:** Next.js 16 (Turbopack), TypeScript, Tailwind v4, `gray-matter`, `zod`
**Existing codebase:** `~/Projects/hermes-skill-forge/` — already has `/agents` route, agent-state.ts, dashboard UI

---

### Task 1: Delete the old standalone execution engine

**Objective:** Remove all code that runs agents inside the Next.js app.

**Files:**
- Delete: `src/app/agents/actions.ts` (the entire 390-line executor with hashCorpus, analyzeObsidianVault, etc.)
- Delete: `src/app/api/agents/control/route.ts` (the old control API that called executeAgent)

**Verification:**
```bash
cd ~/Projects/hermes-skill-forge && grep -r "executeAgent" src/ --include="*.ts" --include="*.tsx"
```
Expected: No results. If the RunAgentButton still imports it, we'll fix that in Task 6.

**Commit:**
```bash
git rm src/app/agents/actions.ts src/app/api/agents/control/route.ts
git commit -m "refactor: remove standalone agent execution engine"
```

---

### Task 2: Define the BDI agent schema and Zod validator

**Objective:** Create TypeScript types and Zod schemas for the new BDI AGENT.md format and persisted state.

**Files:**
- Modify: `src/lib/agent-state.ts` (complete rewrite of types)

**New type definitions:**

```typescript
// BDI Agent definition (AGENT.md frontmatter)
export interface BDI desires {
  goals: string[];
  priority?: string;
  successCriteria?: string;
}

export interface BDIIntentions {
  constraints: string[];
  planningStrategy?: string;
}

export interface BDIBeliefs {
  schema: string[];
  statePath: string;
}

export interface BDIAgent {
  name: string;
  type: string;
  soul: {
    persona: string;
    voice: string;
  };
  desires: BDIDesires;
  intentions: BDIIntentions;
  beliefs: BDIBeliefs;
  tools: {
    allowed: string[];
    forbidden: string[];
  };
  heartbeat: {
    schedule: string;    // e.g. "every 6h", "0 9 * * *"
    model?: string;       // e.g. "anthropic/claude-sonnet-4"
  };
}

// Persisted BDI state (updated each cron tick)
export interface BDIState {
  beliefs: {
    worldState: Record<string, unknown>;
    lastObserved: string;  // ISO timestamp
    observations: string[];
  };
  intentions: {
    activePlan: string;
    nextActions: string[];
    progress: string;
  };
  tickCount: number;
  goalsMet: boolean;
  lastTickResult?: string;
  lastCronRunId?: string;
}

// Zod schema for validation
import { z } from 'zod';

export const BDIAgentSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  soul: z.object({
    persona: z.string().min(1),
    voice: z.string().min(1),
  }),
  desires: z.object({
    goals: z.array(z.string()).min(1),
    priority: z.string().optional(),
    successCriteria: z.string().optional(),
  }),
  intentions: z.object({
    constraints: z.array(z.string()),
    planningStrategy: z.string().optional(),
  }),
  beliefs: z.object({
    schema: z.array(z.string()),
    statePath: z.string(),
  }),
  tools: z.object({
    allowed: z.array(z.string()),
    forbidden: z.array(z.string()),
  }),
  heartbeat: z.object({
    schedule: z.string(),
    model: z.string().optional(),
  }),
});
```

**Update the loader functions:**

```typescript
export async function loadAgent(agentName: string): Promise<BDIAgent | null> {
  const agentPath = path.join(homedir(), '.hermes', 'agents', agentName, 'AGENT.md');
  try {
    const content = await fs.readFile(agentPath, 'utf-8');
    const parsed = matter(content);
    const result = BDIAgentSchema.safeParse(parsed.data);
    if (!result.success) {
      console.error(`Invalid AGENT.md for ${agentName}:`, result.error);
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export async function loadBDIState(agentName: string): Promise<BDIState | null> {
  const agent = await loadAgent(agentName);
  if (!agent) return null;
  
  const statePath = agent.beliefs.statePath.replace('~', homedir());
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content) as BDIState;
  } catch {
    return null;
  }
}

export async function saveBDIState(agentName: string, state: BDIState): Promise<void> {
  const agent = await loadAgent(agentName);
  if (!agent) throw new Error(`Agent ${agentName} not found`);
  
  const statePath = agent.beliefs.statePath.replace('~', homedir());
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function listAgents(): Promise<Array<{ name: string; type: string; status: string; lastTick?: string }>> {
  const agentsDir = path.join(homedir(), '.hermes', 'agents');
  const results: Array<{ name: string; type: string; status: string; lastTick?: string }> = [];

  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      const agent = await loadAgent(entry.name);
      const state = await loadBDIState(entry.name);
      results.push({
        name: entry.name,
        type: agent?.type ?? 'unknown',
        status: state?.goalsMet ? 'completed' : state ? 'active' : 'not_started',
        lastTick: state?.beliefs.lastObserved,
      });
    }
  } catch {
    // Agents directory doesn't exist yet
  }

  return results;
}
```

**Note:** Need to add `zod` as a dependency since it's not currently in the project.

**Verification:**
```bash
cd ~/Projects/hermes-skill-forge && npx tsc --noEmit
```
Expected: No errors (except possibly the existing `@/lib/agent-state` path resolution issue which is a Turbopack alias quirk).

**Commit:**
```bash
git add src/lib/agent-state.ts
git commit -m "feat: define BDI agent schema with Zod validation"
```

---

### Task 3: Create the cron prompt template generator

**Objective:** Generate the BDI execution prompt that each cron job runs. This is the core agent logic.

**Files:**
- Create: `src/lib/cron-prompt-template.ts`

**Implementation:**

```typescript
import { BDIAgent, BDIState } from './agent-state';

export function generateBDIPrompt(agent: BDIAgent, prevState: BDIState | null): string {
  const prevStateBlock = prevState ? `
### PREVIOUS STATE (from last tick)
${JSON.stringify(prevState, null, 2)}
` : '';

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
In your final response, print a 2-3 line summary: what you observed, what you did, and goal progress.
`;
}

export function generateAgentInstallPrompt(agent: BDIAgent): string {
  return `Set up this BDI agent definition:

Agent: ${agent.name}
Type: ${agent.type}

1. Create the AGENT.md at ~/.hermes/agents/${agent.name}/AGENT.md
2. Initialize the BDI state file at ${agent.beliefs.statePath} with empty state
   (tickCount=0, goalsMet=false, empty observations)
3. Create a Hermes cron job with the following properties:
   - Name: agent-${agent.name}
   - Schedule: ${agent.heartbeat.schedule}
   - Model: ${agent.heartbeat.model || 'default'}
   - Toolsets: [${agent.tools.allowed.join(', ')}]
   - Prompt: Use the BDI cycle prompt template

After setup, the agent will run on its heartbeat and update its BDI state file.`;
}
```

**Verification:**
```bash
cd ~/Projects/hermes-skill-forge && node -e "
const fs = require('fs');
const content = fs.readFileSync('src/lib/cron-prompt-template.ts', 'utf-8');
console.log('File loads OK, ' + content.length + ' bytes');
"
```

**Commit:**
```bash
git add src/lib/cron-prompt-template.ts
git commit -m "feat: BDI cron prompt template generator"
```

---

### Task 4: Create the cron job management API

**Objective:** API routes that create/update/remove Hermes cron jobs for agents. These call the `cronjob` tool via server actions.

**Files:**
- Create: `src/app/api/agents/cron/route.ts`

**Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { loadAgent, loadBDIState, saveBDIState, BDIState } from '@/lib/agent-state';
import { generateBDIPrompt } from '@/lib/cron-prompt-template';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as matter from 'gray-matter';

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
    const { agentName, action } = body;

    if (!agentName || !action) {
      return NextResponse.json({ success: false, message: 'agentName and action required' }, { status: 400 });
    }

    const agent = await loadAgent(agentName);
    if (!agent) {
      return NextResponse.json({ success: false, message: `Agent '${agentName}' not found` }, { status: 404 });
    }

    switch (action) {
      case 'deploy': {
        // Generate the BDI prompt
        const prevState = await loadBDIState(agentName);
        const prompt = generateBDIPrompt(agent, prevState);
        const toolsets = extractToolsets(agent.tools.allowed);

        // Create initial state if it doesn't exist
        const statePath = agent.beliefs.statePath.replace('~', process.env.HOME || '/root');
        if (!(await fs.access(statePath).then(() => true).catch(() => false))) {
          const initialState: BDIState = {
            beliefs: { worldState: {}, lastObserved: new Date().toISOString(), observations: [] },
            intentions: { activePlan: '', nextActions: [], progress: '' },
            tickCount: 0,
            goalsMet: false,
          };
          await fs.mkdir(path.dirname(statePath), { recursive: true });
          await fs.writeFile(statePath, JSON.stringify(initialState, null, 2));
        }

        // Create the cron job via hermes CLI
        const jobName = `agent-${agentName}`;
        const model = agent.heartbeat.model ? `--model "${agent.heartbeat.model}"` : '';
        const toolsetFlag = toolsets.length > 0 ? `--tools ${toolsets.join(',')}` : '';
        
        // Use a prompt file approach for complex prompts
        const promptFile = `/tmp/bdi-prompt-${agentName}.txt`;
        await fs.writeFile(promptFile, prompt);

        const cmd = `hermes cron create "${agent.heartbeat.schedule}" --prompt "$(cat ${promptFile})" --name "${jobName}" ${model}`;
        execSync(cmd, { encoding: 'utf-8' });

        return NextResponse.json({ 
          success: true, 
          message: `Agent '${agentName}' deployed as cron job '${jobName}' on schedule '${agent.heartbeat.schedule}'` 
        });
      }

      case 'run': {
        // Manually trigger the cron job
        const jobId = `agent-${agentName}`;
        try {
          const output = execSync(`hermes cron run "${jobId}" 2>&1 || hermes cron list 2>&1`, { encoding: 'utf-8' });
          return NextResponse.json({ success: true, message: `Triggered agent '${agentName}'`, details: output });
        } catch (err) {
          return NextResponse.json({ success: false, message: `Failed to trigger: ${String(err)}` }, { status: 500 });
        }
      }

      case 'stop': {
        // Remove the cron job
        const jobId = `agent-${agentName}`;
        try {
          execSync(`hermes cron remove "${jobId}" 2>&1`, { encoding: 'utf-8' });
          return NextResponse.json({ success: true, message: `Agent '${agentName}' stopped and cron job removed` });
        } catch (err) {
          return NextResponse.json({ success: false, message: `Failed to remove: ${String(err)}` }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // List all agent cron jobs and their status
  try {
    const output = execSync('hermes cron list 2>&1', { encoding: 'utf-8' });
    return NextResponse.json({ success: true, jobs: output });
  } catch (err) {
    return NextResponse.json({ success: false, message: String(err) });
  }
}
```

**Dependencies:** Need `gray-matter` (already installed), zod (need to add).

**Verification:**
```bash
cd ~/Projects/hermes-skill-forge && npx tsc --noEmit
curl -s http://localhost:3002/api/agents/cron
```
Expected: JSON response (may error if hermes CLI isn't available on this machine, which is expected — the app runs locally but agents deploy to the user's Hermes installation).

**Note:** This API assumes it runs on the same machine as the Hermes CLI. If the app runs remotely, we need a different deployment mechanism. For now, assume local-first.

**Commit:**
```bash
git add src/app/api/agents/cron/route.ts
git commit -m "feat: cron job management API for BDI agents"
```

---

### Task 5: Rewrite the agent wizard to produce BDI format

**Objective:** Update the `/agents/new` page to generate BDI-structured AGENT.md files instead of the old schema.

**Files:**
- Modify: `src/app/agents/new/actions.ts` (update the AI prompt and output parsing)
- Modify: `src/app/agents/new/page.tsx` (update UI to match new fields)

**Updated wizard flow:**

The AI interview should ask about:
1. Agent name and persona
2. What the agent's domain is (what it observes)
3. Its goals/desires (what success looks like)
4. Constraints on its behavior (what it must not do)
5. What tools it needs
6. How often it should run (heartbeat schedule)

**New output format:**

```yaml
name: vault-gardener
type: corpus-steward
soul:
  persona: "Meticulous keeper of the knowledge garden"
  voice: "Quiet, systematic, no-nonsense. Reports facts, not opinions."
desires:
  goals:
    - broken_link_count must be 0
    - all notes must live in valid PARA folders  
    - no orphaned notes
  priority: maintain vault quality over growth
  success_criteria: all goals met for 3 consecutive ticks
intentions:
  constraints:
    - only fix 5 issues per tick to avoid thrashing
    - never delete content
    - escalate ambiguous cases to review queue
  planning_strategy: fix structural issues before content issues
beliefs:
  schema:
    - total_notes: number
    - broken_links: number
    - orphan_notes: number
    - para_violations: number
  state_path: ~/.cache/hermes/agents/vault-gardener/bdi-state.json
tools:
  allowed:
    - terminal
    - file
    - search_files
    - read_file
    - write_file
    - patch
  forbidden:
    - clarify
    - delegate_task
heartbeat:
  schedule: every 6h
  model: anthropic/claude-sonnet-4
```

**The save action should:**
1. Write AGENT.md to `~/.hermes/agents/{name}/AGENT.md`
2. Initialize empty BDI state at the specified `state_path`
3. Return the agent spec for display

**Verification:**
```bash
# Create a test agent via the wizard
# Check that AGENT.md has correct BDI structure
# Check that state file is initialized
```

**Commit:**
```bash
git add src/app/agents/new/
git commit -m "feat: update agent wizard to produce BDI-structured agents"
```

---

### Task 6: Update RunAgentButton to use cron API

**Objective:** Replace the old server-action-based Run button with one that calls `/api/agents/cron`.

**Files:**
- Modify: `src/components/run-agent-button.tsx`

**New implementation:**

```tsx
"use client";

import { useState } from 'react';

type ButtonAction = 'deploy' | 'run' | 'stop' | 'reset';

export function RunAgentButton({ agentName, isDeployed }: { agentName: string; isDeployed: boolean }) {
  const [loading, setLoading] = useState<ButtonAction | null>(null);
  const [result, setResult] = useState<{ message: string; success: boolean } | null>(null);

  const doAction = async (action: ButtonAction) => {
    setLoading(action);
    setResult(null);
    try {
      const res = await fetch('/api/agents/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, action }),
      });
      const data = await res.json();
      setResult({ message: data.message, success: data.success });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setResult({ message: `Error: ${String(err)}`, success: false });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {!isDeployed ? (
          <button onClick={() => doAction('deploy')} disabled={loading !== null}
            className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3">
            {loading === 'deploy' ? 'Deploying...' : '▶ Deploy'}
          </button>
        ) : (
          <>
            <button onClick={() => doAction('run')} disabled={loading !== null}
              className="inline-flex items-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3">
              {loading === 'run' ? 'Running...' : '▶ Run Now'}
            </button>
            <button onClick={() => doAction('stop')} disabled={loading !== null}
              className="inline-flex items-center rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 h-8 px-3">
              {loading === 'stop' ? 'Stopping...' : '■ Stop'}
            </button>
          </>
        )}
        <button onClick={() => doAction('reset')} disabled={loading !== null}
          className="inline-flex items-center rounded-md text-sm font-medium border bg-background hover:bg-muted h-8 px-3">
          ↺ Reset
        </button>
      </div>
      {result && (
        <div className={`rounded-md border p-3 text-sm ${result.success ? 'border-green-600/30 bg-green-500/5' : 'border-red-600/30 bg-red-500/5'}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
```

**Verification:**
- Button renders without errors
- Deploy/Run/Stop/Reset buttons show correct states based on `isDeployed` prop

**Commit:**
```bash
git add src/components/run-agent-button.tsx
git commit -m "feat: update RunAgentButton for BDI cron actions"
```

---

### Task 7: Rewrite agent dashboard for BDI state display

**Objective:** Update `/agents` list and `/agents/[name]` detail pages to show BDI state (beliefs, desires, intentions) instead of the old iteration-based checkpoint view.

**Files:**
- Modify: `src/app/agents/page.tsx`
- Modify: `src/components/agent-dashboard.tsx`
- Modify: `src/app/agents/[name]/page.tsx`

**Updated dashboard card (agent-dashboard.tsx):**

Shows per agent:
- Goals with pass/fail status comparing beliefs vs desires
- Current belief values (worldState)
- Active intention and progress
- Last tick timestamp and tick count
- Deploy/Run/Stop/Reset buttons (using the new RunAgentButton from Task 6)

**Updated detail page (/agents/[name]/page.tsx):**

Shows:
- Full AGENT.md rendered as markdown
- BDI state broken into three panels (Beliefs, Desires, Intentions)
- Raw state JSON (collapsible)
- Tick count and last observed timestamp
- Cron job status indicator
- RunAgentButton

**Server component updates (page.tsx files):**

```typescript
// src/app/agents/page.tsx
import { listAgents, loadAgent, loadBDIState } from '@/lib/agent-state';
import { execSync } from 'child_process';

async function hasCronJob(agentName: string): Promise<boolean> {
  try {
    const output = execSync(`hermes cron list 2>&1`, { encoding: 'utf-8' });
    return output.includes(`agent-${agentName}`);
  } catch {
    return false;
  }
}

export default async function AgentsPage() {
  const agentsList = await listAgents();
  const agentsWithCron = await Promise.all(
    agentsList.map(async (a) => ({
      ...a,
      isDeployed: await hasCronJob(a.name),
      state: await loadBDIState(a.name),
    }))
  );
  return <AgentDashboard agents={agentsWithCron} />;
}
```

**Verification:**
```bash
cd ~/Projects/hermes-skill-forge && pnpm dev --port 3002
# Visit http://localhost:3002/agents
# Should show BDI panels, old iteration/checkpoint UI should be gone
# Visit http://localhost:3002/agents/vault-gardener
# Should show BDI detail view
```

**Commit:**
```bash
git add src/app/agents/ src/components/agent-dashboard.tsx
git commit -m "feat: rewrite agent UI for BDI state display"
```

---

### Task 8: Add `zod` dependency and verify build

**Objective:** Ensure all dependencies are installed and the project compiles.

**Command:**
```bash
cd ~/Projects/hermes-skill-forge && pnpm add zod
```

**Verification:**
```bash
cd ~/Projects/hermes-skill-filter && npx tsc --noEmit
```
Expected: No errors (Turbopack alias resolution for `@/lib/*` may show warnings but should work at runtime).

**Commit:**
```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add zod dependency for BDI schema validation"
```

---

### Task 7: Add `zod` dependency and fix build

**Objective:** Ensure all dependencies are installed and the project compiles.

**Command:**
```bash
cd ~/Projects/hermes-skill-forge && pnpm add zod
```

**Verification:**
```bash
cd ~/Projects/hermes-skill-forge && pnpm build
```
Expected: Successful build (or at worst, only the existing Turbopack alias issue).

**Commit:**
```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add zod dependency for BDI schema validation"
```

---

## Deployment Model

Once built, Agent Forge works like this:

1. **Author**: User goes to `/agents/new`, describes their agent, Agent Forge generates AGENT.md with BDI structure
2. **Deploy**: User clicks ▶ on the dashboard → Agent Forge calls `hermes cron create` to schedule the agent
3. **Run**: Agent runs on its heartbeat via Hermes cron, executing the BDI cycle (perceive → deliberate → act → persist)
4. **Monitor**: Dashboard reads the BDI state file to show current beliefs, goal progress, and active intentions
5. **Stop**: User clicks ■ → Agent Forge removes the cron job

The Next.js app never runs agent logic. It's purely an IDE + monitor.

---

## Key Decisions

- **State file location**: Defined in AGENT.md `beliefs.state_path`, defaults to `~/.cache/hermes/agents/{name}/bdi-state.json`
- **Cron job naming**: Convention `agent-{name}` for easy lookup
- **Tool mapping**: AGENT.md tool names map to Hermes toolset groups (file, web, browser, etc.)
- **BDI cycle prompt**: Single comprehensive prompt generated at deploy time, re-reads AGENT.md each execution

---

## Assumptions

- Hermes CLI is available on the same machine running the Forge app (local-first)
- `hermes cron create` supports `--prompt`, `--name`, `--model` flags (may need adjustment based on actual CLI)
- Gray-matter is already installed (it is)
- Zod needs to be added as a dependency