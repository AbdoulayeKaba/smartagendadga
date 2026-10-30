'use client';

import { useCallback } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Activity,
  Copy,
  FileEdit,
  Globe,
  Layers,
  LogIn,
  MessageSquare,
  Shield,
  Trash2,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { UserAvatar } from '@/components/admin/user-avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AuditActionCategory, AuditJournalEntry } from '@/lib/dg/audit-journal';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type Props = {
  entry: AuditJournalEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CATEGORY_META: Record<
  AuditActionCategory,
  { label: string; tone: string; icon: ComponentType<{ className?: string }> }
> = {
  LOGIN: { label: 'Connexion', tone: 'login', icon: LogIn },
  UPDATE: { label: 'Modification', tone: 'update', icon: FileEdit },
  DELETE: { label: 'Suppression', tone: 'delete', icon: Trash2 },
  EXPORT: { label: 'Export', tone: 'export', icon: Activity },
  BUSINESS: { label: 'Métier', tone: 'business', icon: Shield },
  OTHER: { label: 'Autre', tone: 'other', icon: Layers },
};

function resourceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    mission: 'Mission',
    Mission: 'Mission',
    User: 'Utilisateur',
    user: 'Utilisateur',
    Appointment: 'Rendez-vous',
    appointment: 'Rendez-vous',
    Platform: 'Plateforme',
    platform: 'Plateforme',
  };
  return map[type] ?? type;
}

function CopyableId({ value }: { value: string }) {
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Identifiant copié' });
    } catch {
      toast({ variant: 'destructive', title: 'Copie impossible' });
    }
  }, [value]);

  if (!value || value === '—') {
    return <span className="audit-event-detail-muted">—</span>;
  }

  return (
    <div className="audit-event-detail-id">
      <code className="audit-event-detail-id-code">{value}</code>
      <button
        type="button"
        className="audit-event-detail-id-copy"
        onClick={() => void copy()}
        aria-label="Copier l'identifiant"
        title="Copier"
      >
        <Copy className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}

export function AuditEventDetailDialog({ entry, open, onOpenChange }: Props) {
  if (!entry) return null;

  const category = CATEGORY_META[entry.category] ?? CATEGORY_META.OTHER;
  const CategoryIcon = category.icon;
  const when = format(new Date(entry.createdAt), 'd MMM yyyy, HH:mm:ss', { locale: fr });
  const whenFull = format(new Date(entry.createdAt), "EEEE d MMMM yyyy 'à' HH:mm:ss", {
    locale: fr,
  });
  const userComments = entry.comments;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="audit-event-detail-dialog gap-0 border-0 p-0 sm:max-w-[26rem]">
        <DialogTitle className="sr-only">Détail de l&apos;événement</DialogTitle>
        <DialogDescription className="sr-only">
          {entry.actionLabel} — {entry.user.firstName} {entry.user.lastName}
        </DialogDescription>

        <header className={cn('audit-event-detail-hero', `audit-event-detail-hero--${category.tone}`)}>
          <div className="audit-event-detail-hero-top">
            <span className="audit-event-detail-badge">
              <CategoryIcon className="h-3 w-3" aria-hidden />
              {category.label}
            </span>
            <span className="audit-event-detail-ref">#{entry.id.slice(-8).toUpperCase()}</span>
          </div>
          <div className="audit-event-detail-hero-main">
            <h2 className="audit-event-detail-title">{entry.actionLabel}</h2>
            <code className="audit-event-detail-code" title={entry.actionCode}>
              {entry.actionCode}
            </code>
          </div>
          <time className="audit-event-detail-when" dateTime={entry.createdAt} title={whenFull}>
            {when}
          </time>
        </header>

        <div className="audit-event-detail-body">
          <section className="audit-event-detail-actor">
            <UserAvatar firstName={entry.user.firstName} lastName={entry.user.lastName} size="sm" />
            <div className="audit-event-detail-actor-body">
              <p className="audit-event-detail-actor-line">
                <span className="audit-event-detail-actor-name">
                  {entry.user.firstName} {entry.user.lastName}
                </span>
                <span className="audit-event-detail-actor-sep" aria-hidden>
                  ·
                </span>
                <span className="audit-event-detail-actor-role">{entry.user.roleLabel}</span>
              </p>
              <p className="audit-event-detail-actor-email">{entry.user.email}</p>
            </div>
          </section>

          <section className="audit-event-detail-meta" aria-label="Détails de l'événement">
            <dl className="audit-event-detail-dl">
              <div className="audit-event-detail-dl-item">
                <dt>Ressource</dt>
                <dd>{resourceTypeLabel(entry.resourceType)}</dd>
              </div>
              <div className="audit-event-detail-dl-item">
                <dt>IP</dt>
                <dd className="audit-event-detail-dl-mono">
                  <Globe className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                  {entry.ip ?? '—'}
                </dd>
              </div>
              <div className="audit-event-detail-dl-item audit-event-detail-dl-item--wide">
                <dt>Cible</dt>
                <dd>
                  <CopyableId value={entry.resourceLabel} />
                </dd>
              </div>
            </dl>
          </section>

          <p className="audit-event-detail-summary">{entry.description}</p>

          {userComments.length ? (
            <section className="audit-event-detail-comments-wrap">
              <p className="audit-event-detail-block-label">
                <MessageSquare className="h-3 w-3" aria-hidden />
                Commentaires
              </p>
              <ul className="audit-event-detail-comments">
                {userComments.map((comment) => (
                  <li key={comment}>{comment}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="audit-event-detail-footer">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="audit-event-detail-close"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
