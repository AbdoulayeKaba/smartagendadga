'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { FlaskConical, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FrenchDateField, FrenchTimeField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  BUSINESS_RULE_CATALOG,
  URGENCY_LEVEL_OPTIONS,
  type AppointmentBusinessRules,
  type BusinessRuleId,
} from '@/lib/dg/appointment-business-rules';
import { toast } from '@/hooks/use-toast';
import { scheduleSettingsToPlanningBounds } from '@/lib/dg/planning-time-slots';
import type { ScheduleSettings } from '@/lib/services/referentials-admin';
import { cn } from '@/lib/utils';

export type AppointmentConstraintsVariant = 'default' | 'referentials';

export const REFERENTIALS_HIDDEN_RULE_IDS: readonly BusinessRuleId[] = [
  'minSubmissionLead',
  'maxPendingPerEmployee',
  'standardizedDuration',
  'maxPerMonth',
  'allowedSlotsOnly',
] as const;

export const ALWAYS_HIDDEN_RULE_IDS: readonly BusinessRuleId[] = ['standardizedDuration'] as const;

export function getVisibleRuleCatalog(variant: AppointmentConstraintsVariant = 'default') {
  if (variant === 'default') return BUSINESS_RULE_CATALOG;
  return BUSINESS_RULE_CATALOG.filter((c) => !REFERENTIALS_HIDDEN_RULE_IDS.includes(c.id));
}

export function getConstraintsPreviewSummary(
  rules: AppointmentBusinessRules,
  variant: AppointmentConstraintsVariant = 'default'
) {
  const catalog = getVisibleRuleCatalog(variant);
  const active = catalog.filter((c) => rules[c.id].enabled).length;
  return { active, total: catalog.length };
}

export function getConstraintsPreviewLines(
  rules: AppointmentBusinessRules,
  variant: AppointmentConstraintsVariant = 'default'
): { label: string; detail: string }[] {
  return getVisibleRuleCatalog(variant)
    .filter((c) => rules[c.id].enabled)
    .map((c, index) => {
    const r = rules[c.id];
    let detail = 'Activée';
    if (c.id === 'minSubmissionLead' && 'minHours' in r) {
      detail = `${r.minHours} h${r.minDays > 0 ? ` · ${r.minDays} j` : ''} avant le créneau`;
    } else if (c.id === 'maxPendingPerEmployee' && 'maxCount' in r) {
      detail = `Max ${r.maxCount} demande(s) en attente`;
    } else if (c.id === 'duplicateControl') {
      detail = 'Même demandeur, objet et période';
    } else if (c.id === 'urgencyJustification' && 'minChars' in r) {
      detail = `Min ${r.minChars} car. (urgent / très urgent / critique)`;
    }
    return { label: `${index + 1}. ${c.title}`, detail };
  });
}

