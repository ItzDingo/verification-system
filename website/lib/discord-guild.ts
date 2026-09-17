const DISCORD_API = 'https://discord.com/api';

export type RawGuildMember = {
  user: { id: string; username: string; avatar: string | null; global_name?: string | null; bot?: boolean };
  roles: string[];
  joined_at: string;
};

export async function fetchGuildMembers(limit = 1000, timeoutMs = 12000): Promise<RawGuildMember[] | null> {
  const guildId = process.env.GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members?limit=${limit}`, {
      headers: { Authorization: `Bot ${token}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
