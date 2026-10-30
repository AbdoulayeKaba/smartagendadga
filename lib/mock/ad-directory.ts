import type { AdDirectoryUser } from '@/lib/dg/ldap-config';

/** Utilisateurs fictifs Active Directory pour la démo mock. */
export const MOCK_AD_DIRECTORY: AdDirectoryUser[] = [
  {
    externalId: 'ad-mock-1',
    email: 'jean.kone@arpt.dz',
    firstName: 'Jean',
    lastName: 'Koné',
    department: 'Direction générale',
    role: 'MANAGER',
  },
  {
    externalId: 'ad-mock-2',
    email: 'fatou.diallo@arpt.dz',
    firstName: 'Fatou',
    lastName: 'Diallo',
    department: 'Régulation',
    role: 'MANAGER',
  },
  {
    externalId: 'ad-mock-3',
    email: 'moussa.camara@arpt.dz',
    firstName: 'Moussa',
    lastName: 'Camara',
    department: 'Spectrum',
    role: 'MANAGER',
  },
  {
    externalId: 'ad-mock-4',
    email: 'aicha.bah@partenaire.dz',
    firstName: 'Aicha',
    lastName: 'Bah',
    department: 'Partenaire externe',
    role: 'EXTERNAL',
  },
];
