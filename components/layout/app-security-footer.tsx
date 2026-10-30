const FOOTER_YEAR = 2026;
const DEFAULT_FOOTER_OWNER = 'Direction Générale';

type Props = {
  className?: string;
  owner?: string;
};

export function AppSecurityFooter({ className, owner = DEFAULT_FOOTER_OWNER }: Props) {
  return (
    <footer className={['app-security-footer', className].filter(Boolean).join(' ')}>
      <span className="app-security-footer__copy">
        © {FOOTER_YEAR} {owner}
      </span>
      <span className="app-security-footer__secure">
        <span className="app-security-footer__dot" aria-hidden />
        Connexion chiffrée HTTPS
      </span>
    </footer>
  );
}
