import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[API] Health check request');
  return NextResponse.json({
    status: 'UP',
    timestamp: Date.now(),
  });
}
