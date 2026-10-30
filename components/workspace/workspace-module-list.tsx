'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, Loader2, Plus, Search } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminTrashBanner } from '@/components/admin/admin-trash-ui';
import { useTemporalQueryParams } from '@/components/temporal/temporal-navigation-context';
import { ExportFormatMenuContent } from '@/components/ui/export-format-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { downloadCsv } from '@/lib/workspace/export';
import { cn } from '@/lib/utils';

export type WorkspaceColumn<T> = {
  key: string;
  header: string;
  render: (row: T, index: number) => ReactNode;
  exportValue?: (row: T, index: number) => string;
  thClassName?: string;
  tdClassName?: string;
};

export const WORKSPACE_ROW_NUMBER_TH_CLASS = 'workspace-module-th-num';
export const WORKSPACE_ROW_NUMBER_TD_CLASS = 'workspace-module-td-num';

export function createRowNumberColumn<T>(): WorkspaceColumn<T> {
  return {
    key: '__row_num',
    header: 'N°',
    thClassName: WORKSPACE_ROW_NUMBER_TH_CLASS,
    tdClassName: WORKSPACE_ROW_NUMBER_TD_CLASS,
    render: (_row, index) => index + 1,
    exportValue: (_row, index) => String(index + 1),
  };
}

function withRowNumberColumn<T>(columns: WorkspaceColumn<T>[]): WorkspaceColumn<T>[] {
  if (columns.some((c) => c.key === '__row_num' || c.key === 'num')) return columns;
  return [createRowNumberColumn<T>(), ...columns];
}

type ExportHandlers<T> = {
  onExportExcel: (items: T[]) => Promise<void>;
  onExportPdf: (items: T[]) => void;
  /** Libellé singulier affiché dans le menu (ex. « compte rendu »). */
  itemLabel?: string;
};

type Props<T extends { id: string }> = {
  title: string;
  description: string;
  apiPath: string;
  exportFilename: string;
  columns: WorkspaceColumn<T>[];
  searchPlaceholder?: string;
  queryParams?: Record<string, string>;
  onCreateClick?: () => void;
  createLabel?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  refreshTrigger?: number;
  rowActions?: (row: T) => React.ReactNode;
  eyebrow?: string;
  emptyLabel?: string;
  /** Contenu riche pour l’état vide (ex. corbeille ultra-pro). */
  emptyContent?: ReactNode;
  /** Active le style corbeille (toolbar / table / empty). */
  isTrash?: boolean;
  onMeta?: (meta: { counts?: { active: number; trash: number } }) => void;
  onItems?: (items: T[]) => void;
  onRowClick?: (row: T) => void;
  selectedRowId?: string | null;
  rowClassName?: (row: T) => string | undefined;
  filterBar?: ReactNode;
  clientSearch?: (row: T, query: string) => boolean;
  filterRow?: (row: T) => boolean;
  className?: string;
  /** Désactive le défilement horizontal forcé du tableau. */
  disableTableScroll?: boolean;
  /** Export Excel/PDF professionnel (remplace le bouton CSV simple). */
  exportHandlers?: ExportHandlers<T>;
};

