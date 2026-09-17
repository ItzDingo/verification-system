import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isDevAuthBypassEnabled, isDevBypassToken } from '@/lib/dev-bypass';

const GUILD_ID = process.env.GUILD_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// ✅ Use NextRequest instead of Request
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // ✅ Allow public paths
  if (pathname === '/' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // ✅ Block if no token or no Discord ID
  if (!token?.discordId) {
    if (isDevAuthBypassEnabled() && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 🛡️ INSTANT ROLE CHECK on every dashboard access
  if (pathname.startsWith('/dashboard')) {
    if (isDevBypassToken(token)) {
      return NextResponse.next();
    }

    try {
      const res = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${token.discordId}`, {
        headers: { Authorization: `Bot ${BOT_TOKEN}` }
      });

      if (res.ok) {
        const member = await res.json();
        const isStaff = member.roles.includes(STAFF_ROLE_ID!);

        if (!isStaff) {
          console.log(`[Middleware] 🚫 Staff role removed for ${token.discordId}. Instant logout.`);
          
          // Delete session cookies immediately
          const response = NextResponse.redirect(new URL('/', req.url));
          response.cookies.delete('next-auth.session-token');
          response.cookies.delete('next-auth.csrf-token');
          return response;
        }
      } else {
        console.warn(`[Middleware] ⚠️ Discord API returned ${res.status}. Allowing access temporarily.`);
      }
    } catch (error) {
      console.error('[Middleware] ❌ Role check failed:', error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
