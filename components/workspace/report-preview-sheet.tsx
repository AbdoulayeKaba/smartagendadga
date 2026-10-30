'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Hash,
  Image as ImageIcon,
  Loader2,
  Pencil,
} from 'lucide-react';
import { formatWorkspaceFileSize } from '@/lib/storage/workspace-file-utils';
import { reportHasAttachment, stripReportHtml } from '@/lib/workspace/report-content';
import {
  canPreviewReportInApp,
  reportContentKind,
  reportContentKindLabel,
  reportDocumentFileUrl,
  type ReportContentKind,
} from '@/lib/workspace/report-file';
import type { VaultDocument } from '@/lib/workspace/types';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import '@/components/workspace/report-preview-sheet.css';

type Props = {
  document: VaultDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage?: boolean;
  onEdit?: (document: VaultDocument) => void;
};

function truncateFileName(name: string, max = 40): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot) : '';
  const base = dot > 0 ? name.slice(0, dot) : name;
  const keep = Math.max(8, max - ext.length - 1);
  return `${base.slice(0, keep)}…${ext}`;
}

function KindIcon({ kind, className }: { kind: ReportContentKind; className?: string }) {
  const props = { className: cn('h-3.5 w-3.5 shrink-0', className), 'aria-hidden': true as const };
  switch (kind) {
    case 'pdf':
      return <FileType {...props} />;
    case 'word':
      return <FileText {...props} />;
    case 'image':
      return <ImageIcon {...props} />;
    case 'spreadsheet':
      return <FileSpreadsheet {...props} />;
    default:
      return <FileText {...props} />;
  }
}

