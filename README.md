# BDI Agent Forge

IDE for authoring, deploying, and monitoring BDI-based AI agents that run as automated cron jobs.

Transform agent definitions (AGENT.md with beliefs/schema, desires/goals, intentions/constraints) into persistent, self-executing AI agents.

## What is BDI?

Belief-Desire-Intention (BDI) is a cognitive architecture for autonomous agents:

- **Beliefs**: What the agent knows about the world (schema, observations, state)
- **Desires**: What the agent wants to achieve (goals, priorities, success criteria)
- **Intentions**: What the agent plans to do (constraints, active plans, next actions)

## Features

- **Agent Authoring**: Write agents in AGENT.md with BDI schema
- **Cron Integration**: Automatically deploy to Hermes cron job scheduler
- **State Persistence**: Track BDI state across execution cycles
- **IDE Interface**: Web-based dashboard for monitoring agent status
- **Tool Management**: Configure allowed/forbidden tool sets per agent

## Quick Start

```bash
# Clone and install
git clone https://github.com/edub8828/insight-extractor.git
cd insight-extractor
pnpm install

# Start the development server
pnpm dev
```

## Agent Definition Format

Create an AGENT.md file in your agents directory:

```markdown
---
name: insight-extractor
type: content-extraction
soul:
  persona: You are a content extraction specialist
  voice: professional, precise, thorough
desires:
  goals:
    - Extract insights from LinkedIn posts
    - Organize insights into vault
  priority: medium
  successCriteria: All posts processed and insights extracted
intentions:
  constraints:
    - Only use allowed tools
    - Respect rate limits
  planningStrategy: sequential processing
beliefs:
  schema:
    - worldState
    - lastObserved
    - observations
  statePath: ~/.hermes/agents/insight-extractor/state.json
tools:
  allowed:
    - web_search
    - web_extract
    - browser_navigate
  forbidden:
    - delegate_task
heartbeat:
  schedule: every 6h
  model: anthropic/claude-sonnet-4
---
```

## Architecture

Agent Forge is a Next.js IDE that:

1. **Authors** BDI agent definitions via AGENT.md format
2. **Deploys** agents as Hermes cron jobs via API calls
3. **Monitors** agent BDI state by reading persisted JSON state files
4. **Controls** agents (start/stop/run-now) through the dashboard

The Next.js app NEVER executes agents itself. Agents run ONLY via Hermes cron jobs. The app is purely an authoring IDE and monitoring dashboard.

## Tech Stack

- Next.js 16 (Turbopack)
- TypeScript
- Tailwind v4
- gray-matter (YAML frontmatter parsing)
- zod (schema validation)

## Project Structure

```
src/
├── app/
│   ├── agents/          # Agent management pages
│   ├── build/           # Build mode
│   ├── forge/           # Agent authoring
│   ├── analytics/       # Monitoring dashboard
│   └── api/agents/cron/ # Cron job management API
├── lib/
│   ├── agent-state.ts   # BDI types and loaders
│   └── cron-prompt-template.ts # Prompt generation
└── components/          # UI components
```

## Monitoring Dashboard

Access `/analytics` to view:
- All deployed agents
- BDI state history
- Last execution results
- Agent status indicators

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add new agent types or tools
4. Commit your changes
5. Open a Pull Request

## License

MIT License - See LICENSE file for details.

## Support

For issues and questions, please open an issue on the GitHub repository.
