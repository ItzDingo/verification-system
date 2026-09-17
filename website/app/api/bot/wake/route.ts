import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { wakeBotAndWait } from '@/lib/bot-health';
import { isDevBypassToken } from '@/lib/dev-bypass';

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isDevBypassToken(token)) {
    return NextResponse.json({
      online: true,
      wokeUp: false,
      attempts: 1,
      durationMs: 400,
      latencyMs: 42,
      devMock: true,
    });
  }

  const result = await wakeBotAndWait({ maxWaitMs: 15_000, pollIntervalMs: 2_000 });

  if (!result.online) {
    return NextResponse.json(
      {
        ...result,
        error: result.error || 'Verification system unavailable. Try again in a moment.',
      },
      { status: 503 }
    );
  }

  return NextResponse.json(result);
}
