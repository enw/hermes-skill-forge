import { SkillBuilder } from "@/components/skill-builder";

export default function BuildPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Skill Builder</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Author a new Hermes skill with guided validation and live preview.
        </p>
      </div>
      <SkillBuilder />
    </div>
  );
}
