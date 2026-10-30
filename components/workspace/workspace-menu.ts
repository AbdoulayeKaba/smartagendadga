export type WorkspaceMenuItem = {
  href: string;
  label: string;
  exact?: boolean;
};

/** Onglets affichés uniquement dans le layout `/dg/workspace/*`. */
export const WORKSPACE_MENU: WorkspaceMenuItem[] = [
  { href: '/dg/workspace/mail', label: 'Courriers départ' },
  { href: '/dg/workspace/mail-enregistrement', label: 'Coffre-fort' },
  { href: '/dg/workspace/contacts', label: 'Contacts' },
  { href: '/dg/workspace/audiences', label: 'Audiences' },
  { href: '/dg/workspace/deadlines', label: 'Echeances' },
  { href: '/dg/workspace/documents', label: 'Compte rendu' },
];

export const WORKSPACE_DEFAULT_TAB = '/dg/workspace/mail';
