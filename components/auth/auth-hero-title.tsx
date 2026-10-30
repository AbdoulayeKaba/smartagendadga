'use client';

import { useEffect, useState } from 'react';

const PREFIX = 'Pilotage intelligent de l’activité,';
const WORDS = ['performant.', 'traçable.', 'maîtrisé.', 'accéléré.', 'ordonné.'] as const;
const INTERVAL_MS = 2600;

type Props = {
  prefix?: string;
  words?: readonly string[];
};

export function AuthHeroTitle({ prefix = PREFIX, words = WORDS }: Props) {
  const [index, setIndex] = useState(0);
  const [enter, setEnter] = useState(true);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || words.length <= 1) return;

    const tick = window.setInterval(() => {
      setEnter(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        // prochain frame : déclenche l’entrée
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setEnter(true));
        });
      }, 260);
    }, INTERVAL_MS);

    return () => window.clearInterval(tick);
  }, [words.length]);

  return (
    <h1 className="auth-login-hero-title" aria-label={`${prefix} ${words.join(' ')}`}>
      <span className="auth-login-hero-title-prefix">{prefix}</span>
      <span className="auth-login-hero-title-rotator" aria-hidden="true">
        <span
          className="auth-login-hero-title-word"
          data-enter={enter ? 'true' : 'false'}
        >
          {words[index]}
        </span>
      </span>
    </h1>
  );
}
