import fs from "fs/promises";
import path from "path";
import { parseSkill } from "./skill-parser";
import { ParsedSkill, LinkedFile } from "./skill-schema";

const SKILLS_DIR = process.env.SKILLS_DIR || path.join(process.env.HOME || "~", ".hermes", "skills");

const LINKED_DIRS = ["references", "templates", "scripts", "assets"];

async function loadLinkedFiles(skillDir: string): Promise<LinkedFile[]> {
  const files: LinkedFile[] = [];
  for (const sub of LINKED_DIRS) {
    const subDir = path.join(skillDir, sub);
    try {
      const entries = await fs.readdir(subDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(subDir, entry.name);
          const content = await fs.readFile(filePath, "utf-8");
          files.push({ path: `${sub}/${entry.name}`, content });
        }
      }
    } catch {
      // directory may not exist
    }
  }
  return files;
}

async function loadSkillAt(skillPath: string): Promise<ParsedSkill | null> {
  try {
    const content = await fs.readFile(skillPath, "utf-8");
    const skill = parseSkill(content, skillPath);
    const skillDir = path.dirname(skillPath);
    skill.linkedFiles = await loadLinkedFiles(skillDir);
    return skill;
  } catch {
    return null;
  }
}

export async function loadAllSkills(): Promise<ParsedSkill[]> {
  const skills: ParsedSkill[] = [];

  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    for (const dir of dirs) {
      const skillPath = path.join(SKILLS_DIR, dir.name, "SKILL.md");
      const skill = await loadSkillAt(skillPath);
      if (skill) {
        skills.push(skill);
        continue;
      }
      // Try one level deeper
      const subEntries = await fs.readdir(path.join(SKILLS_DIR, dir.name), { withFileTypes: true });
      const subDirs = subEntries.filter((e) => e.isDirectory());
      for (const sub of subDirs) {
        const subSkillPath = path.join(SKILLS_DIR, dir.name, sub.name, "SKILL.md");
        const subSkill = await loadSkillAt(subSkillPath);
        if (subSkill) {
          skills.push(subSkill);
        }
      }
    }
  } catch (e) {
    console.error("Failed to load skills:", e);
  }

  return skills;
}

export async function getSkillById(id: string): Promise<ParsedSkill | null> {
  const skills = await loadAllSkills();
  return skills.find((s) => s.id === id) || null;
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
