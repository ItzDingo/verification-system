import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseServer } from '@/lib/supabase';
import { checkBotHealth } from '@/lib/bot-health';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { getDevStats } from '@/lib/dev-mocks';

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isDevBypassToken(token)) {
    return NextResponse.json(getDevStats());
  }

  const pendingPromise = fetch(`${req.nextUrl.origin}/api/unverified`, {
    headers: { cookie: req.headers.get('cookie') || '' },
    signal: AbortSignal.timeout(8000),
  })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);

  const [verifiedRes, logsRes, blacklistRes, pendingRes, botHealth] = await Promise.all([
    supabaseServer.from('users').select('discord_id', { count: 'exact', head: true }).eq('verified', true),
    supabaseServer.from('logs').select('action'),
    supabaseServer.from('blacklist').select('user_id', { count: 'exact', head: true }).eq('active', true),
    pendingPromise,
    checkBotHealth(),
  ]);

  const logs = logsRes.data || [];
  const accepted = logs.filter((l) => l.action === 'accepted').length;
  const denied = logs.filter((l) => l.action === 'denied').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRes = await supabaseServer
    .from('logs')
    .select('id', { count: 'exact', head: true })
    .gte('timestamp', today.toISOString());

  return NextResponse.json({
    verified: verifiedRes.count ?? 0,
    pending: Array.isArray(pendingRes) ? pendingRes.length : 0,
    blacklisted: blacklistRes.count ?? 0,
    totalActions: logs.length,
    accepted,
    denied,
    todayActions: todayRes.count ?? 0,
    botOnline: botHealth.online,
    botLatencyMs: botHealth.latencyMs,
  });
}
