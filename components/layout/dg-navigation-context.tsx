'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

type DgNavigationContextValue = {
  pending: boolean;
  startNavigation: () => void;
};

const DgNavigationContext = createContext<DgNavigationContextValue>({
  pending: false,
  startNavigation: () => {},
});

export function useDgNavigation() {
  return useContext(DgNavigationContext);
}

export function DgNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const previousPath = useRef(pathname);

  const startNavigation = useCallback(() => {
    setPending(true);
  }, []);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      setPending(false);
    }
  }, [pathname]);

  return (
    <DgNavigationContext.Provider value={{ pending, startNavigation }}>
      {pending ? <div className="dg-nav-route-progress" aria-hidden /> : null}
      {children}
    </DgNavigationContext.Provider>
  );
}
