import matter from "gray-matter";
import { SkillFrontmatter, ParsedSkill, LinkedFile, ValidationIssue, REQUIRED_FIELDS } from "./skill-schema";

/** Stable unique id: relative path under .hermes/skills/ when available, else name slug. */
function computeSkillId(fm: Partial<SkillFrontmatter>, sourcePath?: string): string {
  const normalized = sourcePath?.replace(/\\/g, "/");
  if (normalized && /\.hermes\/skills\//i.test(normalized)) {
    const rel = normalized
      .replace(/.*\.hermes\/skills\//i, "")
      .replace(/\/SKILL\.md$/i, "");
    if (rel.length > 0 && !rel.startsWith("/") && !rel.includes("..")) {
      return rel;
    }
  }
  return fm.name?.toLowerCase().replace(/\s+/g, "-") || "unnamed";
}

export function parseSkill(content: string, sourcePath?: string): ParsedSkill {
  const parsed = matter(content);
  const fm = parsed.data as Partial<SkillFrontmatter>;

  // Normalize arrays
  const rawFm = fm as Record<string, unknown>;
  if (typeof rawFm.tags === "string") (fm as Record<string, unknown>).tags = rawFm.tags.split(/,\s*/).filter(Boolean);
  if (typeof rawFm.platforms === "string") (fm as Record<string, unknown>).platforms = rawFm.platforms.split(/,\s*/).filter(Boolean);

  return {
    id: computeSkillId(fm, sourcePath),
    frontmatter: fm as SkillFrontmatter,
    body: parsed.content,
    linkedFiles: [],
    raw: content,
    sourcePath,
  };
}

export function validateSkill(skill: ParsedSkill): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!skill.frontmatter[field]) {
      issues.push({
        type: "error",
        message: `Missing required frontmatter field: ${field}`,
        field,
      });
    }
  }

  if (!skill.body || skill.body.trim().length < 50) {
    issues.push({
      type: "warning",
      message: "Skill body is very short. Add more detailed instructions.",
    });
  }

  // Check for broken command references in prerequisites
  const prereq = skill.frontmatter.prerequisites;
  if (prereq?.commands) {
    for (const cmd of prereq.commands) {
      if (cmd.includes(" ") && !cmd.startsWith("`")) {
        issues.push({
          type: "info",
          message: `Command prerequisite "${cmd}" should be wrapped in backticks for clarity.`,
          field: "prerequisites.commands",
        });
      }
    }
  }

  // Check for env vars without descriptions
  const envVars = skill.frontmatter.required_environment_variables || prereq?.env_vars;
  if (envVars && envVars.length > 0) {
    const bodyLower = skill.body.toLowerCase();
    for (const env of envVars) {
      if (!bodyLower.includes(env.toLowerCase())) {
        issues.push({
          type: "warning",
          message: `Required env var "${env}" is not mentioned in the skill body.`,
          field: "required_environment_variables",
        });
      }
    }
  }

  // Check for toolset references in body vs metadata
  const toolsetMatches = skill.body.match(/tools?:\s*\[([^\]]+)\]/g);
  if (toolsetMatches && !skill.frontmatter.metadata?.hermes?.tags?.some(t => t.toLowerCase().includes("tool"))) {
    issues.push({
      type: "info",
      message: "Skill body references tools but metadata does not tag them.",
    });
  }

  return issues;
}

export function skillToMarkdown(skill: ParsedSkill): string {
  const fm = { ...skill.frontmatter };
  // Clean undefined values
  Object.keys(fm).forEach((k) => {
    const key = k as keyof SkillFrontmatter;
    if (fm[key] === undefined) delete fm[key];
  });

  const yaml = matter.stringify("", fm);
  // gray-matter puts the delimiter on its own, we need to reconstruct
  const parts = yaml.split("---\n");
  const front = parts[1] || "";
  return `---\n${front}---\n\n${skill.body.trim()}\n`;
}
