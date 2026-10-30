/** @deprecated Utiliser lib/mock/users-store — réexport pour compatibilité. */
export {
  mockFindUserByEmail as findMockUserByEmail,
  mockFindUserById as findMockUserById,
  mockAuthenticate as authenticateMockUser,
  getDefaultGuestUser,
  mockListUsers,
} from '@/lib/mock/users-store';

export type { MockUserRecord as MockUser } from '@/lib/mock/users-store';
