'use client';

import { useMemo, useState } from 'react';
import { addDays, format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MissionAdjustContextCard } from '@/components/workspace/mission-adjust-context-card';
import {
  WorkspaceCrudDialog,
  WorkspaceCrudField,
} from '@/components/workspace/workspace-crud-dialog';
import {
  missionAdjustReasons,
  resolveMissionAdjustReasonLabel,
  type MissionAdjustReturnMode,
} from '@/lib/workspace/mission-operational-state';
import type { DgMission } from '@/lib/workspace/types';
import { cn } from '@/lib/utils';

export type { MissionAdjustReturnMode };

type Props = {
  mission: DgMission | null;
  mode?: MissionAdjustReturnMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onConfirm: (payload: { returnAt: string; reason: string; comment: string }) => void;
};

function toDateInput(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
}

const COPY: Record<
  MissionAdjustReturnMode,
  {
    title: string;
    subtitle: string;
    confirmLabel: string;
    dateLabel: string;
  }
> = {
  extend: {
    title: 'Prolonger la mission',
    subtitle: 'Indiquez une nouvelle date de retour et le motif de la prolongation.',
    confirmLabel: 'Enregistrer',
    dateLabel: 'Nouvelle date de retour *',
  },
  shorten: {
    title: 'Écourter la mission',
    subtitle: 'Indiquez une date de retour antérieure et le motif de l’ajustement.',
    confirmLabel: 'Enregistrer',
    dateLabel: 'Nouvelle date de retour *',
  },
};

export function MissionExtendDialog({
  mission,
  mode = 'extend',
  open,
  onOpenChange,
  loading = false,
  onConfirm,
}: Props) {
  const [returnDate, setReturnDate] = useState('');
  const [reasonId, setReasonId] = useState('');
  const [comment, setComment] = useState('');

  const copy = COPY[mode];
  const isShorten = mode === 'shorten';
  const reasons = useMemo(() => missionAdjustReasons(mode), [mode]);

  const currentReturnLabel = useMemo(() => {
    if (!mission) return '';
    return format(new Date(mission.returnAt), 'd MMM yyyy', { locale: fr });
  }, [mission]);

  const dateBounds = useMemo(() => {
    if (!mission) return { min: '', max: '' };
    const depart = toDateInput(mission.departAt);
    const currentReturn = new Date(mission.returnAt);
    if (mode === 'extend') {
      return { min: toDateInput(addDays(currentReturn, 1)), max: '' };
    }
    return { min: depart, max: toDateInput(subDays(currentReturn, 1)) };
  }, [mission, mode]);

  const needsDetail = reasonId === 'OTHER';
  const canConfirm =
    returnDate.length > 0 &&
    reasonId.length > 0 &&
    (!needsDetail || comment.trim().length >= 3);

  const reset = () => {
    setReturnDate('');
    setReasonId('');
    setComment('');
  };

  return (
    <WorkspaceCrudDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      className={cn(
        'workspace-crud-dialog--mission-adjust',
        isShorten ? 'workspace-crud-dialog--mission-shorten' : 'workspace-crud-dialog--mission-extend'
      )}
      title={copy.title}
      description={copy.subtitle}
      onSubmit={() => {
        if (!mission || !canConfirm || loading) return;
        onConfirm({
          returnAt: new Date(`${returnDate}T12:00:00`).toISOString(),
          reason: resolveMissionAdjustReasonLabel(mode, reasonId, comment),
          comment: comment.trim(),
        });
      }}
      footer={
        <>
          <button
            type="button"
            className="admin-btn-cancel"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </button>
          <button
            type="submit"
            className={cn('admin-btn-create', isShorten && 'admin-btn-create--shorten')}
            disabled={!canConfirm || loading}
          >
            {loading ? 'Enregistrement…' : copy.confirmLabel}
          </button>
        </>
      }
    >
      {mission ? (
        <>
          <p className="mission-adjust-lead">{copy.subtitle}</p>
          <MissionAdjustContextCard
            subject={mission.subject}
            destination={mission.destination}
            returnLabel={currentReturnLabel}
          />
          <div className="workspace-crud-form-grid workspace-crud-form-compact">
            <WorkspaceCrudField
              id="mission-adjust-return"
              label={copy.dateLabel}
              className="workspace-crud-span-2"
            >
              <FrenchDateField
                id="mission-adjust-return"
                variant="compact"
                className="admin-field workspace-crud-compact-date-trigger"
                popoverClassName={cn(
                  'workspace-crud-compact-date-popover workspace-crud-compact-calendar',
                  isShorten
                    ? 'mission-adjust-date-popover--shorten'
                    : 'mission-adjust-date-popover--extend'
                )}
                value={returnDate}
                min={dateBounds.min}
                max={dateBounds.max || undefined}
                onChange={setReturnDate}
                placeholder="Choisir une date…"
              />
            </WorkspaceCrudField>

            <WorkspaceCrudField
              id="mission-adjust-reason"
              label="Motif *"
              className="workspace-crud-span-2"
            >
              <Select
                value={reasonId || undefined}
                onValueChange={(v) => {
                  setReasonId(v);
                  if (v !== 'OTHER') setComment('');
                }}
              >
                <SelectTrigger
                  id="mission-adjust-reason"
                  className="admin-field workspace-crud-compact-select-trigger"
                >
                  <SelectValue placeholder="Choisir un motif…" />
                </SelectTrigger>
                <SelectContent className="workspace-crud-compact-select-content">
                  {reasons.ids.map((id) => (
                    <SelectItem key={id} value={id}>
                      {reasons.labels[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WorkspaceCrudField>

            <WorkspaceCrudField
              id="mission-adjust-comment"
              label={
                needsDetail ? 'Préciser *' : 'Commentaire (optionnel)'
              }
              className="workspace-crud-span-2"
            >
              <Input
                id="mission-adjust-comment"
                className="admin-field"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  needsDetail
                    ? 'Décrivez le motif…'
                    : 'Informations complémentaires'
                }
              />
            </WorkspaceCrudField>
          </div>
        </>
      ) : null}
    </WorkspaceCrudDialog>
  );
}
