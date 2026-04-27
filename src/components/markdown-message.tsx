'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownMessageProps = {
  content: string;
  role?: 'user' | 'assistant';
};

function InlineCode({ children }: { children?: React.ReactNode }) {
  return (
    <code className="bg-muted px-1.5 py-0.5 rounded text-[0.85em] font-mono">
      {children}
    </code>
  );
}

function CodeBlock({ className, children }: React.ComponentProps<'pre'>) {
  const language = className?.replace(/^language-/, '');
  const isBlock = String(children).endsWith('\n') || String(children).includes('\n');

  return (
    <div className="relative my-2">
      <div className="flex items-center justify-between bg-zinc-800 text-zinc-400 text-xs px-4 py-1.5 rounded-t-md">
        <span className="font-mono">{language || 'text'}</span>
        <button
          onClick={() => navigator.clipboard?.writeText(String(children).trimEnd())}
          className="hover:text-white transition-colors cursor-pointer"
          type="button"
        >
          Copy
        </button>
      </div>
      <pre className={`bg-zinc-900 text-zinc-100 text-sm leading-relaxed ${
        isBlock ? 'overflow-x-auto' : 'overflow-x-auto'
      } rounded-b-md ${isBlock ? 'p-4' : 'p-4 inline-block'}`}>
        <code className={`font-mono ${className || ''}`} style={styles.code}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function Heading({ level, children, ...props }: React.ComponentProps<'h1'> & { level: number }) {
  const sizes: Record<number, string> = {
    1: 'text-xl font-bold mt-4 mb-2',
    2: 'text-lg font-semibold mt-3 mb-2',
    3: 'text-base font-semibold mt-2 mb-1',
    4: 'text-sm font-semibold mt-2 mb-1',
  };
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag className={sizes[level] || sizes[4]} {...props as any}>{children}</Tag>;
}

function Link(props: React.ComponentProps<'a'>) {
  return (
    <a className="text-blue-400 hover:underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props}>
      {props.children}
    </a>
  );
}

function Blockquote(props: React.ComponentProps<'blockquote'>) {
  return <blockquote className="border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground italic my-2" {...props} />;
}

function Table(props: React.ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse text-sm" {...props} />
    </div>
  );
}

const components = {
  code: (props: any) => {
    const { className, children } = props;
    const isBlock = String(children).includes('\n') || String(children).endsWith('\n');
    return isBlock ? (
      <pre className={props.className}>
        <CodeBlock className={className}>{children}</CodeBlock>
      </pre>
    ) : (
      <InlineCode>{children}</InlineCode>
    );
  },
  pre: CodeBlock as any,
  a: Link,
  blockquote: Blockquote,
  h1: (props: any) => <Heading level={1} {...props} />,
  h2: (props: any) => <Heading level={2} {...props} />,
  h3: (props: any) => <Heading level={3} {...props} />,
  h4: (props: any) => <Heading level={4} {...props} />,
  table: Table,
};

export default function MarkdownMessage({ content, role }: MarkdownMessageProps) {
  return (
    <div className={role === 'user' ? '' : 'prose-sm'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

const styles = {
  code: {
    tabSize: 2,
  },
};
