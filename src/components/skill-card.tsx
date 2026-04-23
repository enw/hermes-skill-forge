"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParsedSkill } from "@/lib/skill-schema";
import { FileText, AlertCircle, FolderOpen } from "lucide-react";

export function SkillCard({ skill }: { skill: ParsedSkill }) {
  const tags = [
    ...(skill.frontmatter.tags || []),
    ...(skill.frontmatter.metadata?.hermes?.tags || []),
  ];

  const issues = skill.frontmatter.name && skill.frontmatter.description ? 0 : 1;

  const category = (skill.sourcePath?.replace(/.*\.hermes\/skills\//, "").split("/")[0] || "");

  return (
    <Link href={`/skill/${encodeURIComponent(skill.id)}`} className="block group">
      <Card className="h-full transition-colors hover:border-foreground/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-medium text-sm leading-tight line-clamp-1">
                {skill.frontmatter.name || "Unnamed Skill"}
              </h3>
            </div>
            {issues > 0 && (
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-xs text-muted-foreground line-clamp-3">
            {skill.frontmatter.description || "No description provided."}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 5).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            {category && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <FolderOpen className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{category}</span>
              </div>
            )}
            <div className="text-[10px] text-muted-foreground/60 font-mono truncate ml-auto">
              {skill.linkedFiles.length > 0 && `${skill.linkedFiles.length} file${skill.linkedFiles.length > 1 ? "s" : ""}`}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
