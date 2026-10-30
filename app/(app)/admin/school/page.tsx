import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const cards = [
  { title: 'Eleves', desc: 'Dossiers eleves, classe et statut.', href: '/admin/school/students' },
  { title: 'Professeurs', desc: 'Corps enseignant et specialites.', href: '/admin/school/teachers' },
  { title: 'Parents', desc: 'Contacts parents/tuteurs.', href: '/admin/school/parents' },
  { title: 'Salles et classes', desc: 'Capacite, niveau, section.', href: '/admin/school/classrooms' },
  { title: 'Structure academique', desc: 'Annees academiques et matieres.', href: '/admin/school/academics' },
  { title: 'Affectations', desc: 'Professeurs + matieres + classes.', href: '/admin/school/assignments' },
  { title: 'Operations pedagogiques', desc: 'Emploi du temps, notes et absences.', href: '/admin/school/timetable' },
  { title: 'Analytics & KPI', desc: 'Taux de reussite, assiduite et volume academique.', href: '/admin/school/analytics' },
  { title: 'Bulletins', desc: 'Moyennes par matiere et impression bulletin.', href: '/admin/school/bulletins' },
];

export default function SchoolAdminHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestion scolaire</h1>
        <p className="text-muted-foreground">Administration complete des entites de l'ecole.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.href}>
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
              <CardDescription>{c.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={c.href}>Ouvrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
