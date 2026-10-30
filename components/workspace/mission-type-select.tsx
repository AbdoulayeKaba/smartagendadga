'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  MISSION_TYPE_OPTIONS,
  MISSION_TYPE_OTHER_VALUE,
} from '@/lib/workspace/mission-types';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
};

function displayValue(value: string, placeholder: string): string {
  if (!value) return placeholder;
  if (value === MISSION_TYPE_OTHER_VALUE) return 'Autre (préciser)';
  return value;
}

export function MissionTypeSelect({
  value,
  onChange,
  disabled,
  id,
  placeholder = 'Choisir un type…',
}: Props) {
  const [open, setOpen] = useState(false);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
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
          className="mission-type-select-trigger admin-field h-[1.75rem] min-h-[1.75rem] w-full min-w-0 justify-between gap-1 overflow-hidden px-2 py-0 text-xs font-normal shadow-none"
        >
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-left leading-none',
              !value && 'text-muted-foreground'
            )}
          >
            {displayValue(value, placeholder)}
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="admin-theme mission-type-select-popover w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <ul className="mission-type-select-list" role="listbox" aria-label="Types de mission">
          {MISSION_TYPE_OPTIONS.map((type) => {
            const selected = value === type;
            return (
              <li key={type} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'mission-type-select-option',
                    selected && 'mission-type-select-option--selected'
                  )}
                  onClick={() => pick(type)}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{type}</span>
                  {selected ? <Check className="mission-type-select-check" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mission-type-select-other-wrap">
          <button
            type="button"
            role="option"
            aria-selected={value === MISSION_TYPE_OTHER_VALUE}
            className={cn(
              'mission-type-select-option mission-type-select-other',
              value === MISSION_TYPE_OTHER_VALUE && 'mission-type-select-option--selected'
            )}
            onClick={() => pick(MISSION_TYPE_OTHER_VALUE)}
          >
            <span className="min-w-0 flex-1 truncate text-left">Autre (préciser)</span>
            {value === MISSION_TYPE_OTHER_VALUE ? (
              <Check className="mission-type-select-check" aria-hidden />
            ) : null}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
