"use server";

import fs from "fs/promises";
import path from "path";
import { skillToMarkdown } from "@/lib/skill-parser";
import { ParsedSkill } from "@/lib/skill-schema";

const SKILLS_DIR = process.env.SKILLS_DIR || path.join(process.env.HOME || "~", ".hermes", "skills");

export async function writeSkillToDisk(skill: ParsedSkill): Promise<{ success: boolean; message: string; path?: string }> {
  try {
    if (!skill.frontmatter.name) {
      return { success: false, message: "Skill name is required." };
    }

    const dirName = skill.frontmatter.name.toLowerCase().replace(/\s+/g, "-");
    const targetDir = path.join(SKILLS_DIR, dirName);
    const targetPath = path.join(targetDir, "SKILL.md");

    await fs.mkdir(targetDir, { recursive: true });

    const markdown = skillToMarkdown(skill);
    await fs.writeFile(targetPath, markdown, "utf-8");

    return { success: true, message: `Skill written to ${targetPath}`, path: targetPath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Write failed: ${msg}` };
  }
}
