import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import {
  buildAppointmentImportTemplateBuffer,
  importHistoricalAppointments,
  parseAppointmentImportWorkbook,
} from '@/lib/dg/appointment-excel-import';

export async function GET() {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userHasPermission(session.role, 'appointments.review'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const buffer = await buildAppointmentImportTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modele-import-rendez-vous.xlsx"',
    },
  });
}

export async function POST(req: Request) {
  try {
    const { session, error } = await requireApiSession();
    if (error) return error;
    if (!(await userHasPermission(session.role, 'appointments.review'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Fichier requis.' }, { status: 422 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Format accepté : .xlsx uniquement.' },
        { status: 422 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseAppointmentImportWorkbook(buffer);

    if (parsed.rows.length === 0 && parsed.errors.length > 0) {
      return NextResponse.json(
        { error: 'PARSE_ERROR', errors: parsed.errors },
        { status: 422 }
      );
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Aucune ligne à importer.' },
        { status: 422 }
      );
    }

    const result = await importHistoricalAppointments(parsed.rows, session.userId);

    return NextResponse.json({
      ok: true,
      created: result.created,
      skipped: result.skipped,
      parseErrors: parsed.errors,
      importErrors: result.errors,
    });
  } catch (e) {
    console.error('[POST /api/appointments/import]', e);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Erreur lors de l’import Excel.' },
      { status: 500 }
    );
  }
}
