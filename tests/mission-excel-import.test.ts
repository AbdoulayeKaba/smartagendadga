import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMissionImportTemplateBuffer,
  inferImportMissionStatus,
  normalizeImportMissionStatus,
  parseMissionImportWorkbook,
} from '@/lib/dg/mission-excel-import';
import {
  buildImportedMissionDetails,
  isMissionImportedFromExcel,
} from '@/lib/workspace/mission-import-meta';

describe('mission excel import', () => {
  it('normalizes French status labels', () => {
    assert.equal(normalizeImportMissionStatus('Terminée'), 'COMPLETED');
    assert.equal(normalizeImportMissionStatus('Planifiée'), 'PLANNED');
    assert.equal(normalizeImportMissionStatus('En cours'), 'ONGOING');
    assert.equal(normalizeImportMissionStatus('Annulée'), 'CANCELLED');
  });

  it('infers status from dates when column is empty', () => {
    const pastDepart = '2020-01-01';
    const pastReturn = '2020-01-05';
    assert.equal(inferImportMissionStatus(pastDepart, pastReturn), 'COMPLETED');
  });

  it('parses the official template (headers on row 4)', async () => {
    const buffer = await buildMissionImportTemplateBuffer();
    const parsed = await parseMissionImportWorkbook(buffer);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0]?.subject, 'Mission de coordination régionale');
    assert.deepEqual(parsed.rows[0]?.destinations, ['GN', 'SN']);
    assert.equal(parsed.rows[0]?.status, 'COMPLETED');
  });

  it('marks imported details with excel marker', () => {
    const details = buildImportedMissionDetails('Notes de mission');
    assert.equal(isMissionImportedFromExcel(details), true);
    assert.match(details ?? '', /Importé depuis un fichier Excel/);
  });
});
