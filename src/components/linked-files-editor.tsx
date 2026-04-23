"use client";

import { useState } from "react";
import { LinkedFile } from "@/lib/skill-schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { readLinkedFile, writeLinkedFile, deleteLinkedFile } from "@/app/skill/[id]/actions";
import { FileText, Save, Trash2, Plus, X, FileCode } from "lucide-react";

interface LinkedFilesEditorProps {
  skillDirPath: string;
  linkedFiles: LinkedFile[];
}

const ALLOWED_DIRS = ["references", "templates", "scripts", "assets"];

export function LinkedFilesEditor({ skillDirPath, linkedFiles: initialFiles }: LinkedFilesEditorProps) {
  const [files, setFiles] = useState<LinkedFile[]>(initialFiles);
  const [activeFile, setActiveFile] = useState<string>(initialFiles[0]?.path || "");
  const [contents, setContents] = useState<Record<string, string>>(
    Object.fromEntries(initialFiles.map((f) => [f.path, f.content]))
  );
  const [status, setStatus] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newDir, setNewDir] = useState("references");
  const [newName, setNewName] = useState("");

  const activeContent = activeFile ? contents[activeFile] ?? "" : "";

  const handleSave = async (filePath: string) => {
    setStatus((prev) => ({ ...prev, [filePath]: "Saving..." }));
    const res = await writeLinkedFile(skillDirPath, filePath, contents[filePath] ?? "");
    setStatus((prev) => ({ ...prev, [filePath]: res.success ? "Saved" : res.message }));
    if (res.success) {
      setTimeout(() => setStatus((prev) => ({ ...prev, [filePath]: "" })), 2000);
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!confirm(`Delete ${filePath}?`)) return;
    const res = await deleteLinkedFile(skillDirPath, filePath);
    if (res.success) {
      setFiles((prev) => prev.filter((f) => f.path !== filePath));
      setActiveFile((prev) => {
        const remaining = files.filter((f) => f.path !== filePath);
        return remaining[0]?.path || "";
      });
      setContents((prev) => {
        const next = { ...prev };
        delete next[filePath];
        return next;
      });
    }
    setStatus((prev) => ({ ...prev, [filePath]: res.message }));
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const filePath = `${newDir}/${name}`;
    if (files.some((f) => f.path === filePath)) {
      setStatus((prev) => ({ ...prev, [filePath]: "File already exists." }));
      return;
    }
    const res = await writeLinkedFile(skillDirPath, filePath, "");
    if (res.success) {
      setFiles((prev) => [...prev, { path: filePath, content: "" }]);
      setContents((prev) => ({ ...prev, [filePath]: "" }));
      setActiveFile(filePath);
      setIsAdding(false);
      setNewName("");
    }
    setStatus((prev) => ({ ...prev, [filePath]: res.message }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <FileCode className="h-4 w-4" />
          Linked Files ({files.length})
        </h2>
        <Button size="sm" variant="outline" onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add File
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">New Linked File</span>
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Directory</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={newDir}
                  onChange={(e) => setNewDir(e.target.value)}
                >
                  {ALLOWED_DIRS.map((d) => (
                    <option key={d} value={d}>
                      {d}/
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Filename</Label>
                <Input
                  placeholder="example.md"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create
            </Button>
          </CardContent>
        </Card>
      )}

      {files.length === 0 && !isAdding && (
        <div className="text-sm text-muted-foreground bg-muted rounded-md p-4">
          No linked files. Skills can include references, templates, scripts, and assets in subdirectories.
        </div>
      )}

      {files.length > 0 && (
        <Tabs value={activeFile} onValueChange={setActiveFile} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 justify-start">
            {files.map((f) => (
              <TabsTrigger
                key={f.path}
                value={f.path}
                className="text-xs h-7 px-2 data-[state=active]:bg-background data-[state=active]:border data-[state=active]:shadow-sm border border-transparent"
              >
                <FileText className="h-3 w-3 mr-1" />
                {f.path}
              </TabsTrigger>
            ))}
          </TabsList>

          {files.map((f) => (
            <TabsContent key={f.path} value={f.path} className="mt-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">{f.path}</span>
                  <div className="flex items-center gap-2">
                    {status[f.path] && (
                      <span className="text-xs text-muted-foreground">{status[f.path]}</span>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => handleSave(f.path)}>
                      <Save className="h-3.5 w-3.5 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(f.path)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={contents[f.path] ?? ""}
                  onChange={(e) =>
                    setContents((prev) => ({ ...prev, [f.path]: e.target.value }))
                  }
                  rows={16}
                  className="font-mono text-sm"
                  placeholder={`Content for ${f.path}...`}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
