'use client';

import { useMemo, useState } from 'react';
import { ChevronsUpDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CountryFlagImage } from '@/components/workspace/country-flag-image';
import {
  formatCountryLabel,
  formatMissionDestinations,
  getMissionCountry,
  matchesCountrySearch,
  MISSION_COUNTRIES,
} from '@/lib/workspace/mission-countries';

type Props = {
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function CountryMultiSelect({
  value,
  onChange,
  disabled,
  placeholder = 'Sélectionner un ou plusieurs pays…',
}: Props) {
  const codes = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return MISSION_COUNTRIES;
    return MISSION_COUNTRIES.filter((c) => matchesCountrySearch(c, q));
  }, [q]);

  const toggle = (code: string) => {
    onChange(
      codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]
    );
  };

  const remove = (code: string) => {
    onChange(codes.filter((c) => c !== code));
  };

  const triggerText =
    codes.length === 0
      ? placeholder
      : codes.length === 1
        ? (() => {
            const c = getMissionCountry(codes[0]);
            return c ? formatCountryLabel(c) : codes[0];
          })()
        : `${codes.length} pays sélectionnés`;

  return (
    <div className="country-multi-select min-w-0 space-y-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="country-multi-select-trigger admin-field h-[1.75rem] min-h-[1.75rem] w-full min-w-0 justify-between gap-1 overflow-hidden px-2 py-0 font-normal shadow-none"
            title={codes.length > 1 ? formatMissionDestinations(codes) : undefined}
          >
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-left text-xs leading-none',
                codes.length === 0 && 'text-muted-foreground'
              )}
            >
              {triggerText}
            </span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="admin-theme country-multi-select-popover w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0"
          align="start"
        >
          <div className="country-multi-select-search-bar border-b">
            <Input
              placeholder="Nom ou indicatif (+224)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="country-multi-select-search"
            />
          </div>
          <ul className="country-multi-select-list" role="listbox">
            {filtered.length === 0 ? (
              <li className="country-multi-select-empty">Aucun pays trouvé.</li>
            ) : (
              filtered.map((country) => {
                const checked = codes.includes(country.code);
                return (
                  <li key={country.code} role="presentation">
                    <div
                      role="option"
                      aria-selected={checked}
                      tabIndex={0}
                      className={cn(
                        'country-multi-select-option flex w-full cursor-pointer items-center rounded-md text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                        checked && 'country-multi-select-option--selected'
                      )}
                      onClick={() => toggle(country.code)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggle(country.code);
                        }
                      }}
                    >
                      <span
                        className="country-multi-select-check-wrap"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          className="country-multi-select-checkbox"
                          checked={checked}
                          tabIndex={-1}
                          aria-label={`Sélectionner ${country.name}`}
                          onCheckedChange={() => toggle(country.code)}
                        />
                      </span>
                      <CountryFlagImage code={country.code} size="md" />
                      <span className="country-multi-select-label">
                        {country.dialCode ? (
                          <span className="country-multi-select-dial">{country.dialCode}</span>
                        ) : null}
                        <span className="country-multi-select-name">{country.name}</span>
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      {codes.length > 0 ? (
        <div className="country-multi-select-badges flex flex-wrap gap-1">
          {codes.map((code) => {
            const c = getMissionCountry(code);
            return (
              <Badge key={code} variant="secondary" className="country-multi-select-badge gap-1 pr-0.5 font-normal">
                <CountryFlagImage code={code} size="sm" />
                <span>{c ? formatCountryLabel(c) : code}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Retirer ${c?.name ?? code}`}
                  onClick={() => remove(code)}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
