import 'next-auth';
import 'next-auth/jwt';
import type { DgRole } from '@/lib/dg/rbac';

declare module 'next-auth' {
  interface User {
    role?: DgRole;
    department?: string;
    firstName?: string;
    lastName?: string;
    mustChangePassword?: boolean;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: DgRole;
      department: string;
      firstName: string;
      lastName: string;
      mustChangePassword?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: DgRole;
    department?: string;
    firstName?: string;
    lastName?: string;
    mustChangePassword?: boolean;
  }
}
