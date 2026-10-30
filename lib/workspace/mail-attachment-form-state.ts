import { randomId } from '@/lib/random-id';

export type MailAttachmentDraft = {
  key: string;
  id?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploading?: boolean;
  uploadError?: string;
};

let mailAttachmentKeySeq = 0;

export function newMailAttachmentKey() {
  mailAttachmentKeySeq += 1;
  return `mail-att-${Date.now()}-${mailAttachmentKeySeq}`;
}

export function newMailDraftOwnerId() {
  return `draft-mail-${randomId()}`;
}

export function mailAttachmentsToInput(attachments: MailAttachmentDraft[]) {
  return attachments
    .filter((a) => a.storageKey && !a.uploading && !a.uploadError)
    .map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      storageKey: a.storageKey,
    }));
}
