import { NextResponse, NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getToken } from 'next-auth/jwt';
import { fetchMemberDisplay } from '@/lib/discord';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { devBlacklistAction, getDevBlacklist } from '@/lib/dev-mocks';

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (token.discordId !== process.env.OWNER_DISCORD_ID && !isDevBypassToken(token)) {
    return NextResponse.json({ error: 'Owner only.' }, { status: 403 });
  }

  if (isDevBypassToken(token)) {
    return NextResponse.json(getDevBlacklist());
  }

  const { data, error } = await supabaseServer
    .from('blacklist')
    .select('*')
    .eq('active', true)
    .order('user_id', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to load blacklist' }, { status: 500 });

  const enriched = await Promise.all(
    (data || []).map(async (entry) => {
      const display = await fetchMemberDisplay(entry.user_id);
      return { ...entry, ...display };
    })
  );

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // Only the Owner can access this
  if (token.discordId !== process.env.OWNER_DISCORD_ID && !isDevBypassToken(token)) {
    return NextResponse.json({ error: 'Owner only.' }, { status: 403 });
  }

  const { userId, action, reason } = await req.json();

  if (isDevBypassToken(token)) {
    devBlacklistAction(userId, action, reason, token.discordId as string);
    return NextResponse.json({ success: true, devMock: true });
  }

  if (action === 'add') {
    await supabaseServer.from('blacklist').upsert({
      user_id: userId,
      reason,
      blacklisted_by: token.discordId,
      active: true
    }, { onConflict: 'user_id' });
  } else {
    await supabaseServer.from('blacklist').update({ active: false }).eq('user_id', userId);
  }

  // Log the blacklist action
  await supabaseServer.from('logs').insert({
    target_id: userId,
    staff_id: token.discordId,
    staff_tag: token.username || 'Owner',
    action: action === 'add' ? 'blacklisted' : 'unblacklisted',
    reason
  });

  return NextResponse.json({ success: true });
}