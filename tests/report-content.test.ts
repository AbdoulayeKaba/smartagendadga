import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findReportTitleConflict,
  normalizeReportTitle,
  reportContentPreview,
  reportsAreDuplicates,
  reportsShareTitle,
  stripReportHtml,
} from '@/lib/workspace/report-content';

describe('report-content', () => {
  it('extrait un aperçu texte sans balises', () => {
    assert.equal(
      reportContentPreview({
        bodyHtml: '<p>Compte rendu <strong>TEST</strong></p>',
        fileName: 'saisie-en-ligne.html',
        storageKey: 'reports/inline/content',
      }),
      'Compte rendu TEST'
    );
  });

  it('tronque les aperçus longs', () => {
    const long = 'a'.repeat(150);
    assert.equal(
      reportContentPreview(
        {
          bodyHtml: `<p>${long}</p>`,
          fileName: 'saisie-en-ligne.html',
          storageKey: 'reports/inline/content',
        },
        40
      ).endsWith('…'),
      true
    );
  });

  it('détecte les doublons par titre uniquement (date et contenu ignorés)', () => {
    const base = { title: 'TEST' };
    assert.equal(reportsAreDuplicates(base, { ...base }), true);
    assert.equal(reportsShareTitle(base, { title: '  test ' }), true);
    assert.equal(reportsAreDuplicates(base, { title: 'TEST' }), true);
    assert.equal(reportsAreDuplicates(base, { title: 'Autre titre' }), false);
    assert.equal(
      reportsAreDuplicates(
        { title: 'Réunion DGA' },
        { title: 'Réunion DGA' }
      ),
      true
    );
  });

  it('findReportTitleConflict exclut le document en cours d’édition', () => {
    const rows = [
      { id: 'a', title: 'Réunion' },
      { id: 'b', title: 'Autre' },
    ];
    assert.equal(findReportTitleConflict(rows, { title: 'Réunion' }, 'a')?.id, undefined);
    assert.equal(findReportTitleConflict(rows, { title: 'Réunion' })?.id, 'a');
    assert.equal(findReportTitleConflict(rows, { title: 'réunion' })?.id, 'a');
  });

  it('normalizeReportTitle ignore casse et espaces', () => {
    assert.equal(normalizeReportTitle('  Mon Titre  '), 'mon titre');
  });

  it('stripReportHtml normalise le HTML vide', () => {
    assert.equal(stripReportHtml('<p></p>'), '');
    assert.equal(stripReportHtml('<p>ok</p>'), 'ok');
  });
});
