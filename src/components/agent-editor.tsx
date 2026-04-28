'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Save, GitBranch, FileCode, Trash2, Clock } from 'lucide-react';
import type { BDIAgent } from '@/lib/agent-state';

export interface AgentEditorProps {
  agentName: string;
  agentData: BDIAgent | null;
  isDeployed: boolean;
  onDeploy: () => Promise<void>;
  onRun: () => Promise<void>;
  onStop: () => Promise<void>;
}

export function AgentEditor({ 
  agentName, 
  agentData, 
  isDeployed,
  onDeploy, 
  onRun, 
  onStop 
}: AgentEditorProps) {
  const [fileContent, setFileContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [lastModified, setLastModified] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [gitState, setGitState] = useState({
    lastCommit: 'Never',
    lastCommitMessage: '',
    lastCommitDate: null as Date | null
  });

  useEffect(() => {
    if (agentData) {
      const markdown = `---
name: ${agentData.name}
type: ${agentData.type}
soul:
  persona: ${agentData.soul.persona}
  voice: ${agentData.soul.voice}
desires:
  goals:
    ${agentData.desires.goals.map(g => `- ${g}`).join('\n')}
${agentData.desires.priority ? `priority: ${agentData.desires.priority}\n` : ''}
${agentData.desires.successCriteria ? `successCriteria: ${agentData.desires.successCriteria}\n` : ''}
intentions:
  constraints:
    ${agentData.intentions.constraints.map(c => `- ${c}`).join('\n')}
${agentData.intentions.planningStrategy ? `planningStrategy: ${agentData.intentions.planningStrategy}\n` : ''}
beliefs:
  schema:
    ${agentData.beliefs.schema.map(s => `- ${s}`).join('\n')}
  statePath: ${agentData.beliefs.statePath}
tools:
  allowed:
    ${agentData.tools.allowed.map(t => `- ${t}`).join('\n')}
${agentData.tools.forbidden.length > 0 ? `forbidden:\n    ${agentData.tools.forbidden.map(t => `- ${t}`).join('\n')}\n` : ''}
heartbeat:
  schedule: ${agentData.heartbeat.schedule}
${agentData.heartbeat.model ? `  model: ${agentData.heartbeat.model}` : ''}
${agentData.heartbeat.profile ? `  profile: ${agentData.heartbeat.profile}` : ''}
---
`;
      setFileContent(markdown);
      setEditedContent(markdown);
    }
  }, [agentData]);

  useEffect(() => {
    if (agentData && lastModified) {
      const lastModDate = new Date(lastModified);
      const now = new Date();
      const diffMs = now.getTime() - lastModDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) {
        setStatus('saved');
      } else if (diffMins < 5) {
        setStatus('idle');
      }
    }
  }, [agentData, lastModified]);

  const handleToggleEdit = () => {
    if (!isEditing) {
      setEditedContent(fileContent);
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      const fullContent = `---
name: ${agentName}
type: content-extraction
soul:
  persona: You are a ${agentName} agent
  voice: professional, precise, thorough
desires:
  goals:
    - ${editedContent.split('---\n')[1]?.split('\n')[0]?.split('\n')[0] || 'Extract insights'}
  priority: medium
  successCriteria: Task completed
intentions:
  constraints:
    - Only use allowed tools
    - Respect rate limits
  planningStrategy: sequential processing
beliefs:
  schema:
    - worldState
    - lastObserved
    - observations
  statePath: ~/.hermes/agents/${agentName}/state.json
tools:
  allowed:
    - terminal
    - file
    - web_search
    - web_extract
  forbidden:
    - delegate_task
heartbeat:
  schedule: every 6h
  model: anthropic/claude-sonnet-4
---

${editedContent.split('---\n')[1] || ''}
`;
      const response = await fetch(`/api/agents/save?agent=${agentName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fullContent })
      });
      
      if (response.ok) {
        setFileContent(editedContent);
        setStatus('saved');
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Save error:', error);
      setStatus('error');
    }
    setStatus('idle');
  };

  const handleDiscard = () => {
    if (agentData) {
      const markdown = `---
name: ${agentData.name}
type: ${agentData.type}
soul:
  persona: ${agentData.soul.persona}
  voice: ${agentData.soul.voice}
desires:
  goals:
    ${agentData.desires.goals.map(g => `- ${g}`).join('\n')}
${agentData.desires.priority ? `priority: ${agentData.desires.priority}\n` : ''}
${agentData.desires.successCriteria ? `successCriteria: ${agentData.desires.successCriteria}\n` : ''}
intentions:
  constraints:
    ${agentData.intentions.constraints.map(c => `- ${c}`).join('\n')}
${agentData.intentions.planningStrategy ? `planningStrategy: ${agentData.intentions.planningStrategy}\n` : ''}
beliefs:
  schema:
    ${agentData.beliefs.schema.map(s => `- ${s}`).join('\n')}
  statePath: ${agentData.beliefs.statePath}
tools:
  allowed:
    ${agentData.tools.allowed.map(t => `- ${t}`).join('\n')}
${agentData.tools.forbidden.length > 0 ? `forbidden:\n    ${agentData.tools.forbidden.map(t => `- ${t}`).join('\n')}\n` : ''}
heartbeat:
  schedule: ${agentData.heartbeat.schedule}
${agentData.heartbeat.model ? `  model: ${agentData.heartbeat.model}` : ''}
${agentData.heartbeat.profile ? `  profile: ${agentData.heartbeat.profile}` : ''}
---
`;
      setFileContent(markdown);
      setEditedContent(markdown);
      setIsEditing(false);
      setStatus('saved');
    }
  };

  const handleCommit = async (message: string) => {
    try {
      const response = await fetch(`/api/agents/git?agent=${agentName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content: editedContent })
      });
      
      if (response.ok) {
        const data = await response.json();
        setGitState({
          lastCommit: data.commit?.hash || 'N/A',
          lastCommitMessage: message,
          lastCommitDate: data.commit?.date ? new Date(data.commit.date) : null
        });
        setStatus('saved');
      }
    } catch (error) {
      console.error('Git commit error:', error);
    }
  };

  if (!agentData) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Loading agent...
      </div>
    );
  }

  const fileLocation = agentData.beliefs.statePath.replace('~', process.env.HOME || '/Users/enw');
  
  return (
    <div className="space-y-4">
      {/* Header with warning */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{agentData.name}</h1>
              <Badge variant={isDeployed ? "default" : "secondary"}>
                {isDeployed ? 'Deployed' : 'Not deployed'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Agent ID cannot be changed after creation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={isEditing ? "edit" : "view"} onValueChange={(v) => v === "edit" && handleToggleEdit()}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View</SelectItem>
                <SelectItem value="edit">Edit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* File location */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <FileCode className="h-3 w-3" />
          <span>File: {fileLocation}/AGENT.md</span>
        </div>

        {/* Git status */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <GitBranch className="h-3 w-3" />
          <span>Git: {gitState.lastCommit || 'Never committed'}</span>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <Clock className="h-3 w-3" />
          <span>
            Last modified: {lastModified || 'Never'}
            {status === 'saved' && ' (saved)'}
            {status === 'saving' && ' (saving...)'}
            {status === 'error' && ' (error)'}
          </span>
        </div>
      </div>

      {/* Editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Agent Definition (AGENT.md)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Textarea
              value={isEditing ? editedContent : fileContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="font-mono text-xs min-h-[400px] resize-none"
              placeholder="Edit your agent definition here..."
              readOnly={!isEditing}
            />
            
            {isEditing && (
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  onClick={handleSave}
                  disabled={status === 'saving'}
                >
                  <Save className="h-3 w-3 mr-1" />
                  {status === 'saving' ? 'Saving...' : 'Save'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleDiscard}
                >
                  Discard
                </Button>
              </div>
            )}
            
            {!isEditing && (
              <div className="flex items-center justify-between">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleToggleEdit}
                >
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={async () => {
                    setStatus('saving');
                    await handleCommit('Edit agent definition');
                  }}
                  disabled={status === 'saving'}
                >
                  <GitBranch className="h-3 w-3 mr-1" />
                  Commit to Git
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {isDeployed ? (
          <Button 
            variant="destructive" 
            size="sm"
            onClick={onStop}
          >
            Stop Agent
          </Button>
        ) : (
          <Button 
            variant="default" 
            size="sm"
            onClick={onDeploy}
          >
            Deploy Agent
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onRun}
        >
          Run Now
        </Button>
      </div>

      {/* Status indicator */}
      {status === 'error' && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Save failed. Check your connection.
        </div>
      )}
    </div>
  );
}
