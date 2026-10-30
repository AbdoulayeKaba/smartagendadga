'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminDialogToggle } from '@/components/admin/admin-dialog-toggle';
import '@/components/admin/admin-edit-dialog.css';
import '@/components/workspace/mail-enregistrement.css';
import { FrenchDateField, FrenchTimeField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import {
  CONFIDENTIALITY_OPTIONS,
  HOLIDAY_TYPE_OPTIONS,
  type HolidayMeta,
  type HolidayType,
  type ConfidentialityLevel,
  type UnavailabilityMeta,
  type UnavailabilityType,
  UNAVAILABILITY_TYPE_OPTIONS,
  normalizeUnavailabilityFormType,
} from '@/lib/dg/referential-types';
import { cn } from '@/lib/utils';

function RefDialogField({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ?? 'admin-create-user-field'}>
      <label htmlFor={id} className="admin-create-user-label">
        {label}
      </label>
      {children}
    </div>
  );
}

export function HolidayReferentialDialog({
  open,
  onOpenChange,
  saving,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saving: boolean;
  initial: { name: string; meta: HolidayMeta } | null;
  onSave: (payload: { name: string; meta: HolidayMeta }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.meta.date ?? '');
  const [type, setType] = useState<HolidayType>(initial?.meta.type ?? 'national');
  const [active, setActive] = useState(initial?.meta.active ?? true);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDate(initial?.meta.date ?? '');
    setType(initial?.meta.type ?? 'national');
    setActive(initial?.meta.active ?? true);
  }, [open, initial]);

  const submit = () => {
    if (saving || !name.trim() || !date) return;
    onSave({
      name: name.trim(),
      meta: {
        kind: 'holiday',
        date,
        type,
        annualRepeat: initial?.meta.annualRepeat ?? true,
        active,
      },
    });
  };

  const isEdit = Boolean(initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'admin-dialog admin-dialog-user-form admin-dialog-ref-holiday gap-0 border-[var(--admin-border)] p-0 shadow-[0_24px_60px_-20px_rgba(15,60,40,0.35)]',
          isEdit && 'admin-edit-dialog'
        )}
      >
        <DialogHeader className="admin-dialog-header admin-create-user-header workspace-crud-dialog-header shrink-0 border-b border-border text-left">
          <DialogTitle className="admin-create-user-title workspace-crud-dialog-title">
            {isEdit ? (
              <span className="mail-edit-dialog-title">
                <span className="mail-edit-dialog-icon" aria-hidden>
                  <Pencil className="h-4 w-4" />
                </span>
                <span className="mail-edit-dialog-title-text">
                  <span className="mail-edit-dialog-kicker">Modification</span>
                  <span className="mail-edit-dialog-heading">Jour férié</span>
                </span>
              </span>
            ) : (
              'Ajouter un jour férié'
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? 'Modifier le jour férié' : 'Ajouter un jour férié'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="min-h-0"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div
            className={cn(
              'admin-dialog-body admin-create-user-grid',
              isEdit && 'mail-edit-form'
            )}
          >
            <RefDialogField id="holiday-name" label="Libellé" className="admin-create-user-span-2 admin-create-user-field">
              <Input
                id="holiday-name"
                className="admin-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </RefDialogField>
            <RefDialogField id="holiday-date" label="Date">
              <FrenchDateField
                id="holiday-date"
                className="admin-field"
                value={date}
                onChange={setDate}
              />
            </RefDialogField>
            <RefDialogField id="holiday-type" label="Type">
              <select
                id="holiday-type"
                className="admin-field admin-ref-select w-full"
                value={type}
                onChange={(e) => setType(e.target.value as HolidayType)}
              >
                {HOLIDAY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </RefDialogField>
            <div className="admin-create-user-span-2">
              <AdminDialogToggle
                id="holiday-active"
                label="Statut actif"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>
          <div className="admin-dialog-footer workspace-crud-dialog-footer">
            <button type="button" className="admin-btn-cancel" onClick={() => onOpenChange(false)}>
              Annuler
            </button>
            <button
              type="submit"
              className={isEdit ? 'mail-edit-dialog-submit' : 'admin-btn-create-role'}
              disabled={saving || !name.trim() || !date}
            >
              {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UnavailabilityReferentialDialog({
  open,
  onOpenChange,
  saving,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saving: boolean;
  initial: { name: string; meta: UnavailabilityMeta } | null;
  onSave: (payload: { name: string; meta: UnavailabilityMeta }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<UnavailabilityType>('conge');
  const [typeOther, setTypeOther] = useState('');
  const [startDate, setStartDate] = useState(initial?.meta.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.meta.endDate ?? '');
  const [startTime, setStartTime] = useState(initial?.meta.startTime ?? '08:00');
  const [endTime, setEndTime] = useState(initial?.meta.endTime ?? '18:00');
  const [motif, setMotif] = useState(initial?.meta.motif ?? '');
  const [confidentialityLevel, setConfidentialityLevel] = useState<ConfidentialityLevel>(
    initial?.meta.confidentialityLevel ?? 'standard'
  );
  const [active, setActive] = useState(initial?.meta.active ?? true);

  useEffect(() => {
    if (!open) return;
    const normalized = initial?.meta
      ? normalizeUnavailabilityFormType(initial.meta)
      : { type: 'conge' as UnavailabilityType, typeOther: '' };
    setName(initial?.name ?? '');
    setType(normalized.type);
    setTypeOther(normalized.typeOther);
    setStartDate(initial?.meta.startDate ?? '');
    setEndDate(initial?.meta.endDate ?? '');
    setStartTime(initial?.meta.startTime ?? '08:00');
    setEndTime(initial?.meta.endTime ?? '18:00');
    setMotif(initial?.meta.motif ?? '');
    setConfidentialityLevel(initial?.meta.confidentialityLevel ?? 'standard');
    setActive(initial?.meta.active ?? true);
  }, [open, initial]);

  const typeOtherInvalid = type === 'autres' && typeOther.trim().length < 2;

  const submit = () => {
    if (saving || !name.trim() || !startDate || !endDate || !motif.trim() || typeOtherInvalid) {
      return;
    }
    onSave({
      name: name.trim(),
      meta: {
        kind: 'unavailability',
        type,
        ...(type === 'autres' ? { typeOther: typeOther.trim() } : {}),
        startDate,
        endDate,
        startTime,
        endTime,
        motif: motif.trim(),
        confidentialityLevel,
        active,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-dialog admin-dialog-user-form admin-dialog-ref-unav gap-0 border-[var(--admin-border)] p-0 shadow-[0_24px_60px_-20px_rgba(15,60,40,0.35)]">
        <DialogHeader className="admin-dialog-header admin-create-user-header shrink-0 border-b border-border text-left">
          <DialogTitle className="admin-create-user-title">
            {initial ? 'Modifier l’indisponibilité' : 'Ajouter une indisponibilité'}
          </DialogTitle>
        </DialogHeader>
        <form
          className="min-h-0"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="admin-dialog-body admin-create-user-grid">
            <RefDialogField
              id="unav-title"
              label="Intitulé court"
              className="admin-create-user-span-2 admin-create-user-field"
            >
              <Input
                id="unav-title"
                className="admin-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Absence cabinet"
                autoFocus
              />
            </RefDialogField>
            <RefDialogField
              id="unav-type"
              label="Type"
              className="admin-create-user-span-2 admin-create-user-field"
            >
              <select
                id="unav-type"
                className="admin-field admin-ref-select w-full"
                value={type}
                onChange={(e) => {
                  const next = e.target.value as UnavailabilityType;
                  setType(next);
                  if (next !== 'autres') setTypeOther('');
                }}
              >
                {UNAVAILABILITY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </RefDialogField>
            {type === 'autres' ? (
              <RefDialogField
                id="unav-type-other"
                label="Précisez le type"
                className="admin-create-user-span-2 admin-create-user-field"
              >
                <Input
                  id="unav-type-other"
                  className="admin-field"
                  value={typeOther}
                  onChange={(e) => setTypeOther(e.target.value)}
                  placeholder="Ex. Visite officielle, démarche personnelle…"
                />
              </RefDialogField>
            ) : null}
            <RefDialogField id="unav-start-d" label="Date début">
              <FrenchDateField
                id="unav-start-d"
                className="admin-field"
                value={startDate}
                onChange={setStartDate}
              />
            </RefDialogField>
            <RefDialogField id="unav-end-d" label="Date fin">
              <FrenchDateField
                id="unav-end-d"
                className="admin-field"
                value={endDate}
                onChange={setEndDate}
              />
            </RefDialogField>
            <RefDialogField id="unav-start-t" label="Heure début">
              <FrenchTimeField
                id="unav-start-t"
                className="admin-field"
                value={startTime}
                onChange={setStartTime}
                stepMinutes={5}
              />
            </RefDialogField>
            <RefDialogField id="unav-end-t" label="Heure fin">
              <FrenchTimeField
                id="unav-end-t"
                className="admin-field"
                value={endTime}
                onChange={setEndTime}
                stepMinutes={5}
              />
            </RefDialogField>
            <RefDialogField
              id="unav-motif"
              label="Motif"
              className="admin-create-user-span-2 admin-create-user-field"
            >
              <textarea
                id="unav-motif"
                className="admin-field admin-ref-textarea w-full resize-y"
                rows={2}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
            </RefDialogField>
            <RefDialogField
              id="unav-conf"
              label="Confidentialité"
              className="admin-create-user-span-2 admin-create-user-field"
            >
              <select
                id="unav-conf"
                className="admin-field admin-ref-select w-full"
                value={confidentialityLevel}
                onChange={(e) => setConfidentialityLevel(e.target.value as ConfidentialityLevel)}
              >
                {CONFIDENTIALITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </RefDialogField>
            <div className="admin-create-user-span-2">
              <AdminDialogToggle
                id="unav-active"
                label="Statut actif"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>
          <div className="admin-dialog-footer">
            <button type="button" className="admin-btn-cancel" onClick={() => onOpenChange(false)}>
              Annuler
            </button>
            <button
              type="submit"
              className="admin-btn-create-role"
              disabled={
                saving ||
                !name.trim() ||
                !startDate ||
                !endDate ||
                !motif.trim() ||
                typeOtherInvalid
              }
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
