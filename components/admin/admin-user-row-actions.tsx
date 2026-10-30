'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ChevronUp, Power, PowerOff, RotateCcw, SquarePen, Trash2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type UserRowActionVariant = 'active' | 'trash';

type ActionItem = {
  key: string;
  icon: LucideIcon;
  label: string;
  tone: 'view' | 'edit' | 'activate' | 'deactivate' | 'archive' | 'restore' | 'delete';
  onClick: () => void;
};

type Props = {
  variant: UserRowActionVariant;
  /** Compte autorisé à se connecter. */
  isActive: boolean;
  /** Ligne détail ouverte sous la rangée. */
  detailExpanded?: boolean;
  permissions?: Record<string, boolean>;
  onView: () => void;
  onEdit: () => void;
  /** Bascule `active` — bloque ou autorise la connexion, sans corbeille. */
  onToggleActive: () => void;
  /** Met le compte en corbeille (`archived`). */
  onMoveToTrash: () => void;
  /** Restaure depuis la corbeille. */
  onRestore: () => void;
  onDeletePermanent: () => void;
};

function ActionButton({ item }: { item: ActionItem }) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn('admin-user-action-btn', `admin-user-action-btn--${item.tone}`)}
          aria-label={item.label}
          onClick={(e) => {
            e.stopPropagation();
            item.onClick();
          }}
        >
          <Icon className="admin-user-action-icon" strokeWidth={2} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Actions tableau utilisateurs — colonne Actions (liste vs corbeille). */
export function AdminUserRowActions({
  variant,
  isActive,
  detailExpanded = false,
  permissions = {},
  onView,
  onEdit,
  onToggleActive,
  onMoveToTrash,
  onRestore,
  onDeletePermanent,
}: Props) {
  const allowed = (id: string) => permissions[id] === true;

  const toggleAction: ActionItem = isActive
    ? {
        key: 'deactivate',
        icon: PowerOff,
        label: 'Désactiver le compte',
        tone: 'deactivate',
        onClick: onToggleActive,
      }
    : {
        key: 'activate',
        icon: Power,
        label: 'Activer le compte',
        tone: 'activate',
        onClick: onToggleActive,
      };

  const actions: ActionItem[] =
    variant === 'trash'
      ? [
          ...(allowed('action.users.view')
            ? [
                {
                  key: 'view',
                  icon: detailExpanded ? ChevronUp : ChevronDown,
                  label: detailExpanded ? 'Masquer le détail' : 'Afficher le détail',
                  tone: 'view' as const,
                  onClick: onView,
                },
              ]
            : []),
          ...(allowed('action.users.restore')
            ? [
                {
                  key: 'restore',
                  icon: RotateCcw,
                  label: 'Restaurer depuis la corbeille',
                  tone: 'restore' as const,
                  onClick: onRestore,
                },
              ]
            : []),
          ...(allowed('action.users.delete')
            ? [
                {
                  key: 'delete',
                  icon: Trash2,
                  label: 'Supprimer définitivement',
                  tone: 'delete' as const,
                  onClick: onDeletePermanent,
                },
              ]
            : []),
        ]
      : [
          ...(allowed('action.users.view')
            ? [
                {
                  key: 'view',
                  icon: detailExpanded ? ChevronUp : ChevronDown,
                  label: detailExpanded ? 'Masquer le détail' : 'Afficher le détail',
                  tone: 'view' as const,
                  onClick: onView,
                },
              ]
            : []),
          ...(allowed('action.users.edit')
            ? [
                {
                  key: 'edit',
                  icon: SquarePen,
                  label: 'Modifier',
                  tone: 'edit' as const,
                  onClick: onEdit,
                },
              ]
            : []),
          ...(allowed('action.users.toggle_active') ? [toggleAction] : []),
          ...(allowed('action.users.archive')
            ? [
                {
                  key: 'archive',
                  icon: Trash2,
                  label: 'Mettre dans la corbeille',
                  tone: 'archive' as const,
                  onClick: onMoveToTrash,
                },
              ]
            : []),
        ];

  if (actions.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="admin-user-row-actions" role="group" aria-label="Actions utilisateur">
        {actions.map((item) => (
          <ActionButton key={item.key} item={item} />
        ))}
      </div>
    </TooltipProvider>
  );
}
