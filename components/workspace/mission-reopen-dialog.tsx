'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
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
import { MISSION_STATUS_LABELS } from '@/lib/workspace/labels';
import {
  MISSION_REOPEN_REASONS,
  MISSION_REOPEN_REASON_LABELS,
  resolveMissionReopenReasonLabel,
} from '@/lib/workspace/mission-operational-state';
import { resolveReopenTargetStatus, startOfDay } from '@/lib/workspace/mission-status-workflow';
import type { DgMission } from '@/lib/workspace/types';

type Props = {
  mission: DgMission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onConfirm: (payload: { returnAt?: string; reopenReason: string }) => void;
};

export function MissionReopenDialog({
  mission,
  open,
  onOpenChange,
  loading = false,
  onConfirm,
}: Props) {
  const [returnDate, setReturnDate] = useState('');
  const [reasonId, setReasonId] = useState('');
  const [comment, setComment] = useState('');

  const returnPassed = useMemo(() => {
    if (!mission) return false;
    return startOfDay(new Date()).getTime() >= startOfDay(mission.returnAt).getTime();
  }, [mission]);

  const needsDetail = reasonId === 'OTHER';
  const canConfirm =
    reasonId.length > 0 &&
    (!needsDetail || comment.trim().length >= 3) &&
    (!returnPassed || returnDate.length > 0);

  const currentReturnLabel = useMemo(() => {
    if (!mission) return '';
    return format(new Date(mission.returnAt), 'd MMM yyyy', { locale: fr });
  }, [mission]);

  const targetStatusLabel = useMemo(() => {
    if (!mission) return 'En cours';
    const newReturn =
      returnPassed && returnDate
        ? new Date(`${returnDate}T12:00:00`).toISOString()
        : undefined;
    const target = resolveReopenTargetStatus(mission, new Date(), newReturn);
    return MISSION_STATUS_LABELS[target];
  }, [mission, returnPassed, returnDate]);

  const subtitle = `La mission repassera en « ${targetStatusLabel} » pour permettre des modifications.`;

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
      className="workspace-crud-dialog--mission-adjust workspace-crud-dialog--mission-reopen"
      title="Rouvrir la mission"
      description={subtitle}
      onSubmit={() => {
        if (!mission || !canConfirm || loading) return;
        onConfirm({
          reopenReason: resolveMissionReopenReasonLabel(reasonId, comment),
          ...(returnPassed && returnDate
            ? { returnAt: new Date(`${returnDate}T12:00:00`).toISOString() }
            : {}),
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
            className="admin-btn-create admin-btn-create--shorten"
            disabled={!canConfirm || loading}
          >
            {loading ? 'Réouverture…' : 'Rouvrir'}
          </button>
        </>
      }
    >
      {mission ? (
        <>
          <p className="mission-adjust-lead">{subtitle}</p>
          <MissionAdjustContextCard
            subject={mission.subject}
            destination={mission.destination}
            returnLabel={currentReturnLabel}
          />
          <div className="workspace-crud-form-grid workspace-crud-form-compact">
            {returnPassed ? (
              <WorkspaceCrudField
                id="mission-reopen-return"
                label="Nouvelle date de retour *"
                className="workspace-crud-span-2"
              >
                <FrenchDateField
                  id="mission-reopen-return"
                  variant="compact"
                  className="admin-field workspace-crud-compact-date-trigger"
                  popoverClassName="workspace-crud-compact-date-popover workspace-crud-compact-calendar mission-adjust-date-popover--reopen"
                  value={returnDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={setReturnDate}
                  placeholder="Choisir une date…"
                />
              </WorkspaceCrudField>
            ) : null}

            <WorkspaceCrudField
              id="mission-reopen-reason"
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
                  id="mission-reopen-reason"
                  className="admin-field workspace-crud-compact-select-trigger"
                >
                  <SelectValue placeholder="Choisir un motif…" />
                </SelectTrigger>
                <SelectContent className="workspace-crud-compact-select-content">
                  {MISSION_REOPEN_REASONS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {MISSION_REOPEN_REASON_LABELS[id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WorkspaceCrudField>

            <WorkspaceCrudField
              id="mission-reopen-comment"
              label={needsDetail ? 'Préciser *' : 'Commentaire (optionnel)'}
              className="workspace-crud-span-2"
            >
              <Input
                id="mission-reopen-comment"
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
