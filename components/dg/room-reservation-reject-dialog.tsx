'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RoomReservationReviewItem } from '@/lib/dg/room-reservation-review';

type Props = {
  item: RoomReservationReviewItem | null;
  open: boolean;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
};

export function RoomReservationRejectDialog({
  item,
  open,
  loading = false,
  onOpenChange,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const valid = trimmed.length >= 3;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
    >
      <DialogContent className="admin-theme dg-room-res-reject-dialog gap-0 border-[var(--admin-border)] p-0 sm:max-w-[22rem]">
        <header className="dg-room-res-reject-head">
          <div className="dg-room-res-reject-icon" aria-hidden>
            <X className="h-4 w-4" />
          </div>
          <div>
            <DialogTitle className="dg-room-res-reject-title">Refuser la demande</DialogTitle>
            <DialogDescription className="dg-room-res-reject-sub">
              {item ? `« ${item.title} » · ${item.roomName}` : null}
            </DialogDescription>
          </div>
        </header>
        <div className="dg-room-res-reject-body">
          <label htmlFor="room-res-reject-reason" className="dg-room-res-reject-label">
            Motif du refus <span className="dg-room-res-required">*</span>
          </label>
          <Textarea
            id="room-res-reject-reason"
            className="dg-room-res-reject-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. créneau réservé au DGA, salle en maintenance…"
            rows={3}
          />
          {trimmed.length > 0 && !valid ? (
            <p className="dg-room-res-reject-hint">Minimum 3 caractères.</p>
          ) : null}
        </div>
        <footer className="dg-room-res-reject-footer">
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={loading || !valid}
            onClick={() => onConfirm(trimmed)}
          >
            Refuser
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
