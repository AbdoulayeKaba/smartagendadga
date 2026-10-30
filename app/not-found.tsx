import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="dg-not-found">
      <section className="dg-not-found-card">
        <p className="dg-not-found-kicker">Agenda DGA</p>
        <p className="dg-not-found-code">404</p>
        <h1>Page introuvable</h1>
        <p className="dg-not-found-copy">
          Cette adresse n’existe pas sur la plateforme, ou elle a été déplacée.
        </p>
        <div className="dg-not-found-actions">
          <Link href="/" className="dg-not-found-primary">
            Retour à l’accueil
          </Link>
          <Link href="/login" className="dg-not-found-secondary">
            Connexion
          </Link>
        </div>
      </section>
    </main>
  );
}
