import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { submitLeaveRequestAction } from './actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ApprovalButtons } from './ui-approval-buttons';
import { ArptLeaveDateFields } from './leave-date-fields';

export default async function ArptRequestsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const leaveTypes = await prisma.$queryRaw<Array<{ id: string; label: string }>>`
    SELECT id, label FROM leave_type_configs WHERE is_active = true ORDER BY label ASC
  `;
  const requests = await prisma.$queryRaw<
    Array<{
      id: string;
      employeeName: string;
      leaveType: string | null;
      startDate: string;
      endDate: string;
      status: string;
      workingDays: number;
    }>
  >`
    SELECT l.id,
           CONCAT(e.prenom, ' ', e.nom) AS employeeName,
           t.label AS leaveType,
           l.start_date AS startDate,
           l.end_date AS endDate,
           l.status,
           l.working_days AS workingDays
    FROM employee_leaves l
    INNER JOIN employees e ON e.id = l.employee_id
    LEFT JOIN leave_type_configs t ON t.id = l.leave_type_id
    ORDER BY l.created_at DESC
    LIMIT 100
  `;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Demandes de conges</h1>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle demande (Server Action)</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={submitLeaveRequestAction} className="grid gap-3 md:grid-cols-2">
            <select
              name="leaveTypeId"
              className="h-10 rounded-md border bg-background px-3 text-sm"
              defaultValue={leaveTypes[0]?.id}
            >
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <ArptLeaveDateFields />
            <div className="md:col-span-2">
              <Textarea name="note" placeholder="Motif de la demande..." />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Soumettre la demande</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow de validation multi-niveaux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{r.employeeName}</p>
                <p className="text-sm text-muted-foreground">
                  {r.leaveType ?? 'Type non defini'} - {r.startDate} au {r.endDate} ({r.workingDays} j ouvrables)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                  {r.status}
                </Badge>
                <ApprovalButtons leaveId={r.id} disabled={r.status !== 'submitted'} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
