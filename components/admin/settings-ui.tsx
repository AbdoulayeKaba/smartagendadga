'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function SettingsCard({
  children,
  className,
  variant = 'default',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'flat';
}) {
  return (
    <section
      className={cn(
        'admin-settings-card',
        variant === 'flat' && 'admin-settings-card-flat',
        className
      )}
    >
      {children}
    </section>
  );
}

/** Titre de section léger (sans bandeau ni icône). */
export function SettingsSectionTitle({ title }: { title: string }) {
  return <h2 className="admin-settings-section-title">{title}</h2>;
}

export function SettingsCardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('admin-settings-card-body', className)}>{children}</div>;
}

export function SettingsField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('admin-settings-field', className)}>
      <Label htmlFor={htmlFor} className="admin-settings-label">
        {label}
      </Label>
      {children}
      {hint ? <p className="admin-settings-hint">{hint}</p> : null}
    </div>
  );
}

export function SettingsFieldGrid({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: 1 | 2;
}) {
  return (
    <div className={cn('admin-settings-field-grid', cols === 2 && 'admin-settings-field-grid-2')}>
      {children}
    </div>
  );
}

export function SettingsToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="admin-settings-toggle-card" data-active={checked}>
      <div className="flex items-start justify-between gap-3">
        <span className="admin-settings-toggle-card-icon">
          <Icon className="h-4 w-4" />
        </span>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="admin-settings-switch shrink-0"
        />
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--admin-foreground)]">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function SettingsToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="admin-settings-toggle-row">
      <div className="min-w-0 flex-1">
        <p className="admin-settings-toggle-title">{title}</p>
        {description ? (
          <p className="admin-settings-toggle-desc">{description}</p>
        ) : null}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="admin-settings-switch shrink-0"
      />
    </div>
  );
}

export function SettingsBanner({
  variant,
  title,
  description,
}: {
  variant: 'success' | 'warning' | 'info' | 'orange';
  title: string;
  description?: string;
}) {
  return (
    <div className="admin-settings-banner" data-variant={variant}>
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-0.5 text-xs opacity-90">{description}</p> : null}
    </div>
  );
}

export function SettingsDivider() {
  return <hr className="admin-settings-divider" />;
}

export function SettingsTestRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-settings-test-row">
      <p className="admin-settings-test-label">{label}</p>
      {children}
    </div>
  );
}
