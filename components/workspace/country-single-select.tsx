'use client';

import { useMemo, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CountryFlagImage } from '@/components/workspace/country-flag-image';
import {
  formatCountryLabel,
  getMissionCountry,
  matchesCountrySearch,
  MISSION_COUNTRIES,
} from '@/lib/workspace/mission-countries';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

export function CountrySingleSelect({
  value,
  onChange,
  disabled,
  placeholder = 'Choisir un pays…',
  id,
}: Props) {
  const code = value?.trim().toUpperCase() ?? '';
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return MISSION_COUNTRIES;
    return MISSION_COUNTRIES.filter((c) => matchesCountrySearch(c, q));
  }, [q]);

  const selected = code ? getMissionCountry(code) : undefined;
  const triggerText = selected ? formatCountryLabel(selected) : placeholder;

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQ('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="country-multi-select-trigger admin-field h-[1.75rem] min-h-[1.75rem] w-full min-w-0 justify-between gap-1 overflow-hidden px-2 py-0 font-normal shadow-none"
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-xs leading-none">
            {selected ? <CountryFlagImage code={selected.code} size="sm" /> : null}
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>{triggerText}</span>
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
              const active = country.code === code;
              return (
                <li key={country.code} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      'country-multi-select-option flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      active && 'country-multi-select-option--selected'
                    )}
                    onClick={() => pick(country.code)}
                  >
                    <CountryFlagImage code={country.code} size="md" />
                    <span className="country-multi-select-label">
                      {country.dialCode ? (
                        <span className="country-multi-select-dial">{country.dialCode}</span>
                      ) : null}
                      <span className="country-multi-select-name">{country.name}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
