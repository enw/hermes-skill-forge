"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ParsedSkill, ValidationIssue } from "@/lib/skill-schema";
import { parseSkill, validateSkill, skillToMarkdown } from "@/lib/skill-parser";
import { writeSkillToDisk } from "@/app/build/actions";
import { Copy, Check, Download, AlertCircle, Info, Wand2, Save } from "lucide-react";

const EMPTY_SKILL: ParsedSkill = {
  id: "new-skill",
  frontmatter: {
    name: "",
    description: "",
    version: "1.0.0",
    author: "",
    license: "MIT",
    tags: [],
    platforms: [],
  },
  body: "# New Skill\n\n## When to Use\n\nDescribe when this skill activates.\n\n## Workflow\n\n1. Step one\n2. Step two\n3. Step three\n\n## Rules\n\n- Rule one\n- Rule two\n",
  linkedFiles: [],
  raw: "",
};

export function SkillBuilder() {
  const [skill, setSkill] = useState<ParsedSkill>(EMPTY_SKILL);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState("form");

  const issues = useMemo(() => validateSkill(skill), [skill]);
  const markdown = useMemo(() => skillToMarkdown(skill), [skill]);

  const updateFrontmatter = (field: string, value: unknown) => {
    setSkill((prev) => ({
      ...prev,
      frontmatter: { ...prev.frontmatter, [field]: value },
    }));
  };

  const parseFromMarkdown = (raw: string) => {
    try {
      const parsed = parseSkill(raw);
      setSkill(parsed);
    } catch {
      // ignore parse errors while typing
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSkill = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${skill.frontmatter.name?.toLowerCase().replace(/\s+/g, "-") || "skill"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    setSaveStatus("Saving...");
    const res = await writeSkillToDisk(skill);
    setSaveStatus(res.message);
    if (res.success) {
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  const errorCount = issues.filter((i) => i.type === "error").length;
  const warningCount = issues.filter((i) => i.type === "warning").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {errorCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" /> {errorCount} error{errorCount > 1 ? "s" : ""}
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-700 hover:bg-amber-500/30">
            <AlertCircle className="h-3 w-3" /> {warningCount} warning{warningCount > 1 ? "s" : ""}
          </Badge>
        )}
        {errorCount === 0 && warningCount === 0 && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
            <Check className="h-3 w-3" /> Valid
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="preview">Live Preview</TabsTrigger>
          <TabsTrigger value="raw">Markdown</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={skill.frontmatter.name}
                onChange={(e) => updateFrontmatter("name", e.target.value)}
                placeholder="my-awesome-skill"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={skill.frontmatter.version || ""}
                onChange={(e) => updateFrontmatter("version", e.target.value)}
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={skill.frontmatter.description}
                onChange={(e) => updateFrontmatter("description", e.target.value)}
                placeholder="One-line summary of what this skill does."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={skill.frontmatter.author || ""}
                onChange={(e) => updateFrontmatter("author", e.target.value)}
                placeholder="Your Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license">License</Label>
              <Input
                id="license"
                value={skill.frontmatter.license || ""}
                onChange={(e) => updateFrontmatter("license", e.target.value)}
                placeholder="MIT"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                value={(skill.frontmatter.tags || []).join(", ")}
                onChange={(e) =>
                  updateFrontmatter(
                    "tags",
                    e.target.value.split(/,\s*/).filter(Boolean)
                  )
                }
                placeholder="api, automation, data"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platforms">Platforms (comma separated)</Label>
              <Input
                id="platforms"
                value={(skill.frontmatter.platforms || []).join(", ")}
                onChange={(e) =>
                  updateFrontmatter(
                    "platforms",
                    e.target.value.split(/,\s*/).filter(Boolean)
                  )
                }
                placeholder="macos, linux"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Skill Body (Markdown) *</Label>
            <Textarea
              id="body"
              value={skill.body}
              onChange={(e) => setSkill((prev) => ({ ...prev, body: e.target.value }))}
              rows={20}
              className="font-mono text-sm"
              placeholder="# Skill Title\n\n## When to Use\n..."
            />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold">{skill.frontmatter.name || "Unnamed Skill"}</h2>
                <p className="text-muted-foreground">{skill.frontmatter.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {skill.frontmatter.version && (
                  <Badge variant="outline">v{skill.frontmatter.version}</Badge>
                )}
                {skill.frontmatter.author && (
                  <Badge variant="outline">{skill.frontmatter.author}</Badge>
                )}
                {(skill.frontmatter.tags || []).map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(skill.body) }} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw" className="space-y-4 mt-4">
          <div className="relative">
            <pre className="bg-muted rounded-md p-4 text-xs font-mono overflow-x-auto whitespace-pre">
              {markdown}
            </pre>
            <div className="absolute top-2 right-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={copyToClipboard}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="secondary" onClick={downloadSkill}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="default" onClick={handleSave} disabled={errorCount > 0}>
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
            {saveStatus && (
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/90 px-2 py-1 rounded">
                {saveStatus}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Paste existing SKILL.md here to import:
            </span>
          </div>
          <Textarea
            placeholder="Paste full markdown..."
            rows={8}
            className="font-mono text-xs"
            onChange={(e) => parseFromMarkdown(e.target.value)}
          />
        </TabsContent>
      </Tabs>

      {issues.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <h3 className="text-sm font-medium mb-3">Validation Issues</h3>
            {issues.map((issue, i) => (
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
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function renderMarkdownPreview(md: string): string {
  // Very lightweight markdown-to-html for preview only
  return md
    .replace(/^# (.*$)/gim, "<h1 class='text-xl font-bold mt-4 mb-2'>$1</h1>")
    .replace(/^## (.*$)/gim, "<h2 class='text-lg font-semibold mt-3 mb-2'>$1</h2>")
    .replace(/^### (.*$)/gim, "<h3 class='text-base font-medium mt-2 mb-1'>$1</h3>")
    .replace(/`([^`]+)`/g, "<code class='bg-muted px-1 py-0.5 rounded text-xs'>$1</code>")
    .replace(/^\- (.*$)/gim, "<li class='ml-4'>$1</li>")
    .replace(/^\d+\. (.*$)/gim, "<li class='ml-4'>$1</li>")
    .replace(/\n/g, "<br />");
}
