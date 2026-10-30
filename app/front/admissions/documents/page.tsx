'use client';

import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export default function PublicAdmissionDocumentsPage() {
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [preRegistrationId, setPreRegistrationId] = useState('');

  const upload = async () => {
    if (!fileName || !fileUrl) {
      toast({ variant: 'destructive', title: 'Champs requis' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admissions/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileUrl,
          applicationId: applicationId || null,
          preRegistrationId: preRegistrationId || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'UPLOAD_FAILED');
      toast({ title: 'Document enregistre avec succes' });
      setFileName('');
      setFileUrl('');
      setApplicationId('');
      setPreRegistrationId('');
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erreur upload',
        description: e instanceof Error ? e.message : '-',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Depot de documents</h1>
        <p className="text-muted-foreground">Formulaire public pour ajouter les pieces justificatives.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nouveau document</CardTitle>
          <CardDescription>Renseignez votre URL de stockage securise et l'ID du dossier associe.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Nom du fichier *</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL du fichier *</Label>
            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>ID preinscription (optionnel)</Label>
              <Input value={preRegistrationId} onChange={(e) => setPreRegistrationId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ID candidature (optionnel)</Label>
              <Input value={applicationId} onChange={(e) => setApplicationId(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void upload()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Envoyer le document
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

