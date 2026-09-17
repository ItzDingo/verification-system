import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseServer } from '@/lib/supabase';
import { fetchMemberDisplay } from '@/lib/discord';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { getDevVerifiedUsers } from '@/lib/dev-mocks';

const PAGE_SIZE = 15;

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const search = (req.nextUrl.searchParams.get('search') || '').trim().toLowerCase();

  if (isDevBypassToken(token)) {
    return NextResponse.json(getDevVerifiedUsers(page, search));
  }
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabaseServer
    .from('users')
    .select('*', { count: 'exact' })
    .eq('verified', true)
    .order('verified_at', { ascending: false });

  const { data, count, error } = await query.range(from, to);
  if (error) return NextResponse.json({ error: 'Failed to load verified users' }, { status: 500 });

  const enriched = await Promise.all(
    (data || []).map(async (u) => {
      let username = u.username;
      let displayName = u.display_name;
      let avatar = u.avatar;

      if (!username || !avatar) {
        const display = await fetchMemberDisplay(u.discord_id);
        username = display.username;
        displayName = display.displayName;
        avatar = display.avatar;
      }

      return {
        discordId: u.discord_id,
        username: username || u.discord_id,
        displayName: displayName || username || u.discord_id,
        avatar: avatar || `https://cdn.discordapp.com/embed/avatars/0.png`,
        verifiedBy: u.verified_by,
        verifiedAt: u.verified_at,
        reason: u.verify_reason,
      };
    })
  );

  const filtered = search
    ? enriched.filter(
        (u) =>
          u.username.toLowerCase().includes(search) ||
          u.displayName.toLowerCase().includes(search) ||
          u.discordId.includes(search)
      )
    : enriched;

  return NextResponse.json({
    users: filtered,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
