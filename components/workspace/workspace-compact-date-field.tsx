'use client';

import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { cn } from '@/lib/utils';

type Props = {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  min?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function WorkspaceCompactDateField({
  id,
  value,
  onChange,
  min,
  disabled,
  placeholder = 'Choisir…',
}: Props) {
  return (
    <FrenchDateField
      id={id}
      value={value}
      onChange={onChange}
      min={min}
      disabled={disabled}
      placeholder={placeholder}
      variant="compact"
      className={cn(
        'workspace-crud-compact-date-trigger admin-field w-full justify-between gap-1 px-2 font-normal shadow-none text-xs'
      )}
    />
  );
}
