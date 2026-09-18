import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseServer } from '@/lib/supabase';
import { fetchMemberDisplay } from '@/lib/discord';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { getDevLeaderboard } from '@/lib/dev-mocks';

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isDevBypassToken(token)) {
    return NextResponse.json(getDevLeaderboard());
  }

  const { data: stats, error } = await supabaseServer
    .from('staff_stats')
    .select('*')
    .order('accepted', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });

  const enriched = await Promise.all(
    (stats || []).map(async (s) => {
      const display = await fetchMemberDisplay(s.staff_id, {
        username: s.last_known_username,
        avatar: s.last_known_avatar,
      });
      const total = (s.accepted || 0) + (s.denied || 0);
      return {
        staffId: s.staff_id,
        displayName: display.displayName,
        username: display.username,
        avatar: display.avatar,
        inServer: display.inServer,
        accepted: s.accepted || 0,
        denied: s.denied || 0,
        total,
      };
    })
  );

  enriched.sort((a, b) => b.total - a.total || b.accepted - a.accepted);
  return NextResponse.json(enriched);
}
