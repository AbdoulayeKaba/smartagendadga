import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/** Configuration Prisma CLI (remplace l’ancien bloc `prisma` dans package.json). */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
