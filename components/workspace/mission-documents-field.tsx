'use client';

import { useRef } from 'react';
import { Loader2, Paperclip, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  newMissionDocumentKey,
  type MissionDocumentDraft,
} from '@/lib/workspace/mission-document-form-state';
import { formatWorkspaceFileSize } from '@/lib/storage/workspace-file-utils';

const UPLOAD_API = '/api/workspace/missions/documents/upload';

type Props = {
  ownerId: string | null;
  documents: MissionDocumentDraft[];
  setDocuments: React.Dispatch<React.SetStateAction<MissionDocumentDraft[]>>;
  canManage: boolean;
  disabled?: boolean;
};

async function deletePendingUpload(storageKey: string) {
  if (!storageKey.includes('/pending/')) return;
  await fetch(`${UPLOAD_API}?storageKey=${encodeURIComponent(storageKey)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

export function MissionDocumentsField({
  ownerId,
  documents,
  setDocuments,
  canManage,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !ownerId) return;

    const draftKey = newMissionDocumentKey();
    setDocuments((prev) => [
      ...prev,
      {
        key: draftKey,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        storageKey: '',
        uploading: true,
      },
    ]);

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('ownerId', ownerId);

      const res = await fetch(UPLOAD_API, { method: 'POST', body });
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

      const uploaded = json.document as {
        fileName: string;
        fileSize: number;
        mimeType: string;
        storageKey: string;
      };

      setDocuments((prev) =>
        prev.map((d) =>
          d.key === draftKey
            ? {
                ...d,
                fileName: uploaded.fileName,
                fileSize: uploaded.fileSize,
                mimeType: uploaded.mimeType,
                storageKey: uploaded.storageKey,
                uploading: false,
                uploadError: undefined,
              }
            : d
        )
      );
    } catch (error) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.key === draftKey
            ? {
                ...d,
                uploading: false,
                uploadError: error instanceof Error ? error.message : 'Échec du téléversement.',
              }
            : d
        )
      );
    }
  };

  const removeDocument = async (doc: MissionDocumentDraft) => {
    if (doc.storageKey && !doc.id) {
      await deletePendingUpload(doc.storageKey);
    }
    setDocuments((prev) => prev.filter((d) => d.key !== doc.key));
  };

  const isUploading = documents.some((d) => d.uploading);

  return (
    <div className="workspace-crud-nested workspace-crud-span-2">
      <p className="workspace-crud-label">Documents</p>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
        onChange={(e) => void handleFileChange(e)}
      />

      {canManage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[0.6875rem]"
          disabled={!ownerId || disabled || isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="mr-1 h-3 w-3 shrink-0" />
          Ajouter un document
        </Button>
      ) : null}

      {!ownerId && canManage ? (
        <p className="mt-1 text-[0.625rem] leading-snug text-muted-foreground">
          Préparation du formulaire…
        </p>
      ) : null}

      {documents.length === 0 ? (
        <p className="mt-1 text-[0.625rem] leading-snug text-muted-foreground">
          Ordres de mission, invitations, programmes… PDF, images, Word ou Excel — max. 50 Mo.
        </p>
      ) : (
        <ul className="hotel-attachment-upload-list mt-1.5">
          {documents.map((doc) => (
            <li key={doc.key} className="hotel-attachment-upload-item">
              <div className="min-w-0 flex-1">
                <p className="hotel-attachment-upload-name">
                  <Paperclip className="mr-1 inline h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden />
                  {doc.id ? (
                    <a
                      href={`/api/workspace/missions/documents/${doc.id}`}
                      className="truncate text-[var(--admin-primary)] hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {doc.fileName}
                    </a>
                  ) : (
                    <span className="truncate">{doc.fileName || 'Fichier…'}</span>
                  )}
                </p>
                <p className="hotel-attachment-upload-meta">
                  {doc.uploading
                    ? 'Téléversement en cours…'
                    : doc.uploadError
                      ? doc.uploadError
                      : formatWorkspaceFileSize(doc.fileSize)}
                </p>
              </div>
              {doc.uploading ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : canManage && !disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => void removeDocument(doc)}
                  title="Retirer"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
