'use client';

import { Switch } from '@/components/ui/switch';

type Props = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** Label + interrupteur sur une seule ligne (modales admin). */
export function AdminDialogToggle({ id, label, checked, onCheckedChange }: Props) {
  const labelId = `${id}-label`;

  return (
    <div className="flex w-full flex-row flex-nowrap items-center justify-between gap-4">
      <span id={labelId} className="shrink-0 text-sm font-medium text-foreground">
        {label}
      </span>
      <Switch
        id={id}
        aria-labelledby={labelId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="admin-dialog-switch shrink-0"
      />
    </div>
  );
}
