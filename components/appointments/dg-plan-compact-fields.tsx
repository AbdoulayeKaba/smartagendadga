'use client';

import {
  FrenchDateField,
  FrenchTimeField,
} from '@/components/ui/french-datetime-fields';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SelectOption = {
  value: string;
  label: string;
};

type DateFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  min?: string;
  className?: string;
  isDateDisabled?: (date: Date) => boolean;
};

export function DgPlanCompactDateField({
  id,
  value,
  onChange,
  onBlur,
  min,
  className,
  isDateDisabled,
}: DateFieldProps) {
  return (
    <FrenchDateField
      id={id}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      min={min}
      className={className}
      variant="compact"
      displayPattern="dd/MM/yy"
      placeholder="…"
      isDateDisabled={isDateDisabled}
    />
  );
}

type TimeFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  minTime?: string;
  maxTime?: string;
  selectableAfter?: string;
  outOfRangeMode?: 'hide' | 'disable';
  className?: string;
};

export function DgPlanCompactTimeField({
  id,
  value,
  onChange,
  onBlur,
  minTime,
  maxTime,
  selectableAfter,
  outOfRangeMode,
  className,
}: TimeFieldProps) {
  return (
    <FrenchTimeField
      id={id}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      variant="compact"
      placeholder="…"
      minTime={minTime}
      maxTime={maxTime}
      selectableAfter={selectableAfter}
      outOfRangeMode={outOfRangeMode}
      className={className}
    />
  );
}

type CompactSelectProps = {
  id: string;
  value: string;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

export function DgPlanCompactSelect({
  id,
  value,
  options,
  placeholder = 'Sélectionner…',
  disabled,
  onChange,
  onBlur,
}: CompactSelectProps) {
  return (
    <Select
      disabled={disabled}
      value={dgPlanSelectValue(value)}
      onValueChange={(next) => {
        onChange(dgPlanSelectRaw(next));
        onBlur?.();
      }}
    >
      <SelectTrigger id={id} className="dg-plan-select dg-plan-picker-trigger w-full" size="sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="dg-plan-select-popover" position="popper" sideOffset={2}>
        {options.map((opt) => (
          <SelectItem
            key={opt.value || '__empty__'}
            value={dgPlanSelectValue(opt.value)}
            className="dg-plan-select-item"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Radix Select n’accepte pas value="" — convertit __empty__ ↔ chaîne vide. */
export function dgPlanSelectValue(raw: string): string {
  return raw || '__empty__';
}

export function dgPlanSelectRaw(value: string): string {
  return value === '__empty__' ? '' : value;
}
