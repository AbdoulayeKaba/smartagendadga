'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Loader2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AppointmentPlanningPanel } from '@/components/dg/appointment-planning-panel';
import { useAppOptional } from '@/lib/app-context';
import type { PlanningInitial } from '@/lib/dg/appointment-planning';
import { homePathForPermissions } from '@/lib/dg/role-access';
import { isExternalWorkspace } from '@/lib/layout/external-space';
import { cn } from '@/lib/utils';

function useAppointmentsBackLink() {
  const app = useAppOptional();
  const permissions = app?.permissions;

  return useMemo(() => {
    if (!permissions) return null;
    if (permissions['appointments.review'] || permissions['menu.plan']) {
      return { href: '/dg/appointments', label: 'Liste des rendez-vous' };
    }
    return null;
  }, [permissions]);
}

function PlanContent() {
  const backLink = useAppointmentsBackLink();
  const app = useAppOptional();
  const external = isExternalWorkspace(app?.roleId, app?.dgRole);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  const canPlan = app?.permissions['menu.plan'] === true;

  useEffect(() => {
    if (!app || canPlan) return;
    router.replace(homePathForPermissions(app.permissions));
  }, [app, canPlan, router]);

  const [initial, setInitial] = useState<PlanningInitial | undefined>();
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editId));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (editId) {
      setLoadingEdit(true);
      setLoadError(null);
      void fetch(`/api/appointments/${editId}`)
        .then((r) => {
          if (!r.ok) throw new Error('NOT_FOUND');
          return r.json();
        })
        .then((j) => {
          if (j?.initial) {
            setInitial({ ...(j.initial as PlanningInitial), editId: editId ?? (j.initial as PlanningInitial).editId });
          } else throw new Error('INVALID');
        })
        .catch(() => setLoadError('Impossible de charger ce rendez-vous pour modification.'))
        .finally(() => setLoadingEdit(false));
      return;
    }

    setInitial({
      date: searchParams.get('date') ?? undefined,
      startTime: searchParams.get('startTime') ?? undefined,
      endTime: searchParams.get('endTime') ?? undefined,
      title: searchParams.get('title') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      location: searchParams.get('location') ?? undefined,
    });
  }, [editId, searchParams]);

  const isEditMode = Boolean(editId);

  if (app && !canPlan) return null;

  return (
    <div className="space-y-2">
      <AdminPageHeader
        variant="flat"
        eyebrow={external ? undefined : 'DGA'}
        title={isEditMode ? 'Modifier un rendez-vous' : 'Planifier un rendez-vous'}
        description={
          isEditMode
            ? 'Mettez à jour les informations puis enregistrez.'
            : external
              ? 'Soumettez une demande de rendez-vous pour validation par l’assistante.'
              : 'En attente jusqu’à validation par l’assistante.'
        }
        mark={
          external && !isEditMode ? (
            <span className="ext-plan-mark" aria-hidden>
              <CalendarDays className="h-4 w-4" />
            </span>
          ) : undefined
        }
        actions={
          backLink ? (
            <Link
              href={backLink.href}
              className={cn(
                'admin-appt-filter-btn admin-appt-header-btn admin-appt-header-btn--secondary',
                external && 'ext-plan-back'
              )}
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              {backLink.label}
            </Link>
          ) : null
        }
      />
      {loadingEdit ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Chargement du rendez-vous…
        </div>
      ) : loadError ? (
        <p className="p-4 text-sm text-destructive">{loadError}</p>
      ) : initial ? (
        external ? (
          <AppointmentPlanningPanel
            compact
            layout="external"
            initial={initial}
            onSuccess={() => {
              if (backLink) router.push(backLink.href);
            }}
          />
        ) : (
          <AppointmentPlanningPanel
            compact
            initial={initial}
            onSuccess={() => {
              if (backLink) router.push(backLink.href);
            }}
          />
        )
      ) : null}
    </div>
  );
}

export default function DgPlanPage() {
  const app = useAppOptional();
  const external = isExternalWorkspace(app?.roleId, app?.dgRole);
  return (
    <div
      className={cn(
        'app-page admin-theme dg-plan-page dg-plan-page--compact mx-auto w-full',
        external ? 'ext-plan-page max-w-none' : 'max-w-5xl'
      )}
    >
      <Suspense fallback={null}>
        <PlanContent />
      </Suspense>
    </div>
  );
}
