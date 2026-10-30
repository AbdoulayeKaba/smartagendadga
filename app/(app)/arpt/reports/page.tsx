import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ArptReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rapports</h1>
      <Card>
        <CardHeader>
          <CardTitle>Exports professionnels</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/api/arpt/reports/summary">Exporter Excel</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/arpt/requests">Impression PDF (via navigateur)</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
