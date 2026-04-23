"use server";

import fs from "fs/promises";
import path from "path";

const SKILLS_DIR = process.env.SKILLS_DIR || path.join(process.env.HOME || "~", ".hermes", "skills");

export async function readLinkedFile(skillDirPath: string, filePath: string): Promise<{ success: boolean; content?: string; message?: string }> {
  try {
    // Security: ensure the resolved path stays within the skill directory
    const fullPath = path.resolve(path.join(skillDirPath, filePath));
    const resolvedSkillDir = path.resolve(skillDirPath);
    if (!fullPath.startsWith(resolvedSkillDir + path.sep) && fullPath !== resolvedSkillDir) {
      return { success: false, message: "Invalid file path." };
    }
    const content = await fs.readFile(fullPath, "utf-8");
    return { success: true, content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

export async function writeLinkedFile(skillDirPath: string, filePath: string, content: string): Promise<{ success: boolean; message: string }> {
  try {
    const fullPath = path.resolve(path.join(skillDirPath, filePath));
    const resolvedSkillDir = path.resolve(skillDirPath);
    if (!fullPath.startsWith(resolvedSkillDir + path.sep) && fullPath !== resolvedSkillDir) {
      return { success: false, message: "Invalid file path." };
    }
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    return { success: true, message: `Saved ${filePath}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Write failed: ${msg}` };
  }
}

export async function deleteLinkedFile(skillDirPath: string, filePath: string): Promise<{ success: boolean; message: string }> {
  try {
    const fullPath = path.resolve(path.join(skillDirPath, filePath));
    const resolvedSkillDir = path.resolve(skillDirPath);
    if (!fullPath.startsWith(resolvedSkillDir + path.sep) && fullPath !== resolvedSkillDir) {
      return { success: false, message: "Invalid file path." };
    }
    await fs.unlink(fullPath);
    return { success: true, message: `Deleted ${filePath}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Delete failed: ${msg}` };
  }
}
