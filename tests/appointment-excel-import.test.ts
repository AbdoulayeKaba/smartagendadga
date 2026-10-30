import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAppointmentImportTemplateBuffer,
  normalizeImportPriority,
  normalizeImportStatus,
  normalizeImportType,
  parseAppointmentImportWorkbook,
} from '@/lib/dg/appointment-excel-import';
import { buildImportedAppointmentDescription, parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';

describe('appointment excel import', () => {
  it('normalizes French status labels', () => {
    assert.equal(normalizeImportStatus('Approuvé'), 'APPROVED');
    assert.equal(normalizeImportStatus('En attente'), 'PENDING');
    assert.equal(normalizeImportStatus('Refusé'), 'REJECTED');
    assert.equal(normalizeImportStatus(''), 'APPROVED');
  });

  it('normalizes type and priority labels', () => {
    assert.equal(normalizeImportType('Ministère'), 'MINISTRY');
    assert.equal(normalizeImportType('Externe'), 'EXTERNAL');
    assert.equal(normalizeImportPriority('Haute'), 'HIGH');
    assert.equal(normalizeImportPriority('Basse'), 'LOW');
  });

  it('parses the official template (headers on row 4)', async () => {
    const buffer = await buildAppointmentImportTemplateBuffer();
    const parsed = await parseAppointmentImportWorkbook(buffer);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0]?.title, 'Audience ministère');
    assert.equal(parsed.rows[0]?.requesterEmail, 'manager@organisation.local');
  });

  it('marks imported descriptions with excelImport meta', () => {
    const description = buildImportedAppointmentDescription('Suivi dossier réglementaire');
    const { meta, userText } = parseAppointmentMeta(description);
    assert.equal(meta.excelImport, true);
    assert.equal(userText, 'Suivi dossier réglementaire');
  });
});
