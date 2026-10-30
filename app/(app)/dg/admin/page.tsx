import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DG_ADMIN_NAV_ITEMS } from '@/lib/layout/dg-nav';

export default function AdminHubPage() {
  return (
    <div className="admin-theme space-y-6">
      <AdminPageHeader
        title="Administration"
        description="Gestion des comptes, des rôles, des référentiels et de la traçabilité."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DG_ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-sm transition-all hover:border-[var(--admin-primary)]/40 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--admin-hero-bg)] text-[var(--admin-primary)]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--admin-foreground)]">{item.label}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--admin-primary)]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
