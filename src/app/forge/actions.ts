'use server';

import { openai } from '@ai-sdk/openai';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

const INTERVIEW_SYSTEM = `You are Hermes Forge, an expert skill-authoring assistant for the Hermes Agent ecosystem.

A Hermes skill is a folder in ~/.hermes/skills/ containing:
- SKILL.md: markdown with YAML frontmatter (name, category, description) and a rich body
- Optional linked files in references/, templates/, scripts/, assets/

Your job: interview the user to understand what skill they need. Ask at most 2-3 concise follow-up questions. Focus on:
1. What task or workflow should the skill automate?
2. What tools, APIs, or CLI commands are involved?
3. Who is the target user and what is their expertise level?

Do NOT generate the skill yet. Keep responses brief and conversational. When you have enough detail, say: "Ready to forge this skill? Click the Forge button."`;

const GENERATION_SYSTEM = `You are a Hermes skill generator. Based on the interview, produce a complete, production-ready skill.

Output rules:
- name: kebab-case, concise, unique
- category: choose a fitting category (e.g., devops, productivity, software-development, research, note-taking, data-science, mlops)
- skillMd: complete SKILL.md content with YAML frontmatter (name, category, description) and a rich markdown body. Include sections: Overview, When to Use, Prerequisites, Steps, Examples, Pitfalls. Use imperative tone for steps.
- linkedFiles: optional array of helper files (scripts, templates, references). Path must be relative like "references/example.md" or "scripts/validate.py". Only include if genuinely useful.`;

const skillSchema = z.object({
  name: z.string().describe('Kebab-case skill name'),
  category: z.string().describe('Skill category'),
  skillMd: z.string().describe('Full SKILL.md content including YAML frontmatter'),
  linkedFiles: z.array(z.object({
    path: z.string().describe('Relative path like references/example.md'),
    content: z.string(),
  })).optional(),
});

function checkApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set. Export it in your shell or add it to .env.local');
  }
}

export async function interview(messages: Array<{role: 'user'|'assistant', content: string}>) {
  checkApiKey();
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: INTERVIEW_SYSTEM,
    messages,
  });
  return text;
}

export async function generateSkill(messages: Array<{role: 'user'|'assistant', content: string}>) {
  checkApiKey();

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    system: GENERATION_SYSTEM,
    schema: skillSchema,
    messages,
  });

  return object;
}

export async function saveSkill(name: string, skillMd: string, linkedFiles?: Array<{path: string, content: string}>) {
  const skillsDir = process.env.SKILLS_DIR || join(homedir(), '.hermes', 'skills');
  const skillDir = join(skillsDir, name);

  if (existsSync(skillDir)) {
    throw new Error(`Skill "${name}" already exists at ${skillDir}`);
  }

  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, 'SKILL.md'), skillMd, 'utf-8');

  if (linkedFiles && linkedFiles.length > 0) {
    for (const file of linkedFiles) {
      const filePath = join(skillDir, file.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, 'utf-8');
    }
  }

  return { success: true, path: skillDir };
}