function ProseDocument({ html }: { html: string }) {
  return (
    <div className="report-preview-document">
      <article className="report-preview-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function ReportPreviewSheet({
  document,
  open,
  onOpenChange,
  canManage = false,
  onEdit,
}: Props) {
  const kind = document ? reportContentKind(document) : 'unknown';
  const fileUrl = document ? reportDocumentFileUrl(document.id) : '';
  const downloadUrl = document ? reportDocumentFileUrl(document.id, { download: true }) : '';
  const pdfPreviewUrl = fileUrl ? `${fileUrl}#toolbar=0&navpanes=0&view=FitH` : '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);

  const writtenHtml = useMemo(() => {
    if (!document || kind !== 'written') return null;
    return document.bodyHtml?.trim() || null;
  }, [document, kind]);

  const readingStats = useMemo(() => {
    if (!document) return null;
    const text =
      kind === 'written'
        ? stripReportHtml(document.bodyHtml ?? '')
        : kind === 'word' && wordHtml
          ? stripReportHtml(wordHtml)
          : '';
    if (!text) return null;
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words === 0) return null;
    const minutes = Math.max(1, Math.ceil(words / 220));
    return { words, minutes };
  }, [document, kind, wordHtml]);

  const loadWordPreview = useCallback(async () => {
    if (!document || kind !== 'word') return;
    setLoading(true);
    setError(null);
    setWordHtml(null);
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('FETCH_FAILED');
      const buffer = await response.arrayBuffer();
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
      setWordHtml(result.value);
    } catch {
      setError('Impossible d’afficher ce document Word. Téléchargez-le pour l’ouvrir localement.');
    } finally {
      setLoading(false);
    }
  }, [document, kind, fileUrl]);

  const probePdf = useCallback(async () => {
    if (!document || kind !== 'pdf') return;
    setLoading(true);
    setError(null);
    setPdfReady(false);
    try {
      const response = await fetch(fileUrl, { method: 'GET', cache: 'no-store' });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.includes('pdf')) {
        throw new Error('FILE_NOT_FOUND');
      }
      setPdfReady(true);
    } catch {
      setError('Fichier PDF introuvable ou inaccessible. Téléchargez-le si disponible, ou redéposez le document.');
      setPdfReady(false);
    } finally {
      setLoading(false);
    }
  }, [document, kind, fileUrl]);

  useEffect(() => {
    if (!open || !document) {
      setWordHtml(null);
      setError(null);
      setLoading(false);
      setPdfReady(false);
      return;
    }
    if (kind === 'word') {
      void loadWordPreview();
    } else if (kind === 'pdf') {
      void probePdf();
    }
  }, [open, document, kind, loadWordPreview, probePdf]);

  const showPreview = document && canPreviewReportInApp(kind);
  const formattedDate = document
    ? format(new Date(document.reportDate), 'd MMMM yyyy', { locale: fr })
    : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="admin-theme report-preview-sheet">
        {!document ? (
          <SheetTitle className="sr-only">Aperçu du compte rendu</SheetTitle>
        ) : (
          <div className="report-preview-layout">
            <SheetHeader className="report-preview-header">
              <div className="report-preview-header-top">
                <div className="report-preview-head-main">
                  <div className="report-preview-head-icon" aria-hidden>
                    <KindIcon kind={kind} className="h-4 w-4" />
                  </div>
                  <span className="report-preview-kind-badge" data-kind={kind}>
                    {reportContentKindLabel(kind)}
                  </span>
                </div>
              </div>
              <SheetTitle className="report-preview-title">{document.title}</SheetTitle>
              <SheetDescription asChild>
                <div className="report-preview-meta">
                  <span className="report-preview-meta-item">
                    <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                    {formattedDate}
                  </span>
                  {kind !== 'written' && document.fileName ? (
                    <>
                      <span className="report-preview-meta-sep" aria-hidden>
                        ·
                      </span>
                      <span
                        className="report-preview-meta-item report-preview-meta-item--muted"
                        title={document.fileName}
                      >
                        <Hash className="h-3 w-3 shrink-0" aria-hidden />
                        {truncateFileName(document.fileName)}
                        {document.fileSize > 0
                          ? ` · ${formatWorkspaceFileSize(document.fileSize)}`
                          : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="report-preview-meta-sep" aria-hidden>
                        ·
                      </span>
                      <span className="report-preview-meta-item report-preview-meta-item--muted">
                        Rédigé en ligne
                      </span>
                    </>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>

            {(kind === 'written' || kind === 'word') && readingStats ? (
              <div className="report-preview-stats-bar">
                <span className="report-preview-stats-label">Aperçu lecture</span>
                <span className="report-preview-stats-value">
                  {readingStats.words} mot{readingStats.words > 1 ? 's' : ''} · ~{readingStats.minutes}{' '}
                  min
                </span>
              </div>
            ) : kind === 'pdf' ? (
              <div className="report-preview-stats-bar">
                <span className="report-preview-stats-label">Document PDF</span>
                <span className="report-preview-stats-value" title={document.fileName}>
                  {truncateFileName(document.fileName, 32)}
                </span>
              </div>
            ) : null}

            <div className="report-preview-body">
              {loading ? (
                <div className="report-preview-state">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  <span>Chargement de l’aperçu…</span>
                </div>
              ) : error ? (
                <div className="report-preview-fallback">
                  <p>{error}</p>
                  <a href={downloadUrl} className="report-preview-download-btn" download>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Télécharger le fichier
                  </a>
                </div>
              ) : kind === 'written' && writtenHtml ? (
                <ProseDocument html={writtenHtml} />
              ) : kind === 'word' && wordHtml ? (
                <ProseDocument html={wordHtml} />
              ) : kind === 'pdf' && pdfReady ? (
                <div className="report-preview-document report-preview-document--embed">
                  <div className="report-preview-embed-head">
                    <FileType className="h-3 w-3 shrink-0" aria-hidden />
                    <span>Aperçu du document</span>
                  </div>
                  <object
                    title={`Aperçu PDF — ${document.title}`}
                    data={pdfPreviewUrl}
                    type="application/pdf"
                    className="report-preview-iframe"
                  >
                    <iframe
                      title={`Aperçu PDF — ${document.title}`}
                      src={pdfPreviewUrl}
                      className="report-preview-iframe"
                    />
                  </object>
                </div>
              ) : kind === 'pdf' ? (
                <div className="report-preview-fallback">
                  <div className="report-preview-fallback-icon" aria-hidden>
                    <KindIcon kind="pdf" className="h-7 w-7" />
                  </div>
                  <p>Chargement de l’aperçu PDF…</p>
                </div>
              ) : kind === 'image' ? (
                <div className="report-preview-document report-preview-document--embed">
                  <div className="report-preview-image-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl}
                      alt={document.fileName}
                      className="report-preview-image"
                    />
                  </div>
                </div>
              ) : !showPreview ? (
                <div className="report-preview-fallback">
                  <div className="report-preview-fallback-icon" aria-hidden>
                    <KindIcon kind={kind} className="h-7 w-7" />
                  </div>
                  <p>
                    Aperçu non disponible pour ce type de fichier.
                    <br />
                    Téléchargez-le pour le consulter.
                  </p>
                  <a href={downloadUrl} className="report-preview-download-btn" download>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Télécharger {document.fileName}
                  </a>
                </div>
              ) : null}
            </div>

            <footer className="report-preview-footer">
              {reportHasAttachment(document) ? (
                <a
                  href={downloadUrl}
                  className="report-preview-footer-btn report-preview-footer-btn--primary"
                  download
                  title="Télécharger"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Télécharger
                </a>
              ) : (
                <span className="report-preview-footer-hint">
                  <CheckCircle2 aria-hidden />
                  Compte rendu enregistré
                </span>
              )}
              {canManage && onEdit ? (
                <div className="report-preview-footer-actions">
                  <button
                    type="button"
                    className="report-preview-footer-btn report-preview-footer-btn--secondary"
                    onClick={() => {
                      onOpenChange(false);
                      onEdit(document);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Modifier
                  </button>
                </div>
              ) : null}
            </footer>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

