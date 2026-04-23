'use client';

import { useState, useEffect } from 'react';
import { generateSkill, saveSkill } from '@/app/forge/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import type { Message } from './skill-wizard-chat';

type GeneratedSkill = {
  name: string;
  category: string;
  skillMd: string;
  linkedFiles?: Array<{ path: string; content: string }>;
};

export function SkillWizardPreview({
  messages,
  onBack,
}: {
  messages: Message[];
  onBack: () => void;
}) {
  const [result, setResult] = useState<GeneratedSkill | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    generateSkill(messages)
      .then((data) => {
        if (!cancelled) setResult(data as GeneratedSkill);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [messages]);

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError('');
    try {
      await saveSkill(result.name, result.skillMd, result.linkedFiles);
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Forging skill...
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Preview: {result.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {result.category}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button onClick={handleSave} disabled={saving || saved}>
            {saved ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save Skill'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" /> SKILL.md
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed bg-muted p-4 rounded-md overflow-x-auto max-h-[400px] overflow-y-auto">
            {result.skillMd}
          </pre>
        </CardContent>
      </Card>

      {result.linkedFiles && result.linkedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Linked Files ({result.linkedFiles.length})
          </h3>
          {result.linkedFiles.map((file, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {file.path}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed bg-muted p-4 rounded-md overflow-x-auto max-h-[200px] overflow-y-auto">
                  {file.content}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
