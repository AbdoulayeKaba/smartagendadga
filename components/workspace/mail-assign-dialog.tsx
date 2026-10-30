'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDepartmentsReferential } from '@/hooks/use-departments-referential';
import { WORKSPACE_ASSIGNEE_SERVICES } from '@/lib/workspace/assignee-utils';
import { formatMailDate } from '@/lib/workspace/mail-utils';
import type { MailItem } from '@/lib/workspace/types';

const CUSTOM_SERVICE = '__custom__';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export type MailAssignmentPayload = {
  assignedService: string;
  executor: string | null;
  assignedAt: string;
};

type Props = {
  mail: MailItem | null;
  open: boolean;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: MailAssignmentPayload) => void;
};

export function MailAssignDialog({ mail, open, loading = false, onOpenChange, onConfirm }: Props) {
  const { departments, loading: departmentsLoading } = useDepartmentsReferential(open);
  const serviceOptions = useMemo(() => {
    const fromRef = departments.map((d) => d.name.trim()).filter(Boolean);
    const merged = [...fromRef];
    for (const name of WORKSPACE_ASSIGNEE_SERVICES) {
      if (!merged.some((s) => s.toLowerCase() === name.toLowerCase())) merged.push(name);
    }
    if (mail?.assignedService?.trim()) {
      const current = mail.assignedService.trim();
      if (!merged.some((s) => s.toLowerCase() === current.toLowerCase())) merged.unshift(current);
    }
    return merged.sort((a, b) => a.localeCompare(b, 'fr'));
  }, [departments, mail?.assignedService]);

  const [serviceSelect, setServiceSelect] = useState('');
  const [customService, setCustomService] = useState('');
  const [executor, setExecutor] = useState('');
  const [assignedAt, setAssignedAt] = useState(todayIsoDate());

  useEffect(() => {
    if (!open || !mail) return;
    const current = mail.assignedService?.trim() || '';
    const known = serviceOptions.some((s) => s.toLowerCase() === current.toLowerCase());
    if (current && !known) {
      setServiceSelect(CUSTOM_SERVICE);
      setCustomService(current);
    } else {
      setServiceSelect(current);
      setCustomService('');
    }
    setExecutor(mail.executor?.trim() || '');
    setAssignedAt(mail.assignedAt?.slice(0, 10) || todayIsoDate());
  }, [open, mail, serviceOptions]);

  const resolvedService =
    serviceSelect === CUSTOM_SERVICE ? customService.trim() : serviceSelect.trim();
  const resolvedExecutor = executor.trim();
  const valid = resolvedService.length >= 2 || resolvedExecutor.length >= 2;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && loading) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="admin-theme mail-assign-dialog gap-0 border-[var(--admin-border)] p-0 sm:max-w-[26rem]">
        <header className="mail-assign-dialog-head">
          <div className="mail-assign-dialog-icon" aria-hidden>
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="mail-assign-dialog-title">Affecter le courrier</DialogTitle>
            <DialogDescription className="mail-assign-dialog-sub">
              {mail ? (
                <>Service ou destinataire de « {mail.reference} ».</>
              ) : (
                'Indiquez où / à qui le courrier est affecté.'
              )}
            </DialogDescription>
          </div>
        </header>

        <div className="mail-assign-dialog-body">
          <div className="mail-assign-dialog-grid">
            <div className="mail-assign-dialog-field">
              <label htmlFor="mail-assign-service" className="mail-assign-dialog-label">
                Service / direction
              </label>
              <Select
                value={serviceSelect || undefined}
                onValueChange={setServiceSelect}
                disabled={loading || departmentsLoading}
              >
                <SelectTrigger
                  id="mail-assign-service"
                  className="admin-field mail-assign-dialog-control w-full"
                >
                  <SelectValue placeholder="Choisir un service…" />
                </SelectTrigger>
                <SelectContent>
                  {serviceOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_SERVICE}>Autre (saisie libre)</SelectItem>
                </SelectContent>
              </Select>
              {serviceSelect === CUSTOM_SERVICE ? (
                <Input
                  className="admin-field mail-assign-dialog-control"
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  placeholder="Nom du service"
                  disabled={loading}
                  autoFocus
                />
              ) : null}
            </div>

            <div className="mail-assign-dialog-field">
              <label htmlFor="mail-assign-executor" className="mail-assign-dialog-label">
                <User className="h-2.5 w-2.5" aria-hidden />
                Exécutant
              </label>
              <Input
                id="mail-assign-executor"
                className="admin-field mail-assign-dialog-control"
                value={executor}
                onChange={(e) => setExecutor(e.target.value)}
                placeholder="DRM/DTRI"
                disabled={loading}
              />
            </div>

            <div className="mail-assign-dialog-field mail-assign-dialog-field--full">
              <label htmlFor="mail-assign-date" className="mail-assign-dialog-label">
                <Calendar className="h-2.5 w-2.5" aria-hidden />
                Date d’affectation
              </label>
              <Input
                id="mail-assign-date"
                type="text"
                readOnly
                tabIndex={-1}
                className="admin-field mail-assign-dialog-control mail-form-field--auto"
                value={formatMailDate(assignedAt)}
                title="Date enregistrée automatiquement à la confirmation"
              />
            </div>
          </div>

          <p className="mail-assign-dialog-hint">
            Au moins le service ou l’exécutant. La date d’affectation est enregistrée automatiquement.
          </p>
        </div>

        <footer className="mail-assign-dialog-footer">
          <button
            type="button"
            className="admin-btn-cancel mail-assign-dialog-btn"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </button>
          <button
            type="button"
            className="admin-btn-create mail-assign-dialog-btn"
            disabled={!valid || loading}
            onClick={() =>
              onConfirm({
                assignedService: resolvedService || resolvedExecutor,
                executor: resolvedExecutor || null,
                assignedAt,
              })
            }
          >
            {loading ? 'Affectation…' : 'Confirmer'}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
