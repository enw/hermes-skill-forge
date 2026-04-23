import { loadAllSkills, getSkillTags } from "@/lib/skills-loader";
import { SkillDirectory } from "@/components/skill-directory";

export default async function Home() {
  const skills = await loadAllSkills();
  const allTags = await getSkillTags(skills);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Skill Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {skills.length} skills loaded from ~/.hermes/skills/
          </p>
        </div>
      </div>
      <SkillDirectory initialSkills={skills} allTags={allTags} />
    </div>
  );
}
