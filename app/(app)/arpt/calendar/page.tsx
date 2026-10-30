'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CalendarLeave = { id: string; employeeName: string; startDate: string; endDate: string; status: string };
type Holiday = { id: string; date: string; name: string };

export default function ArptCalendarPage() {
  const [leaves, setLeaves] = useState<CalendarLeave[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    void fetch(`/api/arpt/calendar?month=${month}`)
      .then((r) => (r.ok ? r.json() : { leaves: [], holidays: [] }))
      .then((j) => {
        setLeaves(j.leaves ?? []);
        setHolidays(j.holidays ?? []);
      });
  }, [month]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calendrier des absences</h1>
      <Card>
        <CardHeader>
          <CardTitle>Absences du mois {month}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {leaves.map((l) => (
            <div key={l.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{l.employeeName}</p>
              <p className="text-muted-foreground">
                {l.startDate} - {l.endDate} ({l.status})
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Jours feries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {holidays.map((h) => (
            <div key={h.id} className="rounded-lg border p-3 text-sm">
              {h.date} - {h.name}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
