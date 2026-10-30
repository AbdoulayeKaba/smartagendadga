/** Skeleton léger affiché pendant la navigation entre pages DG. */
export function DgRouteLoading() {
  return (
    <div className="dg-route-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Chargement de la page…</span>
      <div className="dg-route-loading-bar" aria-hidden />
      <div className="dg-route-loading-shell">
        <div className="dg-route-loading-head" />
        <div className="dg-route-loading-toolbar" />
        <div className="dg-route-loading-grid">
          <div className="dg-route-loading-card" />
          <div className="dg-route-loading-card" />
          <div className="dg-route-loading-card dg-route-loading-card--wide" />
        </div>
      </div>
    </div>
  );
}
