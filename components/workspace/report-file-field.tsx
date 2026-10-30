'use client';

import { useRef } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatWorkspaceFileSize } from '@/lib/storage/workspace-file-utils';

const UPLOAD_API = '/api/workspace/documents/upload';

export type ReportFileDraft = {
  fileName: string;
  fileSize: number;
  storageKey: string;
  uploading?: boolean;
  uploadError?: string;
};

type Props = {
  value: ReportFileDraft | null;
  onChange: (value: ReportFileDraft | null) => void;
  disabled?: boolean;
};

async function deletePendingUpload(storageKey: string) {
  if (!storageKey.includes('/pending/')) return;
  await fetch(`${UPLOAD_API}?storageKey=${encodeURIComponent(storageKey)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

export function ReportFileField({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (value?.storageKey) {
      await deletePendingUpload(value.storageKey);
    }

    onChange({
      fileName: file.name,
      fileSize: file.size,
      storageKey: '',
      uploading: true,
    });

    try {
      const body = new FormData();
      body.append('file', file);

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

      const uploaded = json.file as ReportFileDraft;
      onChange({
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        storageKey: uploaded.storageKey,
      });
    } catch (err) {
      onChange({
        fileName: file.name,
        fileSize: file.size,
        storageKey: '',
        uploadError: err instanceof Error ? err.message : 'Échec du téléversement.',
      });
    }
  };

  const removeFile = async () => {
    if (value?.storageKey) {
      await deletePendingUpload(value.storageKey);
    }
    onChange(null);
  };

  return (
    <div className="workspace-report-file-field">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
        disabled={disabled || value?.uploading}
        onChange={(e) => void handleFileChange(e)}
      />
      {value?.fileName ? (
        <div className="workspace-report-file-chip">
          {value.uploading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Paperclip className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate text-xs">{value.fileName}</span>
          <span className="shrink-0 text-[0.625rem] text-muted-foreground">
            {formatWorkspaceFileSize(value.fileSize)}
          </span>
          {!disabled && !value.uploading ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              aria-label="Retirer le fichier"
              onClick={() => void removeFile()}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="workspace-crud-compact-select-trigger admin-field h-[1.75rem] w-full justify-start gap-1.5 px-2 text-xs font-normal shadow-none"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          Choisir un fichier…
        </Button>
      )}
      {value?.uploadError ? (
        <p className="mt-1 text-[0.625rem] text-destructive">{value.uploadError}</p>
      ) : null}
      {!value?.fileName ? (
        <p className="mt-1 text-[0.625rem] text-muted-foreground">
          PDF, images, Word ou Excel — max. 50 Mo.
        </p>
      ) : null}
    </div>
  );
}
