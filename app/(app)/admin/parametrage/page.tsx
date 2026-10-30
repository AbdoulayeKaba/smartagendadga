'use client';

import Link from 'next/link';
import { Users, CalendarDays, Palmtree, MapPin } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ParametrageHomePage() {
  const { t } = useApp();

  const links = [
    {
      href: '/admin/parametrage/employes',
      title: t('settings.cardEmployeesTitle'),
      desc: t('settings.cardEmployeesDesc'),
      icon: Users,
    },
    {
      href: '/admin/parametrage/jours-feries',
      title: t('settings.cardHolidaysTitle'),
      desc: t('settings.cardHolidaysDesc'),
      icon: CalendarDays,
    },
    {
      href: '/admin/parametrage/conges',
      title: t('settings.cardLeavesTitle'),
      desc: t('settings.cardLeavesDesc'),
      icon: Palmtree,
    },
    {
      href: '/admin/lieux',
      title: t('settings.cardLocationsTitle'),
      desc: t('settings.cardLocationsDesc'),
      icon: MapPin,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.hubTitle')}</h1>
        <p className="text-muted-foreground">{t('settings.hubSubtitle')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map(({ href, title, desc, icon: Icon }) => (
          <Link key={href} href={href} className="block transition-opacity hover:opacity-90">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription>{desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
