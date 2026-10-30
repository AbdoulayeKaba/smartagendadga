'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type DgShellContextValue = {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  desktopSidebarOpen: boolean;
  toggleDesktopSidebar: () => void;
  openNavigation: () => void;
};

const DgShellContext = createContext<DgShellContextValue | null>(null);

export function DgShellProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  const toggleDesktopSidebar = useCallback(() => {
    setDesktopSidebarOpen((v) => !v);
  }, []);

  const openNavigation = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setDesktopSidebarOpen(true);
      return;
    }
    setMobileNavOpen(true);
  }, []);

  return (
    <DgShellContext.Provider
      value={{
        mobileNavOpen,
        setMobileNavOpen,
        desktopSidebarOpen,
        toggleDesktopSidebar,
        openNavigation,
      }}
    >
      {children}
    </DgShellContext.Provider>
  );
}

export function useDgShell() {
  const ctx = useContext(DgShellContext);
  if (!ctx) {
    throw new Error('useDgShell must be used within DgShellProvider');
  }
  return ctx;
}
