import { getSkillById } from "@/lib/skills-loader";
import { validateSkill } from "@/lib/skill-parser";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { LinkedFilesEditor } from "@/components/linked-files-editor";

export default async function SkillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const skill = await getSkillById(id);
  if (!skill) notFound();

  const issues = validateSkill(skill);
  const skillDir = skill.sourcePath ? skill.sourcePath.replace(/\/SKILL\.md$/, "") : "";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {skill.frontmatter.name || "Unnamed Skill"}
        </h1>
        <p className="text-muted-foreground mt-1">{skill.frontmatter.description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {skill.frontmatter.version && (
          <Badge variant="outline">v{skill.frontmatter.version}</Badge>
        )}
        {skill.frontmatter.author && (
          <Badge variant="outline">{skill.frontmatter.author}</Badge>
        )}
        {skill.frontmatter.license && (
          <Badge variant="outline">{skill.frontmatter.license}</Badge>
        )}
        {(skill.frontmatter.platforms || []).map((p: string) => (
          <Badge key={p} variant="secondary">{p}</Badge>
        ))}
        {(skill.frontmatter.tags || []).map((t: string) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Validation ({issues.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {issues.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              No issues found.
            </div>
          ) : (
            issues.map((issue, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-sm rounded-md px-3 py-2 ${
                  issue.type === "error"
                    ? "bg-destructive/10 text-destructive"
                    : issue.type === "warning"
                    ? "bg-amber-500/10 text-amber-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {issue.type === "error" ? (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                ) : issue.type === "warning" ? (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{issue.message}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Body Preview
        </h2>
        <div className="bg-muted rounded-md p-4 overflow-x-auto">
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
            {skill.body.slice(0, 3000)}
            {skill.body.length > 3000 && "\n\n... (truncated)"}
          </pre>
        </div>
      </div>

      {skill.frontmatter.prerequisites && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Prerequisites
          </h2>
          <div className="bg-muted rounded-md p-4 text-sm space-y-2">
            {skill.frontmatter.prerequisites.commands && (
              <div>
                <span className="font-medium">Commands:</span>{" "}
                {skill.frontmatter.prerequisites.commands.join(", ")}
              </div>
            )}
            {skill.frontmatter.prerequisites.env_vars && (
              <div>
                <span className="font-medium">Env Vars:</span>{" "}
                {skill.frontmatter.prerequisites.env_vars.join(", ")}
              </div>
            )}
            {skill.frontmatter.prerequisites.packages && (
              <div>
                <span className="font-medium">Packages:</span>{" "}
                {skill.frontmatter.prerequisites.packages.join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      {skillDir && (
        <>
          <Separator />
          <LinkedFilesEditor skillDirPath={skillDir} linkedFiles={skill.linkedFiles} />
        </>
      )}
    </div>
  );
}
