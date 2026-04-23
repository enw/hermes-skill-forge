"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SkillCard } from "./skill-card";
import { ParsedSkill } from "@/lib/skill-schema";
import { Search, Tag, X } from "lucide-react";

export function SkillDirectory({
  initialSkills,
  allTags,
}: {
  initialSkills: ParsedSkill[];
  allTags: string[];
}) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return initialSkills.filter((s) => {
      const matchesQuery =
        !q ||
        s.frontmatter.name.toLowerCase().includes(q) ||
        s.frontmatter.description.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q);

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => {
          const tags = [
            ...(s.frontmatter.tags || []),
            ...(s.frontmatter.metadata?.hermes?.tags || []),
          ].map((t) => t.toLowerCase());
          return tags.includes(tag.toLowerCase());
        });

      return matchesQuery && matchesTags;
    });
  }, [initialSkills, query, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          {allTags.slice(0, 40).map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className="cursor-pointer"
            >
              <Badge
                variant={selectedTags.includes(tag) ? "default" : "secondary"}
                className="text-xs font-normal"
              >
                {tag}
              </Badge>
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-2"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          No skills match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}
