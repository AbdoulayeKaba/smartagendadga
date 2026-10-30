'use client';

import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
};

type ImportErrorRow = { line: number; message: string };

type ImportResponse = {
  created?: number;
  skipped?: number;
  parseErrors?: ImportErrorRow[];
  importErrors?: ImportErrorRow[];
  errors?: ImportErrorRow[];
  message?: string;
  error?: string;
};

function formatImportFailureDescription(payload: ImportResponse): string {
  const rows = payload.errors ?? payload.parseErrors ?? [];
  if (rows.length > 0) {
    const preview = rows
      .slice(0, 2)
      .map((err) => `Ligne ${err.line} : ${err.message}`)
      .join(' · ');
    return rows.length > 2 ? `${preview} · …` : preview;
  }
  return payload.message ?? payload.error ?? 'Erreur lors de l’import.';
}

export function AppointmentImportDialog({ open, onOpenChange, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResponse | null>(null);

  const reset = () => {
    setFile(null);
    setLastResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/api/appointments/import');
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Modèle indisponible' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'modele-import-rendez-vous.xlsx';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ variant: 'destructive', title: 'Téléchargement impossible' });
    }
  };

  const runImport = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'Sélectionnez un fichier Excel.' });
      return;
    }

    setLoading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/appointments/import', { method: 'POST', body });
      const j = (await res.json().catch(() => ({}))) as ImportResponse;
      if (!res.ok) {
        const failure: ImportResponse = {
          ...j,
          parseErrors: j.parseErrors ?? j.errors,
        };
        setLastResult(failure);
        toast({
          variant: 'destructive',
          title: 'Import impossible',
          description: formatImportFailureDescription(failure),
        });
        return;
      }

      setLastResult(j);
      toast({
        title: 'Import terminé',
        description: `${j.created ?? 0} rendez-vous importé(s)${
          (j.skipped ?? 0) > 0 ? ` · ${j.skipped} ignoré(s)` : ''
        }`,
      });
      await onImported();
      if ((j.parseErrors?.length ?? 0) === 0 && (j.importErrors?.length ?? 0) === 0) {
        handleClose(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const allErrors = [
    ...(lastResult?.parseErrors ?? []),
    ...(lastResult?.importErrors ?? []),
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="admin-theme admin-appt-import-dialog gap-0 border-[var(--admin-border)] p-0 sm:max-w-[28rem]">
        <header className="admin-appt-import-header">
          <div className="admin-appt-import-header-icon" aria-hidden>
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="admin-appt-import-title">
              Importer des rendez-vous
            </DialogTitle>
            <DialogDescription className="admin-appt-import-subtitle">
              Chargez l’historique des anciens RDV suivis avant la mise en place du système.
            </DialogDescription>
          </div>
        </header>

        <div className="admin-appt-import-body">
          <button type="button" className="admin-appt-import-template-btn" onClick={() => void downloadTemplate()}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            Télécharger le modèle Excel
          </button>

          <div className="admin-appt-import-drop">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              id="appt-import-file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setLastResult(null);
              }}
            />
            <label htmlFor="appt-import-file" className="admin-appt-import-drop-label">
              <Upload className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
              <span className="min-w-0">
                {file ? (
                  <>
                    <span className="admin-appt-import-file-name">{file.name}</span>
                    <span className="admin-appt-import-file-hint">Cliquez pour changer de fichier</span>
                  </>
                ) : (
                  <>
                    <span className="admin-appt-import-file-name">Choisir un fichier .xlsx</span>
                    <span className="admin-appt-import-file-hint">
                      Colonnes : titre, date, horaires, email demandeur…
                    </span>
                  </>
                )}
              </span>
            </label>
          </div>

          {allErrors.length > 0 ? (
            <div className="admin-appt-import-errors" role="alert">
              <p className="admin-appt-import-errors-title">Lignes en erreur</p>
              <ul className="admin-appt-import-errors-list">
                {allErrors.slice(0, 8).map((err) => (
                  <li key={`${err.line}-${err.message}`}>
                    Ligne {err.line} : {err.message}
                  </li>
                ))}
                {allErrors.length > 8 ? (
                  <li>… et {allErrors.length - 8} autre(s) erreur(s)</li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="admin-appt-import-footer">
          <button
            type="button"
            className="admin-appt-detail-btn inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            onClick={() => handleClose(false)}
            disabled={loading}
          >
            Annuler
          </button>
          <button
            type="button"
            className="admin-appt-detail-btn inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-45"
            disabled={loading || !file}
            onClick={() => void runImport()}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Lancer l’import
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
