'use client';

import type { ReactNode } from 'react';
import { FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { PopoverContent } from '@/components/ui/popover';
import './export-format-menu.css';

type Props = {
  count: number;
  /** Texte après le compteur, ex. "contacts · détails complets" */
  summary: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onExcel: () => void;
  onPdf: () => void;
  align?: 'start' | 'center' | 'end';
};

export function ExportFormatMenuContent({
  count,
  summary,
  busy = false,
  disabled = false,
  onExcel,
  onPdf,
  align = 'end',
}: Props) {
  const inactive = disabled || busy || count < 1;

  return (
    <PopoverContent align={align} className="app-export-menu">
      <div className="app-export-menu-head">
        <p className="app-export-menu-title">Exporter la sélection</p>
        <p className="app-export-menu-meta">
          <strong>{count}</strong> {summary}
        </p>
      </div>
      <div className="app-export-menu-list">
        <button
          type="button"
          className="app-export-menu-item app-export-menu-item--excel"
          onClick={onExcel}
          disabled={inactive}
        >
          <span className="app-export-menu-ico app-export-menu-ico--excel" aria-hidden>
            {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
          </span>
          <span className="app-export-menu-copy">
            <span className="app-export-menu-label">Excel (.xlsx)</span>
            <span className="app-export-menu-blurb">Tableau formaté</span>
          </span>
        </button>
        <button
          type="button"
          className="app-export-menu-item app-export-menu-item--pdf"
          onClick={onPdf}
          disabled={inactive}
        >
          <span className="app-export-menu-ico app-export-menu-ico--pdf" aria-hidden>
            <Printer />
          </span>
          <span className="app-export-menu-copy">
            <span className="app-export-menu-label">PDF</span>
            <span className="app-export-menu-blurb">Mise en page pro</span>
          </span>
        </button>
      </div>
    </PopoverContent>
  );
}
