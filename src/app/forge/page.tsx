'use client';

import { useState } from 'react';
import { SkillWizardChat } from '@/components/skill-wizard-chat';
import { SkillWizardPreview } from '@/components/skill-wizard-preview';
import type { Message } from '@/components/skill-wizard-chat';

export default function ForgePage() {
  const [phase, setPhase] = useState<'chat' | 'preview'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);

  if (phase === 'preview') {
    return (
      <SkillWizardPreview
        messages={messages}
        onBack={() => setPhase('chat')}
      />
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Skill Forge Wizard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Chat with the assistant to design a new Hermes skill. It will ask a
          few clarifying questions, then generate the SKILL.md and any linked
          files.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <SkillWizardChat
          onReady={(msgs) => {
            setMessages(msgs);
            setPhase('preview');
          }}
        />
      </div>
    </div>
  );
}
