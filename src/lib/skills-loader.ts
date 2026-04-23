import fs from "fs/promises";
import path from "path";
import { parseSkill } from "./skill-parser";
import { ParsedSkill } from "./skill-schema";

const SKILLS_DIR = process.env.SKILLS_DIR || path.join(process.env.HOME || "~", ".hermes", "skills");

export async function loadAllSkills(): Promise<ParsedSkill[]> {
  const skills: ParsedSkill[] = [];

  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    for (const dir of dirs) {
      const skillPath = path.join(SKILLS_DIR, dir.name, "SKILL.md");
      try {
        const content = await fs.readFile(skillPath, "utf-8");
        const skill = parseSkill(content, skillPath);
        skills.push(skill);
      } catch {
        // Some dirs may not have SKILL.md at top level — try one level deeper
        const subEntries = await fs.readdir(path.join(SKILLS_DIR, dir.name), { withFileTypes: true });
        const subDirs = subEntries.filter((e) => e.isDirectory());
        for (const sub of subDirs) {
          const subSkillPath = path.join(SKILLS_DIR, dir.name, sub.name, "SKILL.md");
          try {
            const content = await fs.readFile(subSkillPath, "utf-8");
            const skill = parseSkill(content, subSkillPath);
            skills.push(skill);
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to load skills:", e);
  }

  return skills;
}

export async function getSkillTags(skills: ParsedSkill[]): Promise<string[]> {
  const tagSet = new Set<string>();
  for (const s of skills) {
    const tags = s.frontmatter.tags || [];
    const metaTags = s.frontmatter.metadata?.hermes?.tags || [];
    [...tags, ...metaTags].forEach((t) => tagSet.add(t));
  }
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
}
