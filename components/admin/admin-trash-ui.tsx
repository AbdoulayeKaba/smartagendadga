'use client';

import type { ReactNode } from 'react';
import { LayoutList, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ScopeTab = 'active' | 'trash';

export function AdminTrashBanner({
  count,
  emptyHint = 'Aucun élément — espace prêt pour les éléments archivés',
  filledHint,
}: {
  count: number;
  emptyHint?: string;
  filledHint?: string;
}) {
  const hint =
    count > 0
      ? filledHint ??
        `${count} élément${count > 1 ? 's' : ''} — restaurables avant suppression définitive`
      : emptyHint;

  return (
    <div className="admin-trash-banner" role="status">
      <span className="admin-trash-banner-icon" aria-hidden>
        <Trash2 className="h-3.5 w-3.5" />
      </span>
      <div className="admin-trash-banner-text">
        <strong>Corbeille</strong>
        <span>{hint}</span>
      </div>
    </div>
  );
}

export function AdminTrashScopeTabs({
  value,
  onChange,
  activeLabel = 'Actifs',
  trashCount,
  activeCount,
  className,
}: {
  value: ScopeTab;
  onChange: (next: ScopeTab) => void;
  activeLabel?: string;
  trashCount?: number;
  activeCount?: number;
  className?: string;
}) {
  return (
    <div className={cn('admin-trash-scope-tabs', className)} role="tablist" aria-label="Périmètre">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'active'}
        data-active={value === 'active'}
        className="admin-trash-scope-tab"
        onClick={() => onChange('active')}
      >
        <LayoutList className="h-3 w-3" aria-hidden />
        {activeLabel}
        {typeof activeCount === 'number' ? (
          <span className="admin-trash-scope-tab-count">{activeCount}</span>
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'trash'}
        data-active={value === 'trash'}
        className="admin-trash-scope-tab admin-trash-scope-tab--trash"
        onClick={() => onChange('trash')}
      >
        <Trash2 className="h-3 w-3" aria-hidden />
        Corbeille
        {typeof trashCount === 'number' ? (
          <span className="admin-trash-scope-tab-count">{trashCount}</span>
        ) : null}
      </button>
    </div>
  );
}

export function AdminEmptyTrashButton({
  onClick,
  disabled,
  label = 'Vider la corbeille',
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn('admin-trash-empty-btn', className)}
      onClick={onClick}
      disabled={disabled}
    >
      <Trash2 className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}

export function AdminTrashEmptyState({
  title = 'Corbeille vide',
  description = 'Les éléments mis en corbeille apparaîtront ici. Vous pourrez les restaurer ou les supprimer définitivement.',
  onBackToActive,
  backLabel = 'Retour aux actifs',
  showTips = true,
  actions,
  className,
}: {
  title?: string;
  description?: string;
  onBackToActive?: () => void;
  backLabel?: string;
  showTips?: boolean;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('admin-trash-empty', className)}>
      <div className="admin-trash-empty-glow" aria-hidden />
      <div className="admin-trash-empty-icon" aria-hidden>
        <Trash2 className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="admin-trash-empty-title">{title}</p>
      <p className="admin-trash-empty-desc">{description}</p>
      {showTips ? (
        <ul className="admin-trash-empty-tips">
          <li>
            <RotateCcw className="h-3 w-3" aria-hidden />
            Restauration en un clic
          </li>
          <li>
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Suppression définitive sécurisée
          </li>
          <li>
            <Trash2 className="h-3 w-3" aria-hidden />
            Historique isolé des actifs
          </li>
        </ul>
      ) : null}
      <div className="admin-trash-empty-actions">
        {onBackToActive ? (
          <button
            type="button"
            className="admin-trash-empty-cta admin-trash-empty-cta--primary"
            onClick={onBackToActive}
          >
            <LayoutList className="h-3.5 w-3.5" aria-hidden />
            {backLabel}
          </button>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
