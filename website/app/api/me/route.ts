import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getHighestHoistedRole } from '@/lib/discord';
import { DEV_BYPASS_USER, isDevBypassToken } from '@/lib/dev-bypass';

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isDevBypassToken(token)) {
    return NextResponse.json({
      discordId: DEV_BYPASS_USER.discordId,
      username: DEV_BYPASS_USER.username,
      globalName: DEV_BYPASS_USER.globalName,
      avatar: DEV_BYPASS_USER.avatar,
      role: DEV_BYPASS_USER.highestRole,
      roleColor: DEV_BYPASS_USER.roleColor,
      isOwner: true,
    });
  }

  const role = await getHighestHoistedRole(token.discordId as string);

  return NextResponse.json({
    discordId: token.discordId,
    username: token.username,
    globalName: token.globalName,
    avatar: token.avatar,
    role: role?.name || 'Staff',
    roleColor: role?.color ?? 0,
    isOwner: token.discordId === process.env.OWNER_DISCORD_ID,
  });
}
