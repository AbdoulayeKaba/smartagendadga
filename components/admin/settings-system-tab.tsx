'use client';

import { useMemo } from 'react';
import { ScheduleSettingsPanel } from '@/components/admin/schedule-settings-panel';
import type { PlatformConfig } from '@/lib/dg/platform-config';
import type { WeekdayKey } from '@/lib/dg/platform-config';
import { normalizeScheduleSettings } from '@/lib/services/referentials-admin';
import type { ScheduleSettings } from '@/lib/services/referentials-admin';

type Props = {
  settings: PlatformConfig;
  onChange: (s: PlatformConfig) => void;
};

function mergeScheduleIntoPlatform(
  settings: PlatformConfig,
  schedule: ScheduleSettings
): PlatformConfig {
  return { ...settings, ...schedule };
}

export function SettingsSystemTab({ settings, onChange }: Props) {
  const schedule = useMemo(() => normalizeScheduleSettings(settings), [settings]);

  const patchSchedule = (next: ScheduleSettings) => {
    onChange(mergeScheduleIntoPlatform(settings, next));
  };

  const toggleWeekday = (key: WeekdayKey) => {
    const set = new Set(schedule.workingDays ?? []);
    if (set.has(key)) {
      if (set.size <= 1) return;
      set.delete(key);
    } else {
      set.add(key);
    }
    patchSchedule({ ...schedule, workingDays: [...set] });
  };

  return (
    <div className="admin-settings-tab-content space-y-4">
      <ScheduleSettingsPanel
        schedule={schedule}
        onChange={patchSchedule}
        onToggleWeekday={toggleWeekday}
        showAside
        title="Horaires & créneaux"
        description="Définissez la plage d'ouverture du cabinet, la granularité des créneaux et les jours disponibles pour la prise de rendez-vous."
      />
    </div>
  );
}
