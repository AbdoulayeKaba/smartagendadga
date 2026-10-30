import { NextResponse } from 'next/server';
import { isAzureAdConfigured } from '@/lib/auth/microsoft-user';
import { isMockDataEnabled } from '@/lib/mock/config';

export async function GET() {
  return NextResponse.json({
    microsoft: isMockDataEnabled() ? false : isAzureAdConfigured(),
    mock: isMockDataEnabled(),
  });
}
