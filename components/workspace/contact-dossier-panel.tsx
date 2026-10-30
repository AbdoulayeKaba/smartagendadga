'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { formatDate, formatTime } from '@/lib/datetime';
import { CONTACT_CATEGORY_LABELS } from '@/lib/workspace/labels';
import type { ContactAppointmentStats, StrategicContact } from '@/lib/workspace/types';

type DossierTab = 'overview' | 'upcoming' | 'history' | 'documents' | 'notes';
type ListFocus = 'upcoming' | 'pending' | 'done' | 'rejected' | 'all';

const TABS: { id: DossierTab; label: string }[] = [
  { id: 'overview', label: 'Aperçu' },
  { id: 'upcoming', label: 'Prochains rendez-vous' },
  { id: 'history', label: 'Historique' },
  { id: 'documents', label: 'Documents' },
  { id: 'notes', label: 'Notes' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function whenLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: '—', time: '' };
  return {
    day: formatDate(date, 'd MMM yyyy'),
    time: formatTime(date),
  };
}

export function ContactDossierPanel({
  contact,
  stats,
  loading,
  dossier,
  listTitle,
  upcomingCount,
  activities,
  upcomingList,
  list,
  canPlan,
  canEdit,
  canDelete,
  noteDraft,
  noteSaving,
  onDossier,
  onOpenList,
  onPlan,
  onEdit,
  onDelete,
  onNoteChange,
  onSaveNote,
}: {
  contact: StrategicContact;
  stats: ContactAppointmentStats | null;
  loading: boolean;
  dossier: DossierTab;
  listTitle: string;
  upcomingCount: number;
  activities: { id: string; title: string; detail: string; at: string }[];
  upcomingList: ReactNode;
  list: ReactNode;
  canPlan: boolean;
  canEdit: boolean;
  canDelete: boolean;
  noteDraft: string;
  noteSaving: boolean;
  onDossier: (tab: DossierTab) => void;
  onOpenList: (tab: DossierTab, focus: ListFocus) => void;
  onPlan?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onNoteChange: (value: string) => void;
  onSaveNote: () => void;
}) {
  const phone = contact.phone?.trim() || null;
  const email = contact.email?.trim() || null;
  const category = CONTACT_CATEGORY_LABELS[contact.category];

  return (
    <div className="contact-dossier">
      <header className="contact-dossier-bar">
        <h2>
          <Calendar aria-hidden /> Suivi des rendez-vous
        </h2>
      </header>

      <section className="contact-dossier-identity">
        <span className="contact-dossier-avatar" aria-hidden>
          {initials(contact.fullName)}
        </span>
        <div className="contact-dossier-identity-copy">
          <strong>{contact.fullName}</strong>
          <span>
            <Building2 aria-hidden /> {contact.organization}
          </span>
          {contact.jobTitle ? (
            <span>
              <Briefcase aria-hidden /> {contact.jobTitle}
            </span>
          ) : null}
          <em>{category}</em>
        </div>
        <ul className="contact-dossier-identity-meta">
          <li>
            <Phone aria-hidden /> {phone ?? '—'}
          </li>
          <li>
            <Mail aria-hidden /> {email ?? '—'}
          </li>
        </ul>
      </section>

      <section className="contact-dossier-kpis" aria-label="Synthèse des rendez-vous">
        <button type="button" data-tone="blue" onClick={() => onOpenList('upcoming', 'upcoming')}>
          <Calendar aria-hidden />
          <strong>{stats?.upcoming ?? 0}</strong>
          <span>À venir</span>
        </button>
        <button type="button" data-tone="amber" onClick={() => onOpenList('upcoming', 'pending')}>
          <Clock aria-hidden />
          <strong>{stats?.pending ?? 0}</strong>
          <span>En attente</span>
        </button>
        <button type="button" data-tone="green" onClick={() => onOpenList('history', 'done')}>
          <CalendarCheck aria-hidden />
          <strong>{stats?.visits ?? 0}</strong>
          <span>Réalisés</span>
        </button>
        <button type="button" data-tone="red" onClick={() => onOpenList('history', 'rejected')}>
          <CalendarX aria-hidden />
          <strong>{stats?.rejected ?? 0}</strong>
          <span>Annulés</span>
        </button>
      </section>

      <div className="contact-dossier-actions">
        {canPlan && onPlan ? (
          <button type="button" className="is-primary" onClick={onPlan}>
            <CalendarPlus aria-hidden /> Planifier un rendez-vous
          </button>
        ) : null}
        <Link href="/dg/availability">Voir l&apos;agenda complet</Link>
        {email ? (
          <a href={`mailto:${email}`}>
            <MessageSquare aria-hidden /> Envoyer un message
          </a>
        ) : (
          <button type="button" disabled title="Aucune adresse e-mail">
            <MessageSquare aria-hidden /> Envoyer un message
          </button>
        )}
      </div>

      <div className="contact-dossier-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={dossier === tab.id}
            className={dossier === tab.id ? 'is-active' : undefined}
            onClick={() => onDossier(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="contact-dossier-body" role="tabpanel">
        {dossier === 'overview' ? (
          <div className="contact-dossier-grid">
            <div className="contact-dossier-col">
              <article className="contact-dossier-card">
                <header>
                  <h3>Prochains rendez-vous</h3>
                  <button type="button" onClick={() => onOpenList('upcoming', 'upcoming')}>
                    Voir tous
                  </button>
                </header>
                {loading ? (
                  <p className="contact-dossier-muted">Chargement…</p>
                ) : upcomingCount === 0 ? (
                  <div className="contact-dossier-empty">
                    <span aria-hidden>
                      <Calendar />
                    </span>
                    <strong>Aucun rendez-vous à venir</strong>
                    <p>Planifiez un rendez-vous avec ce contact pour le retrouver ici et suivre son évolution.</p>
                    {canPlan && onPlan ? (
                      <button type="button" onClick={onPlan}>
                        Planifier un rendez-vous
                      </button>
                    ) : null}
                  </div>
                ) : (
                  upcomingList
                )}
              </article>

              <article className="contact-dossier-card">
                <header>
                  <h3>Dernières activités</h3>
                  <button type="button" onClick={() => onOpenList('history', 'all')}>
                    Voir tout
                  </button>
                </header>
                <ul className="contact-dossier-activity">
                  {activities.map((row) => {
                    const when = whenLabel(row.at);
                    return (
                      <li key={row.id}>
                        <span aria-hidden />
                        <div>
                          <strong>{row.title}</strong>
                          <p>{row.detail}</p>
                        </div>
                        <time dateTime={row.at}>
                          {when.day}
                          <small>{when.time}</small>
                        </time>
                      </li>
                    );
                  })}
                </ul>
              </article>
            </div>

            <div className="contact-dossier-col">
              <article className="contact-dossier-card">
                <header>
                  <h3>Actions rapides</h3>
                </header>
                <div className="contact-dossier-quick">
                  {canPlan && onPlan ? (
                    <button type="button" onClick={onPlan}>
                      <CalendarPlus aria-hidden /> Planifier un rendez-vous
                    </button>
                  ) : null}
                  <button type="button" onClick={() => onDossier('notes')}>
                    <StickyNote aria-hidden /> Ajouter une note
                  </button>
                  <button type="button" onClick={() => onDossier('documents')}>
                    <FileText aria-hidden /> Associer un document
                  </button>
                  {canEdit && onEdit ? (
                    <button type="button" onClick={onEdit}>
                      <Pencil aria-hidden /> Modifier le contact
                    </button>
                  ) : null}
                  {canDelete && onDelete ? (
                    <button type="button" className="is-danger" onClick={onDelete}>
                      <Trash2 aria-hidden /> Supprimer le contact
                    </button>
                  ) : null}
                </div>
              </article>
            </div>
          </div>
        ) : null}

        {dossier === 'upcoming' || dossier === 'history' ? (
          <article className="contact-dossier-card contact-dossier-card--list">
            <header>
              <h3>{listTitle}</h3>
            </header>
            {loading ? <p className="contact-dossier-muted">Chargement…</p> : list}
          </article>
        ) : null}

        {dossier === 'documents' ? (
          <article className="contact-dossier-card">
            <header>
              <h3>Documents</h3>
            </header>
            <div className="contact-dossier-empty">
              <span aria-hidden>
                <FileText />
              </span>
              <strong>Aucun document associé</strong>
              <p>Ce contact n&apos;a pas encore de pièce jointe dans l&apos;annuaire.</p>
            </div>
          </article>
        ) : null}

        {dossier === 'notes' ? (
          <article className="contact-dossier-card">
            <header>
              <h3>Notes</h3>
            </header>
            {canEdit ? (
              <form
                className="contact-dossier-note"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSaveNote();
                }}
              >
                <textarea
                  value={noteDraft}
                  onChange={(event) => onNoteChange(event.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder="Ajouter une note sur ce contact…"
                />
                <button type="submit" disabled={noteSaving}>
                  {noteSaving ? 'Enregistrement…' : 'Enregistrer la note'}
                </button>
              </form>
            ) : (
              <p className="contact-dossier-muted">{contact.notes?.trim() || 'Aucune note.'}</p>
            )}
          </article>
        ) : null}
      </div>
    </div>
  );
}
