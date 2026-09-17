import NextAuth from "next-auth"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      discordId?: string | null;
      accessToken?: string | null;
      username?: string | null;
      globalName?: string | null;
      avatar?: string | null;
      isStaff?: boolean;
      isDevBypass?: boolean;
      highestRole?: string | null;
      roleColor?: number;
    } & DefaultSession["user"]
  }

  interface Profile {
    id?: string;
    username?: string;
    avatar?: string;
    global_name?: string;
    discriminator?: string;
    public_flags?: number;
    flags?: number;
    banner?: string | null;
    accent_color?: number | null;
    locale?: string;
    mfa_enabled?: boolean;
    premium_type?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string | null;
    accessToken?: string | null;
    username?: string | null;
    globalName?: string | null;
    avatar?: string | null;
    isStaff?: boolean;
    isDevBypass?: boolean;
    highestRole?: string | null;
    roleColor?: number;
  }
}
