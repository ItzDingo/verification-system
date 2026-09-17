import { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getHighestHoistedRole } from '@/lib/discord';
import { DEV_BYPASS_USER, isDevAuthBypassEnabled, isDevBypassConfigured } from '@/lib/dev-bypass';

const providers: NextAuthOptions['providers'] = [];

const hasDiscordOAuth =
  Boolean(process.env.DISCORD_CLIENT_ID?.trim()) &&
  Boolean(process.env.DISCORD_CLIENT_SECRET?.trim());

if (hasDiscordOAuth) {
  providers.push(
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds guilds.members.read',
        },
      },
    })
  );
}

if (isDevBypassConfigured()) {
  providers.push(
    CredentialsProvider({
      id: 'dev-bypass',
      name: 'Dev bypass',
      credentials: {},
      async authorize() {
        if (!isDevAuthBypassEnabled()) return null;
        return {
          id: DEV_BYPASS_USER.discordId,
          name: DEV_BYPASS_USER.globalName,
          image: DEV_BYPASS_USER.avatar,
        };
      },
    })
  );
}

if (providers.length === 0) {
  throw new Error(
    'No auth providers configured. Set DISCORD_CLIENT_ID/SECRET or enable DEV_BYPASS_AUTH for local testing.'
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async jwt({ token, account, profile, user }: any) {
      if (account?.provider === 'dev-bypass' && user) {
        token.discordId = DEV_BYPASS_USER.discordId;
        token.username = DEV_BYPASS_USER.username;
        token.globalName = DEV_BYPASS_USER.globalName;
        token.avatar = DEV_BYPASS_USER.avatar;
        token.isStaff = true;
        token.isDevBypass = true;
        token.highestRole = DEV_BYPASS_USER.highestRole;
        token.roleColor = DEV_BYPASS_USER.roleColor;
        return token;
      }

      if (account && profile) {
        token.accessToken = account.access_token;
        token.discordId = profile.id;
        token.username = profile.username;
        token.globalName = profile.global_name || profile.username;
        token.avatar = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null;

        try {
          const res = await fetch(
            `https://discord.com/api/guilds/${process.env.GUILD_ID}/members/${profile.id}`,
            { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
          );
          if (res.ok) {
            const member = await res.json();
            token.isStaff = member.roles.includes(process.env.STAFF_ROLE_ID!);
          }
        } catch (e) {
          console.error('Initial staff check failed:', e);
          token.isStaff = false;
        }

        const roleInfo = await getHighestHoistedRole(profile.id);
        token.highestRole = roleInfo?.name || 'Staff';
        token.roleColor = roleInfo?.color ?? 0;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.user.discordId = token.discordId;
      session.user.accessToken = token.accessToken;
      session.user.username = token.username;
      session.user.globalName = token.globalName;
      session.user.avatar = token.avatar;
      session.user.isStaff = token.isStaff;
      session.user.isDevBypass = token.isDevBypass;
      session.user.highestRole = token.highestRole;
      session.user.roleColor = token.roleColor;
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
