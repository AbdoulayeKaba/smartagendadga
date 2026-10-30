'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  Loader2,
  Paperclip,
  PenLine,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { formatWorkspaceFileSize } from '@/lib/storage/workspace-file-utils';
import type { DgMission, DgMissionDocument } from '@/lib/workspace/types';

type ReportMode = 'write' | 'upload';

type Props = {
  mission: DgMission;
  reportDocument: DgMissionDocument | null;
  canEdit: boolean;
  compact?: boolean;
  onMissionUpdate?: (mission: DgMission) => void;
  onReportDocumentChange?: (doc: DgMissionDocument | null) => void;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function MissionReportSection({
  mission,
  reportDocument,
  canEdit,
  compact = false,
  onMissionUpdate,
  onReportDocumentChange,
}: Props) {
  const [mode, setMode] = useState<ReportMode>('write');
  const [closureReport, setClosureReport] = useState('');
  const [closureResults, setClosureResults] = useState('');
  const [closureRecommendations, setClosureRecommendations] = useState('');
  const [closureComments, setClosureComments] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClosureReport(mission.closureReport ?? '');
    setClosureResults(mission.closureResults ?? '');
    setClosureRecommendations(mission.closureRecommendations ?? '');
    setClosureComments(mission.closureComments ?? '');
    setSaveState('idle');
    setSaveError(null);
    setUploadError(null);
    if (reportDocument && !mission.closureReport?.trim()) {
      setMode('upload');
    }
  }, [
    mission.id,
    mission.closureReport,
    mission.closureResults,
    mission.closureRecommendations,
    mission.closureComments,
    reportDocument,
  ]);

  const hasWrittenReport = [
    closureReport,
    closureResults,
    closureRecommendations,
    mission.closureReport,
    mission.closureResults,
    mission.closureRecommendations,
  ].some((v) => (v ?? '').trim().length > 0);

  const hasAnyReport = hasWrittenReport || Boolean(reportDocument);
  const isDirty =
    closureReport.trim() !== (mission.closureReport ?? '').trim() ||
    closureResults.trim() !== (mission.closureResults ?? '').trim() ||
    closureRecommendations.trim() !== (mission.closureRecommendations ?? '').trim() ||
    closureComments.trim() !== (mission.closureComments ?? '').trim();

  async function saveTextReport() {
    setSaveState('saving');
    setSaveError(null);
    try {
      const res = await fetch(`/api/workspace/missions/${mission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closureReport: closureReport.trim() || null,
          closureResults: closureResults.trim() || null,
          closureRecommendations: closureRecommendations.trim() || null,
          closureComments: closureComments.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : 'Enregistrement impossible.'
        );
      }
      if (json.mission) {
        try {
          onMissionUpdate?.(json.mission as DgMission);
        } catch {
          /* ne pas bloquer le retour succès */
        }
      }
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  async function uploadFile(file: File) {
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
      if (json.document) onReportDocumentChange?.(json.document as DgMissionDocument);
      if (json.mission) onMissionUpdate?.(json.mission as DgMission);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Échec du téléversement.');
    } finally {
      setUploading(false);
      setDragOver(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await uploadFile(file);
  }

  async function removeReportFile() {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`/api/workspace/missions/${mission.id}/report`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('DELETE_FAILED');
      onReportDocumentChange?.(null);
      if (json.mission) onMissionUpdate?.(json.mission as DgMission);
    } catch {
      setUploadError('Impossible de supprimer le fichier.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  if (!canEdit && !hasAnyReport) return null;

  return (
    <section className="mission-detail-card mission-detail-card--report">
      <div className="mission-report-top">
        <div className="mission-report-title-row">
          <div className="mission-report-icon-badge" aria-hidden>
            <ClipboardList className="h-3.5 w-3.5" />
          </div>
          <div className="mission-report-title-copy">
            <p className="mission-report-title">Rapport de mission</p>
            <p className="mission-report-subtitle">
              {hasAnyReport
                ? 'Compte-rendu enregistré pour cette mission'
                : 'Rédigez ou joignez le compte-rendu'}
            </p>
          </div>
        </div>
        {hasAnyReport ? (
          <span className="mission-report-status-pill" data-filled="true">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            Renseigné
          </span>
        ) : (
          <span className="mission-report-status-pill">À compléter</span>
        )}
      </div>

      {canEdit ? (
        <div className="mission-report-mode-tabs" role="tablist" aria-label="Mode rapport">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'write'}
            className="mission-report-mode-tab"
            data-active={mode === 'write' ? 'true' : undefined}
            onClick={() => setMode('write')}
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden />
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
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Joindre
          </button>
        </div>
      ) : null}

      {canEdit && mode === 'write' ? (
        <div className="mission-report-write">
          <label className="mission-report-editor">
            <span className="mission-report-field-label">Compte-rendu</span>
            <Textarea
              className="mission-report-textarea"
              placeholder="Décrivez le déroulement de la mission, les points clés, les conclusions…"
              value={closureReport}
              onChange={(e) => setClosureReport(e.target.value)}
              rows={5}
            />
            <span className="mission-report-char-count">
              {closureReport.trim().length} caractère{closureReport.trim().length !== 1 ? 's' : ''}
            </span>
          </label>

          {!compact ? (
            <div className="mission-report-details">
              <button
                type="button"
                className="mission-report-details-toggle"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((v) => !v)}
              >
                <span>Résultats &amp; recommandations</span>
                <ChevronDown
                  className="mission-report-details-chevron"
                  data-open={showDetails ? 'true' : undefined}
                  aria-hidden
                />
              </button>
              {showDetails ? (
                <div className="mission-report-details-panel">
                  <label className="mission-report-field">
                    <span className="mission-report-field-label">Résultats obtenus</span>
                    <Textarea
                      className="mission-report-textarea mission-report-textarea--sm"
                      placeholder="Objectifs atteints, livrables, décisions prises…"
                      value={closureResults}
                      onChange={(e) => setClosureResults(e.target.value)}
                      rows={3}
                    />
                  </label>
                  <label className="mission-report-field">
                    <span className="mission-report-field-label">Recommandations</span>
                    <Textarea
                      className="mission-report-textarea mission-report-textarea--sm"
                      placeholder="Actions de suivi, prochaines étapes…"
                      value={closureRecommendations}
                      onChange={(e) => setClosureRecommendations(e.target.value)}
                      rows={3}
                    />
                  </label>
                  <label className="mission-report-field">
                    <span className="mission-report-field-label">Commentaires</span>
                    <Textarea
                      className="mission-report-textarea mission-report-textarea--sm"
                      placeholder="Notes complémentaires (facultatif)"
                      value={closureComments}
                      onChange={(e) => setClosureComments(e.target.value)}
                      rows={2}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mission-report-footer">
            <button
              type="button"
              className="mission-report-save-btn"
              data-state={saveState}
              disabled={saveState === 'saving' || (!isDirty && saveState !== 'saved')}
              onClick={() => void saveTextReport()}
            >
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Enregistrement…
                </>
              ) : saveState === 'saved' ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Enregistré
                </>
              ) : (
                'Enregistrer le rapport'
              )}
            </button>
            {saveState === 'error' ? (
              <p className="mission-report-feedback mission-report-feedback--err" role="alert">
                {saveError ?? 'Échec de l’enregistrement'}
              </p>
            ) : null}
            {isDirty && saveState === 'idle' ? (
              <p className="mission-report-feedback mission-report-feedback--hint">
                Modifications non enregistrées
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {canEdit && mode === 'upload' ? (
        <div className="mission-report-upload">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
            onChange={(e) => void handleFileChange(e)}
          />

          {reportDocument ? (
            <div className="mission-report-file-card">
              <div className="mission-report-file-icon" aria-hidden>
                <FileText className="h-4 w-4" />
              </div>
              <div className="mission-report-file-meta">
                <a
                  href={`/api/workspace/missions/documents/${reportDocument.id}`}
                  className="mission-report-file-name"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {reportDocument.fileName}
                </a>
                <span className="mission-report-file-size">
                  {formatWorkspaceFileSize(reportDocument.fileSize)}
                </span>
              </div>
              <button
                type="button"
                className="mission-report-file-remove"
                disabled={uploading}
                title="Supprimer le rapport joint"
                onClick={() => void removeReportFile()}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="mission-report-dropzone"
            data-drag={dragOver ? 'true' : undefined}
            data-loading={uploading ? 'true' : undefined}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {uploading ? (
              <>
                <Loader2 className="mission-report-dropzone-icon animate-spin" aria-hidden />
                <span className="mission-report-dropzone-title">Téléversement en cours…</span>
              </>
            ) : (
              <>
                <Upload className="mission-report-dropzone-icon" aria-hidden />
                <span className="mission-report-dropzone-title">
                  {reportDocument ? 'Remplacer le fichier' : 'Glissez un fichier ici'}
                </span>
                <span className="mission-report-dropzone-hint">
                  PDF, Word, Excel ou image · max 50 Mo
                </span>
                <span className="mission-report-dropzone-action">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  Parcourir
                </span>
              </>
            )}
          </button>

          {uploadError ? (
            <p className="mission-report-feedback mission-report-feedback--err" role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>
      ) : null}

      {!canEdit && hasAnyReport ? (
        <div className="mission-report-readonly">
          {mission.closureReport?.trim() ? (
            <div className="mission-report-readonly-block">
              <div className="mission-report-field-label">Rapport</div>
              <p className="mission-report-readonly-text">{mission.closureReport}</p>
            </div>
          ) : null}
          {mission.closureResults?.trim() ? (
            <div className="mission-report-readonly-block">
              <div className="mission-report-field-label">Résultats</div>
              <p className="mission-report-readonly-text">{mission.closureResults}</p>
            </div>
          ) : null}
          {mission.closureRecommendations?.trim() ? (
            <div className="mission-report-readonly-block">
              <div className="mission-report-field-label">Recommandations</div>
              <p className="mission-report-readonly-text">{mission.closureRecommendations}</p>
            </div>
          ) : null}
          {reportDocument ? (
            <div className="mission-report-file-card">
              <div className="mission-report-file-icon" aria-hidden>
                <FileText className="h-4 w-4" />
              </div>
              <a
                href={`/api/workspace/missions/documents/${reportDocument.id}`}
                className="mission-report-file-name"
                target="_blank"
                rel="noopener noreferrer"
              >
                {reportDocument.fileName}
              </a>
              <span className="mission-report-file-size">
                {formatWorkspaceFileSize(reportDocument.fileSize)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
