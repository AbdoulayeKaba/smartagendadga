'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cloud, Network, RefreshCw, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import type { AdDirectoryUser, AdImportSource } from '@/lib/dg/ldap-config';
import type { PlatformConfig } from '@/lib/dg/platform-config';

type Props = {
  onImported: () => void;
};

export function AdImportPanel({ onImported }: Props) {
  const [source, setSource] = useState<AdImportSource>('graph');
  const [bindPassword, setBindPassword] = useState('');
  const [ldapSettings, setLdapSettings] = useState<Pick<
    PlatformConfig,
    'ldapUrl' | 'ldapBindDn' | 'ldapBaseDn' | 'ldapUserFilter' | 'ldapDefaultRole'
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<AdDirectoryUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/admin/settings');
    if (!res.ok) return;
    const j = (await res.json()) as { settings: PlatformConfig };
    const s = j.settings;
    setSource(s.adImportSource ?? 'graph');
    setLdapSettings({
      ldapUrl: s.ldapUrl,
      ldapBindDn: s.ldapBindDn,
      ldapBaseDn: s.ldapBaseDn,
      ldapUserFilter: s.ldapUserFilter,
      ldapDefaultRole: s.ldapDefaultRole,
    });
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const body = () => {
    if (source === 'ldap' && bindPassword.trim()) {
      return { source, ldap: { bindPassword: bindPassword.trim() } };
    }
    return { source };
  };

  const errorLabel = (code: string) => {
    const map: Record<string, string> = {
      GRAPH_NOT_CONFIGURED:
        'Microsoft Graph non configuré (AZURE_AD_* ou GRAPH_* dans .env + permission User.Read.All).',
      GRAPH_FETCH_FAILED: 'Échec lecture annuaire Entra ID — vérifiez les permissions application.',
      LDAP_INCOMPLETE_CONFIG:
        'Configuration LDAP incomplète. Renseignez URL, Bind DN et Base DN dans Paramètres → Intégrations, puis le mot de passe ici ou LDAP_BIND_PASSWORD dans .env.',
      LDAP_MODULE_MISSING: 'Installez ldapts : npm install ldapts',
    };
    return map[code] ?? code;
  };

  const runTest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/ad/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Connexion échouée', description: errorLabel(j.error) });
        return;
      }
      toast({
        title: 'Connexion réussie',
        description: `${j.count} compte(s) trouvé(s) (${j.source === 'graph' ? 'Entra ID' : 'LDAP'}).`,
      });
    } finally {
      setLoading(false);
    }
  };

  const runPreview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/ad/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Prévisualisation échouée', description: errorLabel(j.error) });
        return;
      }
      const users = (j.users ?? []) as AdDirectoryUser[];
      setPreview(users);
      setSelected(new Set(users.filter((u) => !u.alreadyExists).map((u) => u.email)));
      toast({ title: `${users.length} utilisateur(s) dans l'annuaire` });
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    const emails = [...selected];
    if (emails.length === 0) {
      toast({ variant: 'destructive', title: 'Sélectionnez au moins un utilisateur.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/ad/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, users: preview }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Import échoué', description: j.error });
        return;
      }
      toast({
        title: 'Import terminé',
        description: `${j.created} créé(s), ${j.errors?.length ?? 0} erreur(s).`,
      });
      onImported();
      await runPreview();
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(preview.filter((u) => !u.alreadyExists).map((u) => u.email)));
  };

  const toggleOne = (email: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(email);
    else next.delete(email);
    setSelected(next);
  };

  return (
    <Card className="admin-ad-import-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="h-4 w-4 text-primary" aria-hidden />
          Import Active Directory / LDAP
        </CardTitle>
        <CardDescription className="text-xs">
          Synchronisez depuis <strong>Microsoft Entra ID</strong> ou un annuaire <strong>LDAP</strong>.
          La configuration LDAP se fait dans <strong>Paramètres → Intégrations</strong>. Rôles DGA /
          Assistante via <span className="font-mono">AZURE_DG_EMAILS</span> et{' '}
          <span className="font-mono">AZURE_ASSISTANT_EMAILS</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Source annuaire</Label>
            <Select value={source} onValueChange={(v) => setSource(v as AdImportSource)}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="graph">
                  <span className="flex items-center gap-2">
                    <Cloud className="h-3 w-3" /> Microsoft Entra ID (Graph)
                  </span>
                </SelectItem>
                <SelectItem value="ldap">
                  <span className="flex items-center gap-2">
                    <Network className="h-3 w-3" /> LDAP / AD on-premise
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void runTest()}>
              Tester la connexion
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void runPreview()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Prévisualiser
            </Button>
            <Button type="button" size="sm" disabled={loading || selected.size === 0} onClick={() => void runImport()}>
              <UserCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Importer ({selected.size})
            </Button>
          </div>
        </div>

        {source === 'ldap' ? (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            {ldapSettings ? (
              <dl className="grid gap-1.5 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-muted-foreground">URL</dt>
                  <dd className="font-mono">{ldapSettings.ldapUrl}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Rôle par défaut</dt>
                  <dd>{ldapSettings.ldapDefaultRole}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-muted-foreground">Bind DN</dt>
                  <dd className="font-mono break-all">{ldapSettings.ldapBindDn}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="font-semibold text-muted-foreground">Base DN</dt>
                  <dd className="font-mono break-all">{ldapSettings.ldapBaseDn}</dd>
                </div>
              </dl>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="ldap-bind-password" className="text-xs">
                Mot de passe de liaison
              </Label>
              <Input
                id="ldap-bind-password"
                type="password"
                className="h-8 max-w-sm text-xs"
                placeholder="Ou variable LDAP_BIND_PASSWORD dans .env"
                value={bindPassword}
                onChange={(e) => setBindPassword(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Configurez <span className="font-mono">GRAPH_CLIENT_ID</span>,{' '}
            <span className="font-mono">GRAPH_CLIENT_SECRET</span>,{' '}
            <span className="font-mono">GRAPH_TENANT_ID</span> et la permission{' '}
            <strong>User.Read.All</strong>.
          </p>
        )}

        {preview.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-ad"
                checked={selected.size > 0 && selected.size === preview.filter((u) => !u.alreadyExists).length}
                onCheckedChange={(c) => toggleAll(Boolean(c))}
              />
              <Label htmlFor="select-all-ad" className="text-xs font-normal">
                Tout sélectionner (nouveaux comptes)
              </Label>
            </div>
            <div className="max-h-56 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((u) => (
                    <TableRow key={u.externalId}>
                      <TableCell>
                        <Checkbox
                          disabled={u.alreadyExists}
                          checked={selected.has(u.email)}
                          onCheckedChange={(c) => toggleOne(u.email, Boolean(c))}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        {u.firstName} {u.lastName}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[0.625rem]">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.alreadyExists ? (
                          <Badge variant="secondary" className="text-[0.625rem]">
                            Déjà en base
                          </Badge>
                        ) : (
                          <Badge className="text-[0.625rem]">Nouveau</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
