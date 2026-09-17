import { NextResponse } from 'next/server';
import { isDevAuthBypassEnabled } from '@/lib/dev-bypass';

/** Public sanity check for local dev setup (no secrets). */
export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    devBypass: isDevAuthBypassEnabled(),
    publicDevFlag: process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true',
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
    hasDiscordOAuth: Boolean(
      process.env.DISCORD_CLIENT_ID?.trim() && process.env.DISCORD_CLIENT_SECRET?.trim()
    ),
  });
}
