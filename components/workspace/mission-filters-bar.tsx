'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Calendar, FileSpreadsheet, RotateCcw, Signal, Tag } from 'lucide-react';
import { FrenchDateField } from '@/components/ui/french-datetime-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCountryLabel, getMissionCountry } from '@/lib/workspace/mission-countries';
import {
  EMPTY_MISSION_FILTERS,
  hasActiveMissionFilters,
  type MissionListFilters,
  type MissionStatusFilter,
} from '@/lib/workspace/mission-filters';
import { MISSION_VISUAL_LABELS } from '@/lib/workspace/mission-visual-state';
import { cn } from '@/lib/utils';

const STATUS_FILTER_OPTIONS: { value: MissionStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Tous statuts' },
  { value: 'PLANNED', label: MISSION_VISUAL_LABELS.PLANNED },
  { value: 'DEPART_TODAY', label: MISSION_VISUAL_LABELS.DEPART_TODAY },
  { value: 'ONGOING', label: MISSION_VISUAL_LABELS.ONGOING },
  { value: 'COMPLETED', label: MISSION_VISUAL_LABELS.COMPLETED },
  { value: 'CANCELLED', label: MISSION_VISUAL_LABELS.CANCELLED },
];

type Props = {
  filters: MissionListFilters;
  onChange: (filters: MissionListFilters) => void;
  typeOptions: string[];
  destinationOptions: string[];
  showImport?: boolean;
  onImportClick?: () => void;
};

function FilterIconButton({
  className,
  active,
  label,
  children,
  ...props
}: ComponentProps<'button'> & {
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className={cn('workspace-mission-filter-icon-btn', active && 'is-active', className)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

function FilterPopoverPanel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <PopoverContent
      className={cn('workspace-mission-filter-popover border-[var(--admin-border)]', className)}
      align="end"
      sideOffset={4}
    >
      <div className="workspace-mission-filter-popover-body">
        <p className="workspace-mission-filter-popover-title">{title}</p>
        {children}
      </div>
    </PopoverContent>
  );
}

export function MissionFiltersBar({
  filters,
  onChange,
  typeOptions,
  destinationOptions,
  showImport = false,
  onImportClick,
}: Props) {
  const dateActive = Boolean(filters.departFrom || filters.departTo);
  const statusActive = filters.status !== 'ALL';
  const tagActive = filters.missionType !== 'ALL' || filters.destination !== 'ALL';
  const anyActive = hasActiveMissionFilters(filters);

  return (
    <div className="workspace-mission-filter-actions" role="group" aria-label="Filtres missions">
      <Popover>
        <PopoverTrigger asChild>
          <FilterIconButton
            className="workspace-mission-filter-icon-btn--date"
            active={dateActive}
            label="Filtrer par date de départ"
          >
            <Calendar className="h-3 w-3" aria-hidden />
          </FilterIconButton>
        </PopoverTrigger>
        <FilterPopoverPanel title="Date de départ" className="workspace-mission-filter-popover--date">
          <div className="workspace-mission-filter-popover-grid">
            <div className="workspace-mission-filter-popover-field">
              <Label htmlFor="mission-filter-depart-from" className="workspace-mission-filter-popover-label">
                Du
              </Label>
              <FrenchDateField
                id="mission-filter-depart-from"
                className="workspace-mission-filter-popover-input admin-field"
                value={filters.departFrom}
                max={filters.departTo || undefined}
                onChange={(departFrom) => onChange({ ...filters, departFrom })}
              />
            </div>
            <div className="workspace-mission-filter-popover-field">
              <Label htmlFor="mission-filter-depart-to" className="workspace-mission-filter-popover-label">
                Au
              </Label>
              <FrenchDateField
                id="mission-filter-depart-to"
                className="workspace-mission-filter-popover-input admin-field"
                value={filters.departTo}
                min={filters.departFrom || undefined}
                onChange={(departTo) => onChange({ ...filters, departTo })}
              />
            </div>
          </div>
          {dateActive ? (
            <button
              type="button"
              className="workspace-mission-filter-popover-clear"
              onClick={() => onChange({ ...filters, departFrom: '', departTo: '' })}
            >
              Effacer
            </button>
          ) : null}
        </FilterPopoverPanel>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <FilterIconButton
            className="workspace-mission-filter-icon-btn--status"
            active={statusActive}
            label="Filtrer par statut"
          >
            <Signal className="h-3 w-3" aria-hidden />
          </FilterIconButton>
        </PopoverTrigger>
        <FilterPopoverPanel title="Statut" className="workspace-mission-filter-popover--status">
          <Select
            value={filters.status}
            onValueChange={(value) => onChange({ ...filters, status: value as MissionStatusFilter })}
          >
            <SelectTrigger className="workspace-mission-filter-popover-input admin-field w-full">
              <SelectValue placeholder="Tous statuts" />
            </SelectTrigger>
            <SelectContent className="workspace-mission-filter-select-content">
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterPopoverPanel>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <FilterIconButton
            className="workspace-mission-filter-icon-btn--tag"
            active={tagActive}
            label="Filtrer par type et destination"
          >
            <Tag className="h-3 w-3" aria-hidden />
          </FilterIconButton>
        </PopoverTrigger>
        <FilterPopoverPanel title="Type & destination" className="workspace-mission-filter-popover--tag">
          <div className="workspace-mission-filter-popover-stack">
            <div className="workspace-mission-filter-popover-field">
              <Label className="workspace-mission-filter-popover-label">Type</Label>
              <Select
                value={filters.missionType}
                onValueChange={(value) => onChange({ ...filters, missionType: value })}
              >
                <SelectTrigger className="workspace-mission-filter-popover-input admin-field w-full">
                  <SelectValue placeholder="Tous types" />
                </SelectTrigger>
                <SelectContent className="workspace-mission-filter-select-content">
                  <SelectItem value="ALL" className="text-xs">
                    Tous types
                  </SelectItem>
                  {typeOptions.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="workspace-mission-filter-popover-field">
              <Label className="workspace-mission-filter-popover-label">Destination</Label>
              <Select
                value={filters.destination}
                onValueChange={(value) => onChange({ ...filters, destination: value })}
              >
                <SelectTrigger className="workspace-mission-filter-popover-input admin-field w-full">
                  <SelectValue placeholder="Toutes destinations" />
                </SelectTrigger>
                <SelectContent className="workspace-mission-filter-select-content">
                  <SelectItem value="ALL" className="text-xs">
                    Toutes destinations
                  </SelectItem>
                  {destinationOptions.map((code) => (
                    <SelectItem key={code} value={code} className="text-xs">
                      {formatCountryLabel(
                        getMissionCountry(code) ?? { code, name: code, dialCode: null, flag: '' }
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {tagActive ? (
            <button
              type="button"
              className="workspace-mission-filter-popover-clear"
              onClick={() => onChange({ ...filters, missionType: 'ALL', destination: 'ALL' })}
            >
              Effacer
            </button>
          ) : null}
        </FilterPopoverPanel>
      </Popover>

      <FilterIconButton
        className="workspace-mission-filter-icon-btn--reset"
        active={anyActive}
        label="Réinitialiser les filtres"
        disabled={!anyActive}
        onClick={() => onChange(EMPTY_MISSION_FILTERS)}
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
      </FilterIconButton>

      {showImport ? (
        <FilterIconButton
          className="workspace-mission-filter-icon-btn--import"
          label="Importer des missions (Excel)"
          onClick={onImportClick}
        >
          <FileSpreadsheet className="h-3 w-3" aria-hidden />
        </FilterIconButton>
      ) : null}
    </div>
  );
}
