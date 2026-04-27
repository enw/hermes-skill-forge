'use client';

import { useState } from 'react';
import { interviewAgent, generateAgent, saveAgent } from '@/app/agents/new/actions';
import type { AgentState } from '@/lib/agent-state';
import { useRouter } from 'next/navigation';

export default function NewAgentPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'chat' | 'preview' | 'saving'>('chat');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: "What would you like this autonomous agent to do? Describe the corpus it should manage, what quality means to you, and what actions it should take."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentSpec, setAgentSpec] = useState<AgentState | null>(null);
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
    setPhase('preview');
    setLoading(false);
  };

  const save = async () => {
    if (!agentSpec) return;
    setPhase('saving');
    setSaveMessage('Creating agent...');
    const result = await saveAgent(agentSpec.name, agentSpec);
    setSaveMessage(`Saved to ${result.path}`);
    
    setTimeout(() => {
      router.push(`/agents/${agentSpec.name}`);
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
          <h1 className="text-2xl font-bold tracking-tight">Preview: {agentSpec.name}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setPhase('chat')}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Back to Chat
            </button>
            <button
              onClick={save}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Save Agent
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Configuration</h2>
            <div>
              <span className="text-sm font-medium">Type:</span> {agentSpec.type}
            </div>
            <div>
              <span className="text-sm font-medium">Corpus:</span>{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-sm">{agentSpec.corpus.path}</code>
              <span className="text-sm text-muted-foreground ml-2">({agentSpec.corpus.type})</span>
            </div>
            <div>
              <span className="text-sm font-medium">Stopping:</span> {agentSpec.stopping.condition}
              <br />
              <span className="text-sm text-muted-foreground">
                Max {agentSpec.stopping.max_iterations} iterations, {agentSpec.stopping.max_duration} total
              </span>
            </div>
            <div>
              <span className="text-sm font-medium">Allowed actions:</span>
              <ul className="text-sm mt-1 space-y-1">
                {agentSpec.actions.allowed.map((a, i) => (
                  <li key={i} className="text-green-600">✓ {a}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-sm font-medium">Quality metrics:</span>
              <ul className="text-sm mt-1 space-y-1">
                {agentSpec.quality.metrics.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-3">Agent State (raw)</h2>
            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
              {JSON.stringify(agentSpec, null, 2)}
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
          Describe what you want your autonomous agent to do. The wizard will build a complete AGENT.md for you.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {m.content}
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
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Describe your agent..."
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4"
            >
              Send
            </button>
            <button
              onClick={forge}
              disabled={messages.length <= 1 || loading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 hover:bg-green-700 text-white h-10 px-4"
            >
              Forge Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
