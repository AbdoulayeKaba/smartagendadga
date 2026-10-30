'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Canaux de rafraîchissement temps réel.
 * Permet aux vues (cockpit, listes…) de se mettre à jour instantanément
 * après une mutation, sans rechargement manuel de la page.
 */
export const LIVE_TOPICS = {
  appointments: 'appointments',
  rooms: 'rooms',
  all: 'all',
} as const;

export type LiveTopic = (typeof LIVE_TOPICS)[keyof typeof LIVE_TOPICS];

const EVENT_NAME = 'dg:live-refresh';
const CHANNEL_NAME = 'dg-live-refresh';

/** Émet un signal de rafraîchissement (même onglet + autres onglets). */
export function emitLiveRefresh(topic: LiveTopic = LIVE_TOPICS.all): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { topic } }));
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage({ topic });
      bc.close();
    }
  } catch {
    /* no-op : environnement sans window/BroadcastChannel */
  }
}

type UseLiveRefreshOptions = {
  /** Sujets écoutés. `all` capte tous les signaux. */
  topics?: LiveTopic[];
  /** Intervalle de polling en ms (0 pour désactiver). */
  intervalMs?: number;
  /** Rafraîchir au retour de focus / visibilité de l'onglet. */
  refreshOnFocus?: boolean;
  /** Actif ou non (ex. suspendre pendant un chargement). */
  enabled?: boolean;
};

/**
 * Déclenche `callback` lorsqu'un signal pertinent est reçu :
 * - évènement applicatif (même onglet),
 * - message BroadcastChannel (autres onglets),
 * - retour de focus / visibilité,
 * - polling périodique (uniquement onglet visible).
 */
export function useLiveRefresh(
  callback: () => void,
  {
    topics = [LIVE_TOPICS.all],
    intervalMs = 20000,
    refreshOnFocus = true,
    enabled = true,
  }: UseLiveRefreshOptions = {},
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const topicsKey = topics.join(',');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const listened = new Set(topicsKey.split(','));
    const matches = (topic?: string) =>
      listened.has(LIVE_TOPICS.all) || (topic ? listened.has(topic) : true);

    const run = () => callbackRef.current();

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<{ topic?: string }>).detail;
      if (matches(detail?.topic)) run();
    };
    window.addEventListener(EVENT_NAME, onCustom as EventListener);

    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<{ topic?: string }>) => {
        if (matches(event.data?.topic)) run();
      };
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    if (refreshOnFocus) {
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', run);
    }

    const intervalId =
      intervalMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState === 'visible') run();
          }, intervalMs)
        : undefined;

    return () => {
      window.removeEventListener(EVENT_NAME, onCustom as EventListener);
      channel?.close();
      if (refreshOnFocus) {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', run);
      }
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, refreshOnFocus, topicsKey]);
}

/** Horloge client pour mettre à jour statuts / phases sans recharger la page. */
export function useLiveClock(options?: { intervalMs?: number; enabled?: boolean }): Date {
  const intervalMs = options?.intervalMs ?? 1000;
  const enabled = options?.enabled !== false;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  return now;
}

/** Retourne une fonction debouncée stable pour éviter les rafales de fetch. */
export function useDebouncedCallback(callback: () => void, waitMs = 600): () => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<number | undefined>(undefined);

  const debouncedRef = useRef<(() => void) | null>(null);
  if (!debouncedRef.current) {
    debouncedRef.current = () => {
      if (typeof window === 'undefined') return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => callbackRef.current(), waitMs);
    };
  }

  return debouncedRef.current;
}

/** Déclenche un callback aux timestamps futurs (ex. début/fin de créneau). */
export function useScheduledRefresh(
  callback: () => void,
  timestamps: number[],
  {
    enabled = true,
    graceMs = 200,
  }: {
    enabled?: boolean;
    graceMs?: number;
  } = {}
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const scheduleKey = timestamps.join('|');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || timestamps.length === 0) return;

    const nowMs = Date.now();
    const timerIds = timestamps
      .filter((timestamp) => timestamp > nowMs - graceMs)
      .map((timestamp) =>
        window.setTimeout(
          () => {
            if (document.visibilityState === 'visible') callbackRef.current();
          },
          Math.max(0, timestamp - nowMs + graceMs)
        )
      );

    return () => {
      for (const id of timerIds) window.clearTimeout(id);
    };
  }, [enabled, graceMs, scheduleKey, timestamps]);
}
