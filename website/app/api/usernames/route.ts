import { NextResponse, NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids');

  if (!idsParam) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
  }

  const ids = idsParam.split(',').filter(id => id.length > 0);
  if (ids.length === 0) {
    return NextResponse.json({});
  }

  const GUILD_ID = process.env.GUILD_ID;
  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

  const usernameMap: Record<string, string> = {};

  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${id}`, {
          headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });
        
        if (res.ok) {
          const member = await res.json();
          // CHANGE THIS LINE: Use only username
          usernameMap[id] = member.user.username; 
        } else {
          usernameMap[id] = `Unknown (${id})`;
        }
      } catch {
        usernameMap[id] = `Error (${id})`;
      }
    })
  );

  return NextResponse.json(usernameMap);
}