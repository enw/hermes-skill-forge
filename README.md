# Hermes Skill Forge

A collection of custom skills and automation patterns for the Hermes Agent platform. This repository contains specialized skills that extend Hermes' capabilities for specific workflows.

## Features

- **Custom Agent Skills**: Pre-built skills for common automation tasks
- **Cron Job Management**: Automated task scheduling with profile support
- **Vault Integration**: Seamless Obsidian vault integration for note management
- **Profile Isolation**: Multiple isolated Hermes instances (default, local, tbai)
- **CI/CD Ready**: Automated workflows for deployment and maintenance

## Quick Start

```bash
# Clone the repository
git clone https://github.com/enw/hermes-skill-forge.git

# Install dependencies
cd hermes-skill-forge
pnpm install

# Run the Hermes agent
hermes chat "Your task here"

# Or use one-shot mode
hermes -z "Your task here"
```

## Cron Jobs

Cron jobs are scheduled tasks that run automatically based on their schedules.

### Available Profiles

- **default**: General-purpose tasks (AI strategy, flight monitoring, etc.)
- **local**: Development and testing tasks
- **tbai**: TB-specific AI tasks

### Managing Cron Jobs

```bash
# List all cron jobs
hermes cron list

# Create a new cron job
hermes cron create "0 9 * * *" "Your prompt here" --name "job-name"

# Run a cron job immediately
hermes cron run "job-name"

# Stop a cron job
hermes cron remove "job-name"
```

## Skills

Skills are reusable automation patterns that can be attached to cron jobs or run directly.

```bash
# List available skills
hermes skills list

# View a specific skill
hermes skills view <skill-name>

# Run a skill directly
hermes -s <skill-name> -z "Task description"
```

## Profiles

Hermes supports multiple isolated profiles, each with their own configuration and credentials.

```bash
# List profiles
hermes profile list

# View profile configuration
hermes config

# Edit profile configuration
hermes config edit
```

## Gateway

The Hermes gateway manages message delivery and webhook subscriptions.

```bash
# Install gateway as system service
sudo hermes gateway install --system

# Start gateway
hermes gateway run

# List webhook subscriptions
hermes webhook list
```

## License

MIT License - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Support

For issues and questions, please open an issue on the GitHub repository.
