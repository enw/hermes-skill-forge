export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  author?: string;
  license?: string;
  platforms?: string[];
  tags?: string[];
  metadata?: {
    hermes?: {
      tags?: string[];
      category?: string;
      related_skills?: string[];
      config?: Array<{
        key: string;
        description: string;
        default?: string;
        prompt?: string;
      }>;
    };
  };
  prerequisites?: {
    commands?: string[];
    env_vars?: string[];
    packages?: string[];
  };
  required_environment_variables?: string[];
  required_commands?: string[];
  setup_needed?: boolean;
}

export interface LinkedFile {
  path: string;
  content: string;
}

export interface ParsedSkill {
  id: string;
  frontmatter: SkillFrontmatter;
  body: string;
  linkedFiles: LinkedFile[];
  raw: string;
  sourcePath?: string;
}

export interface ValidationIssue {
  type: "error" | "warning" | "info";
  message: string;
  line?: number;
  field?: string;
}

export const REQUIRED_FIELDS: (keyof SkillFrontmatter)[] = ["name", "description"];

export const SUGGESTED_FIELDS: (keyof SkillFrontmatter)[] = [
  "version",
  "author",
  "license",
  "tags",
];