function RuleCard({
  ruleNumber,
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  ruleNumber: number;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <section
      className="rounded-xl border border-[var(--admin-border)] bg-card p-4 shadow-[0_1px_3px_oklch(0_0_0/0.04)]"
      id={`rule-${ruleNumber}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-md bg-[var(--admin-hero-bg)] px-1.5 text-[11px] font-bold tabular-nums text-[var(--admin-primary)]">
              R{ruleNumber}
            </span>
            <h3 className="text-sm font-semibold text-[var(--admin-foreground)]">{title}</h3>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label className="text-xs text-muted-foreground">{enabled ? 'Activée' : 'Désactivée'}</Label>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
      </div>
      {enabled && children ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div> : null}
    </section>
  );
}

export type AppointmentConstraintsFieldsProps = {
  rules: AppointmentBusinessRules;
  onChange: (next: AppointmentBusinessRules) => void;
  showIntro?: boolean;
  variant?: AppointmentConstraintsVariant;
};

export function AppointmentConstraintsFields({
  rules,
  onChange,
  showIntro = true,
  variant = 'default',
}: AppointmentConstraintsFieldsProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    violations: { message: string }[];
    warnings: { message: string }[];
    priorityScore: number;
  } | null>(null);
  const [testForm, setTestForm] = useState({
    title: 'Présentation projet stratégique',
    date: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '10:30',
    urgencyLevel: 'URGENT' as const,
    justification: '',
  });

  const patch = <K extends keyof AppointmentBusinessRules>(
    key: K,
    value: Partial<AppointmentBusinessRules[K]>
  ) => {
    onChange({ ...rules, [key]: { ...rules[key], ...value } });
  };

  const visibleCatalog = useMemo(() => getVisibleRuleCatalog(variant), [variant]);

  const catalogIndex = (id: BusinessRuleId) => visibleCatalog.findIndex((c) => c.id === id) + 1;

  const showRule = (id: BusinessRuleId) =>
    !ALWAYS_HIDDEN_RULE_IDS.includes(id) &&
    (variant === 'default' || !REFERENTIALS_HIDDEN_RULE_IDS.includes(id));

  const runTest = async () => {
    if (!testForm.title.trim() || !testForm.date) {
      toast({ variant: 'destructive', title: 'Objet et date requis pour le test.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/appointment-constraints/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testForm,
          requesterRole: 'MANAGER',
          preContact: [],
        }),
      });
      const text = await res.text();
      let data: typeof testResult & { error?: string; message?: string } = null;
      if (text) {
        try {
          data = JSON.parse(text) as typeof testResult & { error?: string; message?: string };
        } catch {
          data = null;
        }
      }
      if (
        !res.ok ||
        !data ||
        (typeof data === 'object' && data !== null && 'error' in data && !('ok' in data))
      ) {
        const errBody = data as { message?: string; error?: string } | null;
        toast({
          variant: 'destructive',
          title: 'Test impossible',
          description:
            errBody?.message ||
            errBody?.error ||
            `Erreur serveur (${res.status})`,
        });
        return;
      }
      setTestResult(data as NonNullable<typeof testResult>);
    } catch {
      toast({ variant: 'destructive', title: 'Erreur réseau lors du test.' });
    } finally {
      setTesting(false);
    }
  };

  const enabledCount = useMemo(
    () => visibleCatalog.filter((c) => rules[c.id].enabled).length,
    [rules, visibleCatalog]
  );

  const cat = (id: (typeof BUSINESS_RULE_CATALOG)[number]['id']) =>
    BUSINESS_RULE_CATALOG.find((c) => c.id === id)!;

  return (
    <div className="space-y-4">
      {showIntro ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-hero-bg)]/40 px-4 py-3">
          <p className="text-sm font-medium text-[var(--admin-foreground)]">
            Paramétrage assistante de direction — {enabledCount} / {visibleCatalog.length} règles
            actives
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Toutes les contraintes ci-dessous filtrent et valident automatiquement les demandes de
            rendez-vous. Le tableau de bord assistante trie les demandes selon le score de priorité
            .
          </p>
        </div>
      ) : null}

      {showRule('minSubmissionLead') ? (
      <RuleCard
        ruleNumber={catalogIndex('minSubmissionLead')}
        title={cat('minSubmissionLead').title}
        description={cat('minSubmissionLead').description}
        enabled={rules.minSubmissionLead.enabled}
        onToggle={(v) => patch('minSubmissionLead', { enabled: v })}
      >
        <div>
          <Label>Heures minimum avant le créneau</Label>
          <Input
            type="number"
            min={0}
            className="admin-field mt-1"
            value={rules.minSubmissionLead.minHours}
            onChange={(e) => patch('minSubmissionLead', { minHours: Number(e.target.value) || 0 })}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Ex. 24 h → message : « Le délai minimum de soumission est de 24 heures. »
          </p>
        </div>
        <div>
          <Label>Jours minimum avant le créneau</Label>
          <Input
            type="number"
            min={0}
            className="admin-field mt-1"
            value={rules.minSubmissionLead.minDays}
            onChange={(e) => patch('minSubmissionLead', { minDays: Number(e.target.value) || 0 })}
          />
        </div>
      </RuleCard>
      ) : null}

      {showRule('maxPendingPerEmployee') ? (
      <RuleCard
        ruleNumber={catalogIndex('maxPendingPerEmployee')}
        title={cat('maxPendingPerEmployee').title}
        description={cat('maxPendingPerEmployee').description}
        enabled={rules.maxPendingPerEmployee.enabled}
        onToggle={(v) => patch('maxPendingPerEmployee', { enabled: v })}
      >
        <div>
          <Label>Maximum de demandes en attente par employé</Label>
          <Input
            type="number"
            min={1}
            className="admin-field mt-1"
            value={rules.maxPendingPerEmployee.maxCount}
            onChange={(e) =>
              patch('maxPendingPerEmployee', { maxCount: Number(e.target.value) || 1 })
            }
          />
        </div>
      </RuleCard>
      ) : null}

      {/* Règle 3 */}
      <RuleCard
        ruleNumber={catalogIndex('duplicateControl')}
        title={cat('duplicateControl').title}
        description={cat('duplicateControl').description}
        enabled={rules.duplicateControl.enabled}
        onToggle={(v) => patch('duplicateControl', { enabled: v })}
      >
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          Détecte : même demandeur, même objet, même période. Message : « Une demande similaire existe
          déjà. »
        </p>
      </RuleCard>

      {/* Règle 4 */}
      <RuleCard
        ruleNumber={catalogIndex('urgencyJustification')}
        title={cat('urgencyJustification').title}
        description={cat('urgencyJustification').description}
        enabled={rules.urgencyJustification.enabled}
        onToggle={(v) => patch('urgencyJustification', { enabled: v })}
      >
        <div>
          <Label>Caractères minimum (justification)</Label>
          <Input
            type="number"
            min={10}
            className="admin-field mt-1"
            value={rules.urgencyJustification.minChars}
            onChange={(e) =>
              patch('urgencyJustification', { minChars: Number(e.target.value) || 50 })
            }
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Niveaux d&apos;urgence concernés</Label>
          <div className="mt-2 flex flex-wrap gap-3">
            {URGENCY_LEVEL_OPTIONS.filter((o) => o.value !== 'NORMAL').map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rules.urgencyJustification.levels.includes(o.value)}
                  onChange={(e) => {
                    const levels = e.target.checked
                      ? [...rules.urgencyJustification.levels, o.value]
                      : rules.urgencyJustification.levels.filter((l) => l !== o.value);
                    patch('urgencyJustification', { levels });
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      </RuleCard>

      {showRule('maxPerMonth') ? (
        <RuleCard
          ruleNumber={catalogIndex('maxPerMonth')}
          title={cat('maxPerMonth').title}
          description={cat('maxPerMonth').description}
          enabled={rules.maxPerMonth.enabled}
          onToggle={(v) => patch('maxPerMonth', { enabled: v })}
        >
          <div>
            <Label>Nombre maximal de rendez-vous</Label>
            <Input
              type="number"
              min={1}
              className="admin-field mt-1"
              value={rules.maxPerMonth.maxCount}
              onChange={(e) => patch('maxPerMonth', { maxCount: Number(e.target.value) || 1 })}
            />
          </div>
          <div>
            <Label>Période glissante (jours)</Label>
            <Input
              type="number"
              min={1}
              className="admin-field mt-1"
              value={rules.maxPerMonth.periodDays}
              onChange={(e) => patch('maxPerMonth', { periodDays: Number(e.target.value) || 30 })}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Ex. 5 rendez-vous par mois (30 jours).</p>
          </div>
        </RuleCard>
      ) : null}

      {showRule('allowedSlotsOnly') ? (
        <RuleCard
          ruleNumber={catalogIndex('allowedSlotsOnly')}
          title={cat('allowedSlotsOnly').title}
          description={cat('allowedSlotsOnly').description}
          enabled={rules.allowedSlotsOnly.enabled}
          onToggle={(v) => patch('allowedSlotsOnly', { enabled: v })}
        >
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Lie les sections horaires, jours ouvrables et plafonds aux indisponibilités et à
            l&apos;agenda du DGA. L&apos;employé ne peut pas choisir un créneau bloqué.
          </p>
        </RuleCard>
      ) : null}

      {variant === 'default' ? (
      <section className="rounded-xl border border-dashed border-[var(--admin-primary)]/40 bg-[var(--admin-hero-bg)]/30 p-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-[var(--admin-primary)]" />
          <h3 className="font-semibold text-[var(--admin-foreground)]">Tester les règles (assistante)</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Simulez une demande fictive avec la configuration actuelle. Enregistrez d&apos;abord avec le
          bouton Enregistrer.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Objet de la demande</Label>
            <Input
              className="admin-field mt-1"
              value={testForm.title}
              onChange={(e) => setTestForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>Date souhaitée</Label>
            <FrenchDateField
              className="admin-field mt-1"
              value={testForm.date}
              onChange={(date) => setTestForm((f) => ({ ...f, date }))}
            />
          </div>
          <div>
            <Label>Niveau d&apos;urgence</Label>
            <select
              className="admin-field mt-1 h-10 w-full rounded-lg border px-3 text-sm"
              value={testForm.urgencyLevel}
              onChange={(e) =>
                setTestForm((f) => ({
                  ...f,
                  urgencyLevel: e.target.value as typeof f.urgencyLevel,
                }))
              }
            >
              {URGENCY_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Heure de début</Label>
            <FrenchTimeField
              className="admin-field mt-1"
              value={testForm.startTime}
              onChange={(startTime) => setTestForm((f) => ({ ...f, startTime }))}
            />
          </div>
          <div>
            <Label>Heure de fin</Label>
            <FrenchTimeField
              className="admin-field mt-1"
              value={testForm.endTime}
              onChange={(endTime) => setTestForm((f) => ({ ...f, endTime }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Justification (si urgence)</Label>
            <Input
              className="admin-field mt-1"
              value={testForm.justification}
              onChange={(e) => setTestForm((f) => ({ ...f, justification: e.target.value }))}
            />
          </div>
        </div>
        <Button type="button" className="mt-4 gap-2" onClick={() => void runTest()} disabled={testing}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          Lancer le test
        </Button>
        {testResult ? (
          <div
            className={cn(
              'mt-4 rounded-lg border p-3 text-sm',
              testResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            )}
          >
            <p className="font-semibold">
              {testResult.ok ? 'Demande acceptée' : 'Demande bloquée automatiquement'}
            </p>
            {testResult.violations.map((v, i) => (
              <p key={i} className="mt-1">
                • {v.message}
              </p>
            ))}
            {testResult.warnings.map((w, i) => (
              <p key={i} className="mt-1 text-amber-800">
                ⚠ {w.message}
              </p>
            ))}
          </div>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}
