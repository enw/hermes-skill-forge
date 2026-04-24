"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { InputWithMic } from "@/components/input-with-mic";
import { Badge } from "@/components/ui/badge";
import { SkillCard } from "./skill-card";
import { ParsedSkill } from "@/lib/skill-schema";
import { validateSkill } from "@/lib/skill-parser";
import { Search, Tag, X, SlidersHorizontal, ArrowUpDown, FolderOpen, AlertTriangle, Paperclip, CheckCircle2 } from "lucide-react";

type SortKey = "name-asc" | "name-desc" | "category";

export function SkillDirectory({
  initialSkills,
  allTags,
}: {
  initialSkills: ParsedSkill[];
  allTags: string[];
}) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name-asc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [filterHasLinked, setFilterHasLinked] = useState<boolean | null>(null);
  const [filterHasPrereqs, setFilterHasPrereqs] = useState<boolean | null>(null);
  const [filterHasIssues, setFilterHasIssues] = useState<boolean | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of initialSkills) {
      const rel = s.sourcePath?.replace(/.*\.hermes\/skills\//, "") || "";
      const parts = rel.split("/");
      if (parts.length >= 1 && parts[0]) set.add(parts[0]);
    }
    return Array.from(set).sort();
  }, [initialSkills]);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const s of initialSkills) {
      (s.frontmatter.platforms || []).forEach((p) => set.add(p));
    }
    return Array.from(set).sort();
  }, [initialSkills]);

  const activeFilterCount =
    selectedTags.length +
    selectedCategories.length +
    selectedPlatforms.length +
    (filterHasLinked !== null ? 1 : 0) +
    (filterHasPrereqs !== null ? 1 : 0) +
    (filterHasIssues !== null ? 1 : 0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let result = initialSkills.filter((s) => {
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

      const rel = s.sourcePath?.replace(/.*\.hermes\/skills\//, "") || "";
      const cat = rel.split("/")[0] || "";
      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(cat);

      const matchesPlatforms =
        selectedPlatforms.length === 0 ||
        selectedPlatforms.every((p) =>
          (s.frontmatter.platforms || []).includes(p)
        );

      const matchesLinked =
        filterHasLinked === null ||
        (filterHasLinked ? s.linkedFiles.length > 0 : s.linkedFiles.length === 0);

      const hasPrereqs =
        (s.frontmatter.prerequisites?.commands?.length || 0) > 0 ||
        (s.frontmatter.prerequisites?.env_vars?.length || 0) > 0 ||
        (s.frontmatter.prerequisites?.packages?.length || 0) > 0 ||
        (s.frontmatter.required_commands?.length || 0) > 0 ||
        (s.frontmatter.required_environment_variables?.length || 0) > 0;
      const matchesPrereqs =
        filterHasPrereqs === null ||
        (filterHasPrereqs ? hasPrereqs : !hasPrereqs);

      const issues = validateSkill(s);
      const matchesIssues =
        filterHasIssues === null ||
        (filterHasIssues ? issues.length > 0 : issues.length === 0);

      return (
        matchesQuery &&
        matchesTags &&
        matchesCategory &&
        matchesPlatforms &&
        matchesLinked &&
        matchesPrereqs &&
        matchesIssues
      );
    });

    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case "name-asc":
          return (a.frontmatter.name || "").localeCompare(b.frontmatter.name || "");
        case "name-desc":
          return (b.frontmatter.name || "").localeCompare(a.frontmatter.name || "");
        case "category": {
          const ca = (a.sourcePath?.replace(/.*\.hermes\/skills\//, "").split("/")[0] || "");
          const cb = (b.sourcePath?.replace(/.*\.hermes\/skills\//, "").split("/")[0] || "");
          return ca.localeCompare(cb) || (a.frontmatter.name || "").localeCompare(b.frontmatter.name || "");
        }
      }
    });

    return result;
  }, [
    initialSkills,
    query,
    selectedTags,
    selectedCategories,
    selectedPlatforms,
    filterHasLinked,
    filterHasPrereqs,
    filterHasIssues,
    sortKey,
  ]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const clearAllFilters = () => {
    setQuery("");
    setSelectedTags([]);
    setSelectedCategories([]);
    setSelectedPlatforms([]);
    setFilterHasLinked(null);
    setFilterHasPrereqs(null);
    setFilterHasIssues(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <InputWithMic
            placeholder="Search skills..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-9 rounded-md border border-input bg-background pl-9 pr-6 text-sm"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="category">Category</option>
            </select>
          </div>
          <button
            onClick={() => setShowFilters((p) => !p)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm flex items-center gap-2 hover:bg-accent transition-colors"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="text-[10px] h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {categories.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <FolderOpen className="h-3.5 w-3.5" />
                Categories
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => toggleCategory(cat)} className="cursor-pointer">
                    <Badge
                      variant={selectedCategories.includes(cat) ? "default" : "outline"}
                      className="text-xs font-normal"
                    >
                      {cat}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {platforms.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Platforms
              </div>
              <div className="flex flex-wrap gap-2">
                {platforms.map((p) => (
                  <button key={p} onClick={() => togglePlatform(p)} className="cursor-pointer">
                    <Badge
                      variant={selectedPlatforms.includes(p) ? "default" : "outline"}
                      className="text-xs font-normal"
                    >
                      {p}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Properties
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "linked", label: "Has linked files", state: filterHasLinked, set: setFilterHasLinked },
                { key: "prereqs", label: "Has prerequisites", state: filterHasPrereqs, set: setFilterHasPrereqs },
                { key: "issues", label: "Has issues", state: filterHasIssues, set: setFilterHasIssues },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => {
                    if (f.state === true) f.set(false);
                    else if (f.state === false) f.set(null);
                    else f.set(true);
                  }}
                  className="cursor-pointer"
                >
                  <Badge
                    variant={f.state !== null ? "default" : "outline"}
                    className="text-xs font-normal gap-1"
                  >
                    {f.state === true && <CheckCircle2 className="h-3 w-3" />}
                    {f.state === false && <X className="h-3 w-3" />}
                    {f.label}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Clear all filters
            </button>
          )}
        </div>
      )}

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

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {initialSkills.length} skills
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground space-y-3">
          <AlertTriangle className="h-8 w-8 mx-auto opacity-50" />
          <p>No skills match your filters.</p>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-primary hover:underline"
            >
              Clear all filters
            </button>
          )}
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
