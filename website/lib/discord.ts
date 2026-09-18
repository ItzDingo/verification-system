const DISCORD_API = 'https://discord.com/api';

export interface DiscordRole {
  id: string;
  name: string;
  position: number;
  hoist: boolean;
  color: number;
}

export interface GuildMember {
  user: { id: string; username: string; avatar: string | null; global_name?: string | null };
  roles: string[];
  nick?: string | null;
}

export async function fetchGuildMember(userId: string): Promise<GuildMember | null> {
  try {
    const res = await fetch(`${DISCORD_API}/guilds/${process.env.GUILD_ID}/members/${userId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchGuildRoles(): Promise<DiscordRole[]> {
  try {
    const res = await fetch(`${DISCORD_API}/guilds/${process.env.GUILD_ID}/roles`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Highest role the member has with hoist (display separately) enabled */
export async function getHighestHoistedRole(userId: string): Promise<{ name: string; color: number } | null> {
  const [member, roles] = await Promise.all([fetchGuildMember(userId), fetchGuildRoles()]);
  if (!member) return null;

  if (userId === process.env.OWNER_DISCORD_ID) {
    return { name: 'Owner', color: 0 };
  }

  const memberRoleIds = new Set(member.roles);
  const hoisted = roles
    .filter((r) => memberRoleIds.has(r.id) && r.hoist && r.name !== '@everyone')
    .sort((a, b) => b.position - a.position);

  if (hoisted.length === 0) {
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && memberRoleIds.has(staffRoleId)) {
      const staffRole = roles.find((r) => r.id === staffRoleId);
      return { name: staffRole?.name || 'Staff', color: staffRole?.color || 0 };
    }
    return null;
  }

  return { name: hoisted[0].name, color: hoisted[0].color };
}

function defaultEmbedAvatarIndex(userId: string): number {
  try {
    const id = BigInt(userId);
    return Number((id >> BigInt(22)) % BigInt(6));
  } catch {
    return 0;
  }
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
}

/**
 * Fetches a user by ID from Discord's global user endpoint, which works even
 * if the user has left the guild (unlike the guild-member endpoint, which
 * 404s the moment someone leaves). Requires the bot to share at least one
 * mutual context with the user, which is true for anyone who was ever a
 * member of this guild.
 */
export async function fetchGlobalUser(userId: string): Promise<DiscordUser | null> {
  try {
    const res = await fetch(`${DISCORD_API}/users/${userId}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function avatarUrl(userId: string, avatarHash: string | null | undefined, size = 128): string {
  if (!avatarHash) return `https://cdn.discordapp.com/embed/avatars/${defaultEmbedAvatarIndex(userId)}.png`;
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
}

/**
 * Resolves a display name/avatar for a user, in order of freshness:
 * 1. Live guild member (has nickname + up-to-date avatar) — works while they're in the server.
 * 2. Global Discord user lookup — still works after they've left the server.
 * 3. A caller-supplied last-known fallback (e.g. cached in our own DB from a previous session).
 * 4. Finally "User {id}" — only when Discord has no record of them at all (rare: deleted account).
 */
export async function fetchMemberDisplay(
  userId: string,
  lastKnown?: { username?: string | null; avatar?: string | null } | null
) {
  const member = await fetchGuildMember(userId);
  if (member) {
    const u = member.user;
    return {
      username: u.username,
      displayName: member.nick || u.global_name || u.username,
      avatar: avatarUrl(u.id, u.avatar),
      inServer: true,
    };
  }

  const globalUser = await fetchGlobalUser(userId);
  if (globalUser) {
    return {
      username: globalUser.username,
      displayName: globalUser.global_name || globalUser.username,
      avatar: avatarUrl(globalUser.id, globalUser.avatar),
      inServer: false,
    };
  }

  if (lastKnown?.username) {
    return {
      username: lastKnown.username,
      displayName: lastKnown.username,
      avatar: lastKnown.avatar || avatarUrl(userId, null),
      inServer: false,
    };
  }

  return { username: `User ${userId}`, displayName: `User ${userId}`, avatar: avatarUrl(userId, null), inServer: false };
}
