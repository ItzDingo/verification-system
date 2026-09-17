import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { fetchGuildMembers } from '@/lib/discord-guild';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { getDevMembers } from '@/lib/dev-mocks';

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isDevBypassToken(token)) {
    return NextResponse.json(getDevMembers());
  }

  const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
  const members = await fetchGuildMembers();

  if (!members) {
    return NextResponse.json([], { status: 200 });
  }

  const allMembers = members
    .filter((m) => !m.user.bot)
    .map((m) => ({
      discord_id: m.user.id,
      username: m.user.username,
      global_name: m.user.global_name ?? null,
      avatar: m.user.avatar
        ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`
        : null,
      roles: m.roles,
      joined_at: m.joined_at,
      is_verified: VERIFIED_ROLE_ID ? m.roles.includes(VERIFIED_ROLE_ID) : false,
    }));

  return NextResponse.json(allMembers);
}
