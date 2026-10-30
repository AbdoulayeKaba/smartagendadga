'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

type Props = {
  id?: string;
  value: string[];
  onChange: (emails: string[]) => void;
  className?: string;
};

export function CopyEmailsField({ id, value, onChange, className }: Props) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commit = (raw: string) => {
    const parts = splitEmails(raw);
    if (parts.length === 0) {
      setDraft('');
      setError(null);
      return;
    }
    const invalid = parts.filter((part) => !EMAIL.test(part));
    if (invalid.length > 0) {
      setError('Saisissez une adresse e-mail valide.');
      setDraft(invalid.join(', '));
    } else {
      setDraft('');
      setError(null);
    }
    const next = [...value];
    const seen = new Set(next.map((email) => email.toLowerCase()));
    for (const part of parts) {
      if (!EMAIL.test(part)) continue;
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(part);
    }
    if (next.length !== value.length) onChange(next);
  };

  return (
    <div className={className}>
      <div className="dg-plan-copy-emails">
        {value.map((email) => (
          <span key={email.toLowerCase()} className="dg-plan-copy-email">
            <span className="min-w-0 truncate">{email}</span>
            <button
              type="button"
              className="dg-plan-copy-email-remove"
              aria-label={`Retirer ${email}`}
              onClick={() => onChange(value.filter((item) => item.toLowerCase() !== email.toLowerCase()))}
            >
              <X aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          inputMode="email"
          autoComplete="off"
          className="dg-plan-copy-emails-input"
          value={draft}
          placeholder={value.length === 0 ? 'nom@arpt.gov.gn , autre@arpt.gov.gn' : 'Ajouter une adresse…'}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const next = e.target.value;
            if (/[,;]/.test(next) || /\s$/.test(next)) {
              commit(next);
              return;
            }
            setDraft(next);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
              e.preventDefault();
              commit(draft);
            } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (!/[,;\s]/.test(text)) return;
            e.preventDefault();
            commit(text);
          }}
        />
      </div>
      {error ? <p className="dg-plan-copy-emails-error">{error}</p> : null}
    </div>
  );
}
