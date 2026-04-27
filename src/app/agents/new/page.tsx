'use client';

import { useState } from 'react';
import { interviewAgent, generateAgent, saveAgent } from '@/app/agents/new/actions';
import type { BDIAgent } from '@/lib/agent-state';
import { useRouter } from 'next/navigation';
import MarkdownMessage from '@/components/markdown-message';

export default function NewAgentPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'chat' | 'preview' | 'saving'>('chat');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: "What autonomous agent do you want to create? Describe its domain, what goals it should achieve, any constraints on its behavior, and how often it should run."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentSpec, setAgentSpec] = useState<Omit<BDIAgent, 'name'> | null>(null);
  const [agentName, setAgentName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    
    const updatedMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(updatedMessages);
    
    setLoading(true);
    const reply = await interviewAgent(updatedMessages);
    setMessages(prev => [...prev, { role: 'assistant' as const, content: reply }]);
    setLoading(false);
  };

  const forge = async () => {
    setLoading(true);
    const spec = await generateAgent(messages);
    setAgentSpec(spec);
    // Extract name from the messages or let user set it
    const generatedName = messages.find(m => m.role === 'user')?.content
      ?.match(/agent[:\s]+([a-z0-9-]+)/i)?.[1] || 'new-agent';
    setAgentName(generatedName);
    setPhase('preview');
    setLoading(false);
  };

  const save = async () => {
    if (!agentSpec) return;
    setPhase('saving');
    setSaveMessage('Creating agent...');
    const result = await saveAgent(agentName, agentSpec);
    setSaveMessage(`Saved to ${result.path}`);
    
    setTimeout(() => {
      router.push(`/agents/${agentName}`);
    }, 1500);
  };

  if (phase === 'saving') {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <div className="animate-pulse text-4xl">⚙️</div>
        <h2 className="text-xl font-semibold">Creating Agent</h2>
        <p className="text-muted-foreground">{saveMessage}</p>
      </div>
    );
  }

  if (phase === 'preview' && agentSpec) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Preview: {agentName}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setPhase('chat')}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-10 px-4"
            >
              Back to Chat
            </button>
            <button
              onClick={save}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4"
            >
              Save Agent
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">BDI Structure</h2>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-blue-400">Desires</h3>
              <ul className="text-sm space-y-1">
                {agentSpec.desires.goals.map((g, i) => (
                  <li key={i} className="text-muted-foreground">🎯 {g}</li>
                ))}
              </ul>
              {agentSpec.desires.priority && (
                <div className="text-xs text-muted-foreground">Priority: {agentSpec.desires.priority}</div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-amber-400">Intentions</h3>
              <ul className="text-sm space-y-1">
                {agentSpec.intentions.constraints.map((c, i) => (
                  <li key={i} className="text-muted-foreground">📋 {c}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-emerald-400">Beliefs Schema</h3>
              <ul className="text-sm space-y-1">
                {agentSpec.beliefs.schema.map((s, i) => (
                  <li key={i} className="text-muted-foreground">📊 {s}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Heartbeat</h3>
              <div className="text-sm text-muted-foreground">
                Schedule: {agentSpec.heartbeat.schedule}
                {agentSpec.heartbeat.model && ` · Model: ${agentSpec.heartbeat.model}`}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Tools</h3>
              <div className="text-xs text-muted-foreground">
                Allowed: {agentSpec.tools.allowed.join(', ')}
              </div>
              {agentSpec.tools.forbidden.length > 0 && (
                <div className="text-xs text-red-400">
                  Forbidden: {agentSpec.tools.forbidden.join(', ')}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-3">Agent Spec (raw)</h2>
            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
              {JSON.stringify({ name: agentName, ...agentSpec }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Chat phase
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Forge a New Agent</h1>
        <p className="text-muted-foreground">
          Describe the autonomous agent you want. The AI will interview you, then generate a BDI-structured AGENT.md.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground prose-sm'
                    : 'bg-muted'
                }`}>
                  {m.role === 'user' ? (
                    <div>{m.content}</div>
                  ) : (
                    <MarkdownMessage content={m.content} role={m.role} />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-3 text-sm">Thinking...</div>
              </div>
            )}
          </div>

          <div className="border-t p-4 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Describe your agent..."
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 disabled:opacity-50"
            >
              Send
            </button>
            <button
              onClick={forge}
              disabled={messages.length <= 1 || loading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white h-10 px-4 disabled:opacity-50"
            >
              Forge Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
