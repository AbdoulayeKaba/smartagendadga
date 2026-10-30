'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, PenLine, Upload } from 'lucide-react';
import { WorkspaceCrudDialog, WorkspaceCrudField } from '@/components/workspace/workspace-crud-dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatWorkspaceFileSize } from '@/lib/storage/workspace-file-utils';
import type { DgMission, DgMissionDocument } from '@/lib/workspace/types';

type ReportMode = 'write' | 'upload';

type Props = {
  mission: DgMission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportRequired?: boolean;
  loading?: boolean;
  onConfirm: (payload: {
    closureReport: string;
    closureResults: string;
    closureRecommendations: string;
    closureComments: string;
  }) => void;
};

export function MissionCloseDialog({
  mission,
  open,
  onOpenChange,
  reportRequired = false,
  loading = false,
  onConfirm,
}: Props) {
  const [mode, setMode] = useState<ReportMode>('write');
  const [closureReport, setClosureReport] = useState('');
  const [closureResults, setClosureResults] = useState('');
  const [closureRecommendations, setClosureRecommendations] = useState('');
  const [closureComments, setClosureComments] = useState('');
  const [reportDocument, setReportDocument] = useState<DgMissionDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !mission) {
      setClosureReport('');
      setClosureResults('');
      setClosureRecommendations('');
      setClosureComments('');
      setReportDocument(null);
      setMode('write');
      setUploadError(null);
      return;
    }

    setClosureReport(mission.closureReport ?? '');
    setClosureResults(mission.closureResults ?? '');
    setClosureRecommendations(mission.closureRecommendations ?? '');
    setClosureComments(mission.closureComments ?? '');

    void fetch(`/api/workspace/missions/${mission.id}/documents`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((json: { items?: DgMissionDocument[] }) => {
        const report = (json.items ?? []).find((d) => d.documentType === 'REPORT') ?? null;
        setReportDocument(report);
        if (report && !mission.closureReport?.trim()) setMode('upload');
      })
      .catch(() => setReportDocument(null));
  }, [open, mission]);

  const hasText =
    [closureReport, closureResults, closureRecommendations].some((v) => v.trim().length >= 3);
  const hasRequired = !reportRequired || hasText || Boolean(reportDocument);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !mission) return;

    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/workspace/missions/${mission.id}/report`, {
        method: 'POST',
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof json.error === 'string' ? json.error : 'UPLOAD_FAILED';
        throw new Error(
          code === 'FILE_TOO_LARGE'
            ? 'Fichier trop volumineux (max 50 Mo).'
            : code === 'UNSUPPORTED_FILE_TYPE'
              ? 'Type de fichier non pris en charge.'
              : 'Échec du téléversement.'
        );
      }
      if (json.document) setReportDocument(json.document as DgMissionDocument);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Échec du téléversement.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <WorkspaceCrudDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Clôturer la mission"
      onSubmit={() => {
        if (!hasRequired) return;
        onConfirm({
          closureReport: closureReport.trim(),
          closureResults: closureResults.trim(),
          closureRecommendations: closureRecommendations.trim(),
          closureComments: closureComments.trim(),
        });
      }}
      footer={
        <>
          <button type="button" className="admin-btn-cancel" onClick={() => onOpenChange(false)}>
            Annuler
          </button>
          <button type="submit" className="admin-btn-create" disabled={!hasRequired || loading}>
            {loading ? 'En cours…' : 'Clôturer'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        {mission ? (
          <>
            Clôture de <span className="font-medium text-foreground">{mission.subject}</span>
            {reportRequired
              ? ' — rapport obligatoire (texte ou fichier joint).'
              : ' — le rapport est facultatif.'}
          </>
        ) : null}
      </p>

      <div className="mission-report-mode-tabs mb-3" role="tablist" aria-label="Mode rapport">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'write'}
          className="mission-report-mode-tab"
          data-active={mode === 'write' ? 'true' : undefined}
          onClick={() => setMode('write')}
        >
          <PenLine className="h-3 w-3" aria-hidden />
          Rédiger
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'upload'}
          className="mission-report-mode-tab"
          data-active={mode === 'upload' ? 'true' : undefined}
          onClick={() => setMode('upload')}
        >
          <Upload className="h-3 w-3" aria-hidden />
          Joindre un fichier
        </button>
      </div>

      {mode === 'write' ? (
        <div className="workspace-crud-form-grid">
          <WorkspaceCrudField
            id="closure-report"
            label={reportRequired ? 'Rapport de mission *' : 'Rapport de mission'}
            className="workspace-crud-span-2"
          >
            <Textarea
              id="closure-report"
              className="admin-field workspace-crud-textarea min-h-[3rem] resize-y"
              value={closureReport}
              onChange={(e) => setClosureReport(e.target.value)}
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField
            id="closure-results"
            label={reportRequired ? 'Résultats obtenus *' : 'Résultats obtenus'}
            className="workspace-crud-span-2"
          >
            <Textarea
              id="closure-results"
              className="admin-field workspace-crud-textarea min-h-[3rem] resize-y"
              value={closureResults}
              onChange={(e) => setClosureResults(e.target.value)}
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField
            id="closure-recommendations"
            label={reportRequired ? 'Recommandations *' : 'Recommandations'}
            className="workspace-crud-span-2"
          >
            <Textarea
              id="closure-recommendations"
              className="admin-field workspace-crud-textarea min-h-[3rem] resize-y"
              value={closureRecommendations}
              onChange={(e) => setClosureRecommendations(e.target.value)}
            />
          </WorkspaceCrudField>
          <WorkspaceCrudField id="closure-comments" label="Commentaires" className="workspace-crud-span-2">
            <Textarea
              id="closure-comments"
              className="admin-field workspace-crud-textarea min-h-[2.5rem] resize-y"
              value={closureComments}
              onChange={(e) => setClosureComments(e.target.value)}
            />
          </WorkspaceCrudField>
        </div>
      ) : (
        <div className="mission-report-upload">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
            onChange={(e) => void handleFileChange(e)}
          />
          {reportDocument ? (
            <p className="mb-2 text-sm">
              Fichier joint :{' '}
              <span className="font-medium">{reportDocument.fileName}</span>
              <span className="text-muted-foreground">
                {' '}
                ({formatWorkspaceFileSize(reportDocument.fileSize)})
              </span>
            </p>
          ) : (
            <p className="mb-2 text-sm text-muted-foreground">Aucun rapport joint pour le moment.</p>
          )}
          <button
            type="button"
            className="admin-btn-cancel inline-flex items-center gap-1.5"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Téléversement…
              </>
            ) : (
              <>
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                {reportDocument ? 'Remplacer le fichier' : 'Joindre un rapport'}
              </>
            )}
          </button>
          {uploadError ? <p className="mission-report-upload-error mt-2">{uploadError}</p> : null}
        </div>
      )}
    </WorkspaceCrudDialog>
  );
}
