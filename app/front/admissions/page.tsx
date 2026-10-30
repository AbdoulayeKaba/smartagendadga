import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PublicAdmissionsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Admissions ESMT</h1>
        <p className="text-muted-foreground">Choisissez l’action souhaitee pour demarrer votre parcours d’admission.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Preinscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Premiere etape pour enregistrer votre intention de candidature.</p>
            <Button asChild>
              <Link href="/front/admissions/preregistration">Faire une preinscription</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Candidature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Soumettez votre dossier complet (etudiant ou professeur).</p>
            <Button asChild>
              <Link href="/front/admissions/candidature">Faire une candidature</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Televersez et consultez les pieces de votre dossier.</p>
            <Button asChild>
              <Link href="/front/admissions/documents">Gerer les documents</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

