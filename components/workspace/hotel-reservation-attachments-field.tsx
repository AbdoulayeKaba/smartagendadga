'use client';

import { useRef, useState } from 'react';
import { Loader2, Paperclip, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HOTEL_ATTACHMENT_TYPE_LABELS, HOTEL_ATTACHMENT_TYPE_ORDER } from '@/lib/workspace/labels';
import {
  newHotelAttachmentKey,
  type AttachmentDraft,
  type HotelReservationFormState,
} from '@/lib/workspace/hotel-reservation-form-state';
import { formatWorkspaceFileSize } from '@/lib/storage/workspace-file-utils';
import type { HotelReservationAttachmentType } from '@/lib/workspace/types';

const UPLOAD_API = '/api/workspace/hotel-reservations/attachments/upload';

type Props = {
  form: HotelReservationFormState;
  setForm: React.Dispatch<React.SetStateAction<HotelReservationFormState>>;
  canManage: boolean;
};

async function deletePendingUpload(storageKey: string) {
  if (!storageKey.includes('/pending/')) return;
  await fetch(`${UPLOAD_API}?storageKey=${encodeURIComponent(storageKey)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

export function HotelReservationAttachmentsField({ form, setForm, canManage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = useState<HotelReservationAttachmentType | null>(null);

  const openPicker = (type: HotelReservationAttachmentType) => {
    if (!form.missionId) return;
    setPendingType(type);
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const type = pendingType;
    event.target.value = '';
    setPendingType(null);
    if (!file || !type || !form.missionId) return;

    const draftKey = newHotelAttachmentKey();
    setForm((f) => ({
      ...f,
      attachments: [
        ...f.attachments,
        {
          key: draftKey,
          attachmentType: type,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          storageKey: '',
          uploading: true,
        },
      ],
    }));

    try {
      const body = new FormData();
      body.append('file', file);
      body.append('attachmentType', type);
      body.append('missionId', form.missionId);

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
        attachmentType: HotelReservationAttachmentType;
        fileName: string;
        fileSize: number;
        mimeType: string;
        storageKey: string;
      };

      setForm((f) => ({
        ...f,
        attachments: f.attachments.map((a) =>
          a.key === draftKey
            ? {
                ...a,
                attachmentType: uploaded.attachmentType,
                fileName: uploaded.fileName,
                fileSize: uploaded.fileSize,
                mimeType: uploaded.mimeType,
                storageKey: uploaded.storageKey,
                uploading: false,
                uploadError: undefined,
              }
            : a
        ),
      }));
    } catch (error) {
      setForm((f) => ({
        ...f,
        attachments: f.attachments.map((a) =>
          a.key === draftKey
            ? {
                ...a,
                uploading: false,
                uploadError: error instanceof Error ? error.message : 'Échec du téléversement.',
              }
            : a
        ),
      }));
    }
  };

  const removeAttachment = async (attachment: AttachmentDraft) => {
    if (attachment.storageKey) {
      await deletePendingUpload(attachment.storageKey);
    }
    setForm((f) => ({
      ...f,
      attachments: f.attachments.filter((a) => a.key !== attachment.key),
    }));
  };

  return (
    <div className="workspace-crud-nested workspace-crud-span-2 hotel-reservation-attachments">
      <div className="hotel-reservation-attachments-head">
        <p className="workspace-crud-label">Pièces jointes</p>
        {canManage ? (
          <div className="flex flex-wrap gap-1">
            {HOTEL_ATTACHMENT_TYPE_ORDER.map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 justify-start px-2 text-[0.625rem]"
                disabled={!form.missionId || form.attachments.some((a) => a.uploading)}
                onClick={() => openPicker(type)}
              >
                <Plus className="mr-1 h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{HOTEL_ATTACHMENT_TYPE_LABELS[type]}</span>
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
        onChange={(e) => void handleFileChange(e)}
      />

      {!form.missionId && canManage ? (
        <p className="text-[0.625rem] leading-snug text-amber-700">
          Sélectionnez d&apos;abord une mission pour joindre un fichier.
        </p>
      ) : null}

      {form.attachments.length === 0 ? (
        <p className="text-[0.625rem] leading-snug text-muted-foreground">
          PDF, images, Word ou Excel — max. 50 Mo.
        </p>
      ) : (
        <ul className="hotel-attachment-upload-list">
          {form.attachments.map((a) => (
            <li key={a.key} className="hotel-attachment-upload-item">
              <div className="min-w-0 flex-1">
                <p className="hotel-attachment-upload-type">
                  {HOTEL_ATTACHMENT_TYPE_LABELS[a.attachmentType]}
                </p>
                <p className="hotel-attachment-upload-name">
                  <Paperclip className="mr-1 inline h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden />
                  <span className="truncate">{a.fileName || 'Fichier…'}</span>
                </p>
                <p className="hotel-attachment-upload-meta">
                  {a.uploading
                    ? 'Téléversement en cours…'
                    : a.uploadError
                      ? a.uploadError
                      : formatWorkspaceFileSize(a.fileSize)}
                </p>
              </div>
              {a.uploading ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => void removeAttachment(a)}
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
