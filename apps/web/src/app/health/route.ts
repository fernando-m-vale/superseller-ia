import { NextResponse } from 'next/server';

/**
 * Health check endpoint for ECS container health checks.
 * 
 * This endpoint is designed to:
 * - Always return 200 OK when the Next.js server is running
 * - Be fast and lightweight (no database or external dependencies)
 * - Work without authentication
 * 
 * Used by ECS task definition health check:
 * curl -fsS http://localhost:3000/health || exit 1
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'superseller-web',
    },
    { status: 200 }
  );
}

// Ensure this route is always dynamic (not cached)
export const dynamic = 'force-dynamic';
