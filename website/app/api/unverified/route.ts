import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { fetchGuildMembers } from '@/lib/discord-guild';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { getDevUnverified } from '@/lib/dev-mocks';

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isDevBypassToken(token)) {
    return NextResponse.json(getDevUnverified());
  }

  const verifiedRoleId = process.env.VERIFIED_ROLE_ID;
  const members = await fetchGuildMembers();

  if (!members) {
    return NextResponse.json([]);
  }

  const unverified = members
    .filter((m) => !m.user.bot && verifiedRoleId && !m.roles.includes(verifiedRoleId))
    .map((m) => ({
      discord_id: m.user.id,
      username: m.user.username,
      global_name: m.user.global_name ?? null,
      avatar: m.user.avatar
        ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`
        : null,
      joined_at: m.joined_at,
    }));

  return NextResponse.json(unverified);
}