export function WorkspaceModuleList<T extends { id: string }>({
  title,
  description,
  apiPath,
  exportFilename,
  columns,
  searchPlaceholder = 'Rechercher…',
  queryParams,
  onCreateClick,
  createLabel = 'Ajouter',
  actions,
  filters,
  refreshTrigger = 0,
  rowActions,
  eyebrow,
  emptyLabel = 'Aucun enregistrement.',
  emptyContent,
  isTrash = false,
  onMeta,
  onItems,
  onRowClick,
  selectedRowId,
  rowClassName,
  filterBar,
  clientSearch,
  filterRow,
  className,
  disableTableScroll = false,
  exportHandlers,
}: Props<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [q, setQ] = useState('');
  const [exportedAt, setExportedAt] = useState('');
  const onMetaRef = useRef(onMeta);
  const onItemsRef = useRef(onItems);
  const hasLoadedOnceRef = useRef(false);
  const loadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    onMetaRef.current = onMeta;
    onItemsRef.current = onItems;
  }, [onMeta, onItems]);

  useEffect(() => {
    setExportedAt(format(new Date(), 'd MMM yyyy à HH:mm', { locale: fr }));
  }, [items.length]);

  const temporalParams = useTemporalQueryParams();
  const paramsKey = queryParams ? JSON.stringify(queryParams) : '';
  const resolvedQueryParams = useMemo(
    () => ({
      ...temporalParams,
      ...(paramsKey ? (JSON.parse(paramsKey) as Record<string, string>) : {}),
    }),
    [paramsKey, temporalParams]
  );

  const load = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 20_000);

    if (!hasLoadedOnceRef.current) setLoading(true);
    try {
      const params = new URLSearchParams(resolvedQueryParams);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`${apiPath}?${params.toString()}`, { signal: controller.signal });
      if (res.ok) {
        const json = (await res.json()) as {
          items: T[];
          counts?: { active: number; trash: number };
        };
        if (!controller.signal.aborted) {
          const loaded = json.items ?? [];
          setItems(loaded);
          onItemsRef.current?.(loaded);
          if (json.counts) onMetaRef.current?.({ counts: json.counts });
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error('[WorkspaceModuleList] load failed:', err);
      }
    } finally {
      clearTimeout(timer);
      if (loadAbortRef.current === controller) loadAbortRef.current = null;
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [apiPath, q, paramsKey, refreshTrigger, resolvedQueryParams, clientSearch]);

  const displayedItems = useMemo(() => {
    let result = items;
    if (clientSearch && q.trim()) {
      const query = q.trim();
      result = result.filter((row) => clientSearch(row, query));
    }
    if (filterRow) {
      result = result.filter(filterRow);
    }
    return result;
  }, [items, q, clientSearch, filterRow]);

  const tableColumns = useMemo(() => withRowNumberColumn(columns), [columns]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(t);
  }, [load]);

  const exportExcel = () => {
    downloadCsv(
      exportFilename,
      tableColumns.map((c) => c.header),
      displayedItems.map((row, index) =>
        tableColumns.map((c) => c.exportValue?.(row, index) ?? String(c.render(row, index) ?? ''))
      )
    );
  };

  const handleProExportExcel = async () => {
    if (!exportHandlers || !displayedItems.length || exportBusy) return;
    setExportBusy(true);
    try {
      await exportHandlers.onExportExcel(displayedItems);
    } finally {
      setExportBusy(false);
    }
  };

  const handleProExportPdf = () => {
    if (!exportHandlers || !displayedItems.length) return;
    exportHandlers.onExportPdf(displayedItems);
  };

  const exportItemLabel = exportHandlers?.itemLabel ?? 'élément';

  return (
    <div className={cn('workspace-module-list space-y-2', className)}>
      <div className="workspace-module-header">
        <AdminPageHeader
          variant="flat"
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={
            <div className="admin-appt-header-actions">
              {actions}
              {exportHandlers ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="admin-appt-filter-btn admin-appt-header-btn"
                      disabled={!displayedItems.length || exportBusy}
                      aria-label="Exporter la liste"
                      title="Exporter la liste"
                    >
                      {exportBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Download className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Exporter
                    </button>
                  </PopoverTrigger>
                  <ExportFormatMenuContent
                    count={displayedItems.length}
                    summary={
                      <>
                        {exportItemLabel}
                        {displayedItems.length > 1 ? 's' : ''} · détails complets
                      </>
                    }
                    busy={exportBusy}
                    onExcel={() => void handleProExportExcel()}
                    onPdf={handleProExportPdf}
                  />
                </Popover>
              ) : (
                <button type="button" className="admin-appt-filter-btn admin-appt-header-btn" onClick={exportExcel}>
                  <Download className="h-3 w-3" aria-hidden />
                  Excel
                </button>
              )}
              {onCreateClick ? (
                <button type="button" className="admin-appt-header-btn admin-appt-header-btn--primary" onClick={onCreateClick}>
                  <Plus className="h-3 w-3" aria-hidden />
                  {createLabel}
                </button>
              ) : null}
            </div>
          }
        />
        {filters ? <div className="workspace-module-filters">{filters}</div> : null}
      </div>

      <section
        className={cn(
          'admin-appt-toolbar workspace-module-toolbar',
          filterBar && 'workspace-module-toolbar--with-filters',
          isTrash && 'admin-trash-toolbar'
        )}
      >
        <div className="workspace-module-toolbar-row">
          {isTrash ? <AdminTrashBanner count={items.length} /> : null}
          <div className="admin-appt-search">
            <Search className="admin-appt-search-icon" aria-hidden />
            <Input
              className="admin-appt-search-input"
              placeholder={isTrash ? 'Rechercher dans la corbeille…' : searchPlaceholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {filterBar}
        </div>
      </section>

      <div
        className={cn(
          'admin-appt-table-wrap workspace-module-table-wrap',
          isTrash && 'admin-trash-table-wrap'
        )}
      >
        <div
          className={cn(
            'workspace-module-table-scroll',
            !disableTableScroll && 'overflow-x-auto'
          )}
        >
          {loading ? (
            <div className="workspace-module-loading">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !loading && displayedItems.length === 0 && items.length === 0 && emptyContent ? (
            emptyContent
          ) : (
            <table
              className={cn(
                'admin-appt-table workspace-module-table w-full',
                !disableTableScroll && 'min-w-[640px] max-md:min-w-[26rem]'
              )}
            >
            <thead>
              <tr>
                {tableColumns.map((c) => (
                  <th key={c.key} className={c.thClassName}>
                    {c.header}
                  </th>
                ))}
                {rowActions ? <th className="workspace-module-th-actions">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.length + (rowActions ? 1 : 0)} className="workspace-module-empty">
                    {items.length > 0
                      ? 'Aucun résultat pour ces critères.'
                      : emptyLabel}
                  </td>
                </tr>
              ) : (
                displayedItems.map((row, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                      onRowClick && 'workspace-module-row--clickable',
                      selectedRowId === row.id && 'workspace-module-row--selected',
                      rowClassName?.(row)
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {tableColumns.map((c) => (
                      <td key={c.key} className={c.tdClassName}>
                        {c.render(row, index)}
                      </td>
                    ))}
                    {rowActions ? (
                      <td className="workspace-module-td-actions" onClick={(e) => e.stopPropagation()}>
                        {rowActions(row)}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          )}
        </div>
        <p className="workspace-module-footer" suppressHydrationWarning>
          {displayedItems.length} élément{displayedItems.length > 1 ? 's' : ''}
          {displayedItems.length !== items.length
            ? ` (sur ${items.length})`
            : ''}
          {exportedAt ? ` — mis à jour le ${exportedAt}` : ''}
        </p>
      </div>
    </div>
  );
}
