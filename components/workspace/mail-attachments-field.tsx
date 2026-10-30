'use client';

import { useRef } from 'react';
import { Loader2, Paperclip, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  newMailAttachmentKey,
  type MailAttachmentDraft,
} from '@/lib/workspace/mail-attachment-form-state';
import { formatWorkspaceFileSize } from '@/lib/storage/workspace-file-utils';

const UPLOAD_API = '/api/workspace/mail/attachments/upload';
const FILE_API = '/api/workspace/mail/attachments';

type Props = {
  mailOwnerId: string | null;
  attachments: MailAttachmentDraft[];
  setAttachments: React.Dispatch<React.SetStateAction<MailAttachmentDraft[]>>;
  canManage: boolean;
  disabled?: boolean;
};

async function deletePendingUpload(storageKey: string) {
  if (!storageKey.includes('/pending/')) return;
  await fetch(`${UPLOAD_API}?storageKey=${encodeURIComponent(storageKey)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

export function MailAttachmentsField({
  mailOwnerId,
  attachments,
  setAttachments,
  canManage,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !mailOwnerId) return;

    const draftKey = newMailAttachmentKey();
    setAttachments((prev) => [
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
      body.append('mailOwnerId', mailOwnerId);

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

      const uploaded = json.attachment as {
        fileName: string;
        fileSize: number;
        mimeType: string;
        storageKey: string;
      };

      setAttachments((prev) =>
        prev.map((a) =>
          a.key === draftKey
            ? {
                ...a,
                fileName: uploaded.fileName,
                fileSize: uploaded.fileSize,
                mimeType: uploaded.mimeType,
                storageKey: uploaded.storageKey,
                uploading: false,
                uploadError: undefined,
              }
            : a
        )
      );
    } catch (error) {
      setAttachments((prev) =>
        prev.map((a) =>
          a.key === draftKey
            ? {
                ...a,
                uploading: false,
                uploadError: error instanceof Error ? error.message : 'Échec du téléversement.',
              }
            : a
        )
      );
    }
  };

  const removeAttachment = async (attachment: MailAttachmentDraft) => {
    if (attachment.storageKey && !attachment.id) {
      await deletePendingUpload(attachment.storageKey);
    }
    setAttachments((prev) => prev.filter((a) => a.key !== attachment.key));
  };

  const isUploading = attachments.some((a) => a.uploading);

  return (
    <div className="mail-attachments-field workspace-crud-span-3">
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
          className="h-6 px-2 text-[0.625rem]"
          disabled={!mailOwnerId || disabled || isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="mr-1 h-3 w-3 shrink-0" />
          Joindre un fichier
        </Button>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="mail-attachments-list">
          {attachments.map((attachment) => (
            <li key={attachment.key} className="mail-attachments-item">
              <Paperclip className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              {attachment.id ? (
                <a
                  href={`${FILE_API}/${attachment.id}/file`}
                  className="mail-attachments-link"
                  download={attachment.fileName}
                >
                  {attachment.fileName}
                </a>
              ) : (
                <span className="mail-attachments-name">{attachment.fileName}</span>
              )}
              <span className="mail-attachments-size">{formatWorkspaceFileSize(attachment.fileSize)}</span>
              {attachment.uploading ? (
                <Loader2 className="h-3 w-3 animate-spin opacity-70" aria-hidden />
              ) : null}
              {attachment.uploadError ? (
                <span className="mail-attachments-error">{attachment.uploadError}</span>
              ) : null}
              {canManage && !disabled ? (
                <button
                  type="button"
                  className="mail-attachments-remove"
                  aria-label={`Retirer ${attachment.fileName}`}
                  onClick={() => void removeAttachment(attachment)}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mail-attachments-hint">Aucun fichier joint pour le moment.</p>
      )}
    </div>
  );
}
