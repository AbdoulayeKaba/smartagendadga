import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canPreviewReportInApp,
  reportContentKind,
  reportContentKindLabel,
  reportDocumentFileUrl,
  reportMimeTypeFromFileName,
} from '@/lib/workspace/report-file';

describe('report-file', () => {
  it('détecte le type PDF', () => {
    assert.equal(
      reportContentKind({
        bodyHtml: null,
        fileName: 'documents-export (2).pdf',
        storageKey: 'reports/doc-1/file.pdf',
      }),
      'pdf'
    );
  });

  it('détecte le contenu rédigé', () => {
    assert.equal(
      reportContentKind({
        bodyHtml: '<p>Texte</p>',
        fileName: 'saisie-en-ligne.html',
        storageKey: 'reports/inline/content',
      }),
      'written'
    );
  });

  it('détecte Word docx', () => {
    assert.equal(
      reportContentKind({
        bodyHtml: null,
        fileName: 'compte-rendu.docx',
        storageKey: 'reports/doc-2/file.docx',
      }),
      'word'
    );
  });

  it('associe le bon MIME type', () => {
    assert.equal(reportMimeTypeFromFileName('rapport.PDF'), 'application/pdf');
    assert.equal(
      reportMimeTypeFromFileName('note.docx'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('génère les URLs de fichier', () => {
    assert.equal(reportDocumentFileUrl('abc'), '/api/workspace/documents/abc/file');
    assert.equal(
      reportDocumentFileUrl('abc', { download: true }),
      '/api/workspace/documents/abc/file?download=1'
    );
  });

  it('indique les types prévisualisables', () => {
    assert.equal(canPreviewReportInApp('pdf'), true);
    assert.equal(canPreviewReportInApp('word'), true);
    assert.equal(canPreviewReportInApp('spreadsheet'), false);
    assert.equal(reportContentKindLabel('written'), 'Rédaction');
  });
});
