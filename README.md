# Hermes Skill Forge

A local-first web studio for browsing, authoring, and validating [Hermes Agent](https://github.com/NousResearch/hermes-agent) skills. No cloud. No database. Just your filesystem, rendered beautifully.

---

## The Problem

Hermes skills are powerful. They let agents learn from experience, encode workflows, and share knowledge. But right now they are just markdown files scattered across `~/.hermes/skills/`. There is no central registry, no validator, and no guided authoring flow. Writing a skill means memorizing frontmatter schemas and hoping your markdown parses correctly.

Skill Forge fixes that.

## What It Does

Skill Forge reads your local Hermes skills directory and turns it into a searchable, filterable, editable studio.

### Browse
- Search and filter skills by name, description, category, or tags
- See required commands, environment variables, and toolsets at a glance
- Navigate nested categories (`software-development/`, `productivity/`, `mlops/`)

### Inspect
- View parsed frontmatter with badge display
- Read body content with syntax highlighting
- Run validation to catch missing fields, short bodies, unwrapped commands, and missing env references

### Build
- Guided form-based skill builder with live markdown preview
- Auto-generates valid frontmatter
- Writes directly to `~/.hermes/skills/` via server actions
- Validation gates prevent broken skills from reaching your filesystem

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- gray-matter (frontmatter parsing)

## Quick Start

```bash
git clone https://github.com/yourusername/hermes-skill-forge.git
cd hermes-skill-forge
pnpm install
pnpm dev
```

Open http://localhost:3000. It will automatically scan `~/.hermes/skills/` and display your skill directory.

Override the skills path:

```bash
SKILLS_DIR=/custom/path/to/skills pnpm dev
```

## Architecture

Skill Forge is local-first. It does not call APIs or run a database. It reads markdown from disk, parses it server-side with Node.js `fs`, and renders it in the browser.

```
~/.hermes/skills/
├── software-development/
│   └── hermes-dashboard-setup/
│       └── SKILL.md
├── productivity/
│   └── cto-advisor/
│       └── SKILL.md
└── ...
```

The parser extracts YAML frontmatter and markdown body, validates schema compliance, and surfaces issues inline. The builder reverses the process: form input -> frontmatter + body -> valid SKILL.md written to disk.

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Skill directory with search and tag filtering |
| `/skill/[id]` | Skill detail with validation report and body preview |
| `/build` | Guided skill builder with live preview and save-to-disk |

## Roadmap

- [x] Linked file editing (references/, templates/, scripts/, assets/)
- [ ] Dark mode toggle
- [ ] GitHub PR submission flow for community skill sharing
- [ ] Sorting and advanced filtering
- [ ] Skill usage analytics

## Contributing

Hermes Skill Forge is built for the Hermes community. If you use Hermes, you write skills. This tool makes that process faster and less error-prone.

Open an issue or PR. The codebase is intentionally small and readable.

## License

MIT
