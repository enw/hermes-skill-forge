import fs from "fs/promises";
import path from "path";

const SESSIONS_DIR = path.join(process.env.HOME || "~", ".hermes", "sessions");
const LOGS_DIR = path.join(process.env.HOME || "~", ".hermes", "logs");
const FORGE_USAGE_PATH = path.join(process.env.HOME || "~", ".hermes", "skill-forge-usage.json");

export interface SkillUsageEvent {
  skillId: string;
  skillName: string;
  timestamp: string;
  source: "session" | "cron" | "gateway" | "forge-view" | "forge-edit";
  platform?: string;
}

export interface SkillUsageStats {
  skillId: string;
  skillName: string;
  totalUses: number;
  lastUsed: string;
  bySource: Record<string, number>;
  byPlatform: Record<string, number>;
  timeline: { date: string; count: number }[];
}

function extractSkillNameFromArgs(argsStr: string): string | null {
  try {
    const args = JSON.parse(argsStr);
    return args.name || args.skill || null;
  } catch {
    // Try regex fallback
    const match = argsStr.match(/"name"\s*:\s*"([^"]+)"/);
    return match ? match[1] : null;
  }
}

function normalizeSkillId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

async function parseSessions(): Promise<SkillUsageEvent[]> {
  const events: SkillUsageEvent[] = [];

  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

    for (const file of jsonlFiles.slice(-50)) {
      const filePath = path.join(SESSIONS_DIR, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n").filter(Boolean);

        let platform = "cli";
        let sessionDate = "";

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);

            if (entry.role === "session_meta") {
              platform = entry.platform || "cli";
              sessionDate = entry.timestamp?.slice(0, 10) || "";
              continue;
            }

            // Detect skill_view tool calls
            if (entry.tool_calls) {
              for (const tc of entry.tool_calls) {
                if (tc.function?.name === "skill_view") {
                  const name = extractSkillNameFromArgs(tc.function.arguments);
                  if (name) {
                    events.push({
                      skillId: normalizeSkillId(name),
                      skillName: name,
                      timestamp: entry.timestamp || `${sessionDate}T00:00:00`,
                      source: "session",
                      platform,
                    });
                  }
                }
                if (tc.function?.name === "skills_list") {
                  events.push({
                    skillId: "_skills_list",
                    skillName: "skills_list",
                    timestamp: entry.timestamp || `${sessionDate}T00:00:00`,
                    source: "session",
                    platform,
                  });
                }
              }
            }

            // Detect /skill slash commands in user messages
            if (entry.role === "user" && entry.content) {
              const skillMatch = entry.content.match(/\/skill\s+(\S+)/);
              if (skillMatch) {
                events.push({
                  skillId: normalizeSkillId(skillMatch[1]),
                  skillName: skillMatch[1],
                  timestamp: entry.timestamp || `${sessionDate}T00:00:00`,
                  source: "session",
                  platform,
                });
              }
            }

            // Detect skill mentions in assistant content
            if (entry.role === "assistant" && entry.content) {
              const loadedMatch = entry.content.match(/skill[_\s]?view\(.*?(\w+(?:[-_]\w+)*)\)/i);
              if (loadedMatch) {
                events.push({
                  skillId: normalizeSkillId(loadedMatch[1]),
                  skillName: loadedMatch[1],
                  timestamp: entry.timestamp || `${sessionDate}T00:00:00`,
                  source: "session",
                  platform,
                });
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // sessions dir may not exist
  }

  return events;
}

async function parseLogs(): Promise<SkillUsageEvent[]> {
  const events: SkillUsageEvent[] = [];

  try {
    const agentLogPath = path.join(LOGS_DIR, "agent.log");
    const content = await fs.readFile(agentLogPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    for (const line of lines) {
      // Parse cron skill loading
      const cronMatch = line.match(/Cron job '([^']+)': skill not found.*?Skill '([^']+)'/);
      if (cronMatch) {
        const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})/);
        events.push({
          skillId: normalizeSkillId(cronMatch[2]),
          skillName: cronMatch[2],
          timestamp: dateMatch ? `${dateMatch[1]}T00:00:00` : new Date().toISOString(),
          source: "cron",
        });
        continue;
      }

      // Parse skill list loading
      const loadedMatch = line.match(/loaded skills?:\s*\[?([^\]]+)\]?/i);
      if (loadedMatch) {
        const skills = loadedMatch[1].split(/,\s*/).map((s) => s.trim().replace(/["']/g, ""));
        const dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})/);
        for (const skill of skills) {
          if (skill) {
            events.push({
              skillId: normalizeSkillId(skill),
              skillName: skill,
              timestamp: dateMatch ? `${dateMatch[1]}T00:00:00` : new Date().toISOString(),
              source: "gateway",
            });
          }
        }
      }
    }
  } catch {
    // log file may not exist
  }

  return events;
}

async function loadForgeUsage(): Promise<SkillUsageEvent[]> {
  try {
    const content = await fs.readFile(FORGE_USAGE_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function getAllUsageEvents(): Promise<SkillUsageEvent[]> {
  const [sessionEvents, logEvents, forgeEvents] = await Promise.all([
    parseSessions(),
    parseLogs(),
    loadForgeUsage(),
  ]);
  return [...sessionEvents, ...logEvents, ...forgeEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function getUsageStats(): Promise<SkillUsageStats[]> {
  const events = await getAllUsageEvents();
  const map = new Map<string, SkillUsageStats>();

  for (const event of events) {
    if (event.skillId === "_skills_list") continue;

    const existing = map.get(event.skillId);
    if (existing) {
      existing.totalUses++;
      if (event.timestamp > existing.lastUsed) existing.lastUsed = event.timestamp;
      existing.bySource[event.source] = (existing.bySource[event.source] || 0) + 1;
      if (event.platform) {
        existing.byPlatform[event.platform] = (existing.byPlatform[event.platform] || 0) + 1;
      }
    } else {
      map.set(event.skillId, {
        skillId: event.skillId,
        skillName: event.skillName,
        totalUses: 1,
        lastUsed: event.timestamp,
        bySource: { [event.source]: 1 },
        byPlatform: event.platform ? { [event.platform]: 1 } : {},
        timeline: [],
      });
    }
  }

  // Build timeline
  const byDate = new Map<string, Map<string, number>>();
  for (const event of events) {
    if (event.skillId === "_skills_list") continue;
    const date = event.timestamp.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, new Map());
    const skillMap = byDate.get(date)!;
    skillMap.set(event.skillId, (skillMap.get(event.skillId) || 0) + 1);
  }

  for (const [skillId, stat] of map) {
    const timeline: { date: string; count: number }[] = [];
    for (const [date, skillMap] of byDate) {
      const count = skillMap.get(skillId) || 0;
      if (count > 0) timeline.push({ date, count });
    }
    stat.timeline = timeline.sort((a, b) => a.date.localeCompare(b.date));
  }

  return Array.from(map.values()).sort((a, b) => b.totalUses - a.totalUses);
}

export async function recordForgeEvent(
  skillId: string,
  skillName: string,
  action: "view" | "edit"
): Promise<void> {
  const events = await loadForgeUsage();
  events.push({
    skillId,
    skillName,
    timestamp: new Date().toISOString(),
    source: action === "view" ? "forge-view" : "forge-edit",
  });
  // Keep last 5000 events
  const trimmed = events.slice(-5000);
  await fs.writeFile(FORGE_USAGE_PATH, JSON.stringify(trimmed, null, 2));
}
