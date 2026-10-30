import { randomId } from '@/lib/random-id';

export type MissionDocumentDraft = {
  key: string;
  id?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploading?: boolean;
  uploadError?: string;
};

export function newMissionDocumentKey() {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createMissionDraftOwnerId() {
  return `draft-${randomId()}`;
}
