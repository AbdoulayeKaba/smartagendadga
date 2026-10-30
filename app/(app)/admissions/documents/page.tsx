'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTimeIntl } from '@/lib/datetime';
import { toast } from '@/hooks/use-toast';

type Doc = { id: string; fileName: string; fileUrl: string; uploadedAt: string };

export default function AdmissionDocumentsPage() {
  const { language } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Doc[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admissions/documents', { credentials: 'include' });
      const json = await res.json();
      if (res.ok) setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const upload = async () => {
    if (!fileName || !fileUrl) {
      toast({ variant: 'destructive', title: language === 'fr' ? 'Champs requis' : 'Required fields' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admissions/documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileUrl }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'UPLOAD_FAILED');
      setFileName('');
      setFileUrl('');
      await load();
      toast({ title: language === 'fr' ? 'Document enregistre' : 'Document uploaded' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: language === 'fr' ? 'Erreur upload' : 'Upload error',
        description: e instanceof Error ? e.message : '-',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents admission</h1>
        <p className="text-muted-foreground">UC 009-010 : televersement et telechargement des pieces.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau document</CardTitle>
          <CardDescription>Stockage par URL (S3, Drive securise, etc.).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label>Nom du fichier</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL du fichier</Label>
            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void upload()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Ajoute le</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.fileName}</TableCell>
                    <TableCell>{formatDateTimeIntl(d.uploadedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <a href={d.fileUrl} target="_blank" rel="noreferrer">
                          <Download className="mr-2 h-4 w-4" /> Telecharger
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
