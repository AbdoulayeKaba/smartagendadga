import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/** Session serveur (NextAuth v4). */
export async function auth() {
  return getServerSession(authOptions);
}

export { authOptions };
