'use client';

import { useState } from 'react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MISSION_CANCEL_REASONS,
  MISSION_CANCEL_REASON_LABELS,
  type MissionCancelReason,
} from '@/lib/workspace/mission-status-workflow';
import type { DgMission } from '@/lib/workspace/types';

type Props = {
  mission: DgMission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onConfirm: (reason: MissionCancelReason, detail: string) => void;
};

export function MissionCancelDialog({
  mission,
  open,
  onOpenChange,
  loading = false,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState<MissionCancelReason | ''>('');
  const [detail, setDetail] = useState('');

  const canConfirm =
    reason.length > 0 && (reason !== 'OTHER' || detail.trim().length >= 3);

  return (
    <AdminConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setDetail('');
        }
        onOpenChange(next);
      }}
      title="Annuler la mission ?"
      message={
        mission ? (
          <div className="space-y-3 text-left">
            <div>
              <span className="font-medium text-foreground">{mission.subject}</span> sera annulée.
              Cette action est irréversible.
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Motif *
              </label>
              <Select value={reason || undefined} onValueChange={(v) => setReason(v as MissionCancelReason)}>
                <SelectTrigger className="admin-field w-full">
                  <SelectValue placeholder="Choisir un motif…" />
                </SelectTrigger>
                <SelectContent>
                  {MISSION_CANCEL_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {MISSION_CANCEL_REASON_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reason === 'OTHER' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Préciser *
                </label>
                <Textarea
                  className="admin-field min-h-[4rem] resize-y"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Décrivez le motif d’annulation…"
                />
              </div>
            ) : (
              <Input type="hidden" value={detail} readOnly className="hidden" />
            )}
          </div>
        ) : null
      }
      confirmLabel="Annuler la mission"
      onConfirm={() => {
        if (!canConfirm || !reason) return;
        onConfirm(reason, detail.trim());
      }}
      loading={loading}
    />
  );
}
