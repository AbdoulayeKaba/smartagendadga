'use client';

import { useMemo, useState } from 'react';
import { ChevronsUpDown, Mail, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import type { AppointmentParticipantUser } from '@/lib/services/appointment-participant-users';

export type ParticipantDirectoryUser = AppointmentParticipantUser;

type Props = {
  id?: string;
  users: ParticipantDirectoryUser[];
  value: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  variant?: 'default' | 'compact';
  className?: string;
};

function userDisplayName(user: ParticipantDirectoryUser): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function matchesUserSearch(user: ParticipantDirectoryUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    userDisplayName(user).toLowerCase().includes(q) ||
    user.email.toLowerCase().includes(q) ||
    user.department.toLowerCase().includes(q)
  );
}

export function ParticipantUsersMultiSelect({
  id,
  users,
  value,
  onChange,
  disabled,
  placeholder = 'Sélectionner un ou plusieurs participants…',
  variant = 'default',
  className,
}: Props) {
  const selectedIds = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filtered = useMemo(
    () => users.filter((u) => matchesUserSearch(u, query)),
    [query, users]
  );

  const selectedUsers = useMemo(
    () =>
      selectedIds
        .map((userId) => userMap.get(userId))
        .filter((u): u is ParticipantDirectoryUser => Boolean(u)),
    [selectedIds, userMap]
  );

  const toggle = (userId: string) => {
    onChange(
      selectedIds.includes(userId)
        ? selectedIds.filter((id) => id !== userId)
        : [...selectedIds, userId]
    );
  };

  const remove = (userId: string) => {
    onChange(selectedIds.filter((id) => id !== userId));
  };

  const triggerSummary =
    selectedUsers.length === 0
      ? placeholder
      : selectedUsers.length === 1
        ? `${userDisplayName(selectedUsers[0]!)} — ${selectedUsers[0]!.email}`
        : `${selectedUsers.length} participants sélectionnés`;

  const triggerClass =
    variant === 'compact'
      ? 'dg-plan-input dg-plan-picker-trigger participant-users-multi-select-trigger'
      : 'participant-users-multi-select-trigger admin-field h-10 w-full min-w-0 justify-between gap-2 px-3 py-2 font-normal shadow-none';

  const popoverClass =
    variant === 'compact'
      ? 'participant-users-multi-select-popover dg-plan-select-popover p-0'
      : 'participant-users-multi-select-popover admin-theme p-0';

  return (
    <div className={cn('participant-users-multi-select min-w-0', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              triggerClass,
              selectedUsers.length === 0 && 'text-muted-foreground'
            )}
            title={
              selectedUsers.length > 1
                ? selectedUsers.map((u) => `${userDisplayName(u)} <${u.email}>`).join('\n')
                : undefined
            }
          >
            <span className="participant-users-multi-select-trigger-text min-w-0 flex-1 text-left">
              {triggerSummary}
            </span>
            <ChevronsUpDown className="participant-users-multi-select-chevron h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(popoverClass, 'w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,22rem)]')}
          align="start"
          sideOffset={variant === 'compact' ? 2 : 4}
        >
          <div className="participant-users-multi-select-search-bar border-b border-border/80">
            <Input
              placeholder="Rechercher par nom, e-mail ou service…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="participant-users-multi-select-search"
            />
          </div>
          <ul className="participant-users-multi-select-list" role="listbox" aria-multiselectable>
            {filtered.length === 0 ? (
              <li className="participant-users-multi-select-empty">Aucun utilisateur trouvé.</li>
            ) : (
              filtered.map((user) => {
                const checked = selectedIds.includes(user.id);
                const name = userDisplayName(user);
                return (
                  <li key={user.id} role="presentation">
                    <div
                      role="option"
                      aria-selected={checked}
                      tabIndex={0}
                      className={cn(
                        'participant-users-multi-select-option',
                        checked && 'participant-users-multi-select-option--selected'
                      )}
                      onClick={() => toggle(user.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggle(user.id);
                        }
                      }}
                    >
                      <span
                        className="participant-users-multi-select-check-wrap"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          className="participant-users-multi-select-checkbox"
                          checked={checked}
                          tabIndex={-1}
                          aria-label={`Sélectionner ${name}`}
                          onCheckedChange={() => toggle(user.id)}
                        />
                      </span>
                      <span className="participant-users-multi-select-avatar" aria-hidden>
                        <UserRound className="h-3 w-3" />
                      </span>
                      <span className="participant-users-multi-select-body">
                        <span className="participant-users-multi-select-name-row">
                          <span className="participant-users-multi-select-name">{name}</span>
                          {user.department ? (
                            <span className="participant-users-multi-select-dept-tag">{user.department}</span>
                          ) : null}
                        </span>
                        <span className="participant-users-multi-select-email">
                          <Mail className="participant-users-multi-select-email-icon" aria-hidden />
                          {user.email}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {selectedUsers.length > 0 ? (
        <div className="participant-users-multi-select-chips" role="list" aria-label="Participants sélectionnés">
          {selectedUsers.map((user) => {
            const name = userDisplayName(user);
            const detail = [user.email, user.department].filter(Boolean).join(' · ');
            return (
              <span
                key={user.id}
                role="listitem"
                className="participant-users-multi-select-chip"
                title={detail ? `${name} — ${detail}` : name}
              >
                <span className="participant-users-multi-select-chip-label">
                  <span className="participant-users-multi-select-chip-name">{name}</span>
                  <span className="participant-users-multi-select-chip-meta" aria-hidden>
                    {user.email}
                  </span>
                </span>
                <button
                  type="button"
                  className="participant-users-multi-select-chip-remove"
                  aria-label={`Retirer ${name}`}
                  onClick={() => remove(user.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
