import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseServer } from '@/lib/supabase';
import { isDevBypassToken } from '@/lib/dev-bypass';

const DISCORD_API = 'https://discord.com/api';

/**
 * Checks whether an invite code is still valid by asking Discord directly
 * (GET /invites/{code}), rather than cross-referencing the guild's live
 * invite list — an invite can be revoked, expired by time/uses, or the
 * inviter can have left, and this endpoint reflects the current truth
 * without needing Manage Guild-level access to list every invite.
 */
async function isInviteActive(code: string): Promise<boolean> {
  try {
    const res = await fetch(`${DISCORD_API}/invites/${code}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  if (isDevBypassToken(token)) {
    return NextResponse.json({
      available: true,
      inviteCode: 'dev-mock',
      inviterId: '111111111111111111',
      inviterUsername: 'dev_inviter',
      inviterAvatar: 'https://cdn.discordapp.com/embed/avatars/1.png',
      active: true,
      joinedAt: new Date(Date.now() - 3600_000).toISOString(),
      devMock: true,
    });
  }

  try {
    const { data, error } = await supabaseServer
      .from('invite_joins')
      .select('*')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // No row at all → either they joined before invite tracking was enabled,
    // or the invite_joins table/migration hasn't been set up yet. Either way,
    // there's nothing to show, and that's an expected, normal case — not an error.
    if (error || !data) {
      return NextResponse.json({ available: false });
    }

    const active = data.invite_code ? await isInviteActive(data.invite_code) : false;

    return NextResponse.json({
      available: true,
      inviteCode: data.invite_code,
      inviterId: data.inviter_id,
      inviterUsername: data.inviter_username,
      inviterAvatar: data.inviter_avatar,
      active,
      joinedAt: data.joined_at,
    });
  } catch (err) {
    console.error('[InviteInfo] Failed to fetch invite info:', err);
    return NextResponse.json({ available: false });
  }
}
