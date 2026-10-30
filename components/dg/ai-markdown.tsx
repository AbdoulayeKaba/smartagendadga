'use client';

import { cn } from '@/lib/utils';

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

type AiMarkdownProps = {
  text: string;
  className?: string;
};

/** Rendu markdown léger (titres, listes, gras) pour les synthèses IA. */
export function AiMarkdown({ text, className }: AiMarkdownProps) {
  const lines = text.split('\n');

  return (
    <div className={cn('dg-ai-md', className)}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="dg-ai-md-gap" />;

        if (/^#{1,3}\s/.test(trimmed)) {
          const level = trimmed.match(/^#+/)?.[0].length ?? 2;
          const content = trimmed.replace(/^#+\s*/, '');
          if (level <= 2) {
            return (
              <h4 key={i} className="dg-ai-md-h2">
                {renderInline(content)}
              </h4>
            );
          }
          return (
            <h5 key={i} className="dg-ai-md-h3">
              {renderInline(content)}
            </h5>
          );
        }

        if (/^[-•*]\s/.test(trimmed)) {
          return (
            <p key={i} className="dg-ai-md-li">
              <span className="dg-ai-md-bullet" aria-hidden>
                •
              </span>
              {renderInline(trimmed.replace(/^[-•*]\s*/, ''))}
            </p>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          const [num, ...rest] = trimmed.split(/\.\s/);
          return (
            <p key={i} className="dg-ai-md-li">
              <span className="dg-ai-md-num" aria-hidden>
                {num}.
              </span>
              {renderInline(rest.join('. '))}
            </p>
          );
        }

        return (
          <p key={i} className="dg-ai-md-p">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
