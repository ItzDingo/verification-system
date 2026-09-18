import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseServer } from '@/lib/supabase';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { devSubmitReport } from '@/lib/dev-mocks';

const CATEGORIES = ['bot', 'website', 'verification', 'security', 'general'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  bot: 'Bot Issue',
  website: 'Website Bug',
  verification: 'Verification Problem',
  security: 'Security Concern',
  general: 'General',
};

const CATEGORY_COLORS: Record<string, number> = {
  bot: 0xed4245,
  website: 0xfee75c,
  verification: 0x5865f2,
  security: 0xed4245,
  general: 0x99aab5,
};

/** DM the owner an embed via the bot's REST API — works even if the bot's gateway/process is down. */
async function sendOwnerDMEmbed(opts: {
  reporterId: string;
  reporterTag: string;
  reporterAvatar: string | null;
  category: string;
  message: string;
}) {
  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const OWNER_ID = process.env.OWNER_DISCORD_ID;
  if (!BOT_TOKEN || !OWNER_ID) {
    return { ok: false, error: 'DISCORD_BOT_TOKEN or OWNER_DISCORD_ID is not configured on the website' };
  }

  try {
    const dmRes = await fetch('https://discord.com/api/users/@me/channels', {
      method: 'POST',
      headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: OWNER_ID }),
    });
    if (!dmRes.ok) return { ok: false, error: `Could not open DM with owner (Discord ${dmRes.status})` };
    const dm = await dmRes.json();

    const embed: Record<string, unknown> = {
      title: '📩 New Website Report',
      color: CATEGORY_COLORS[opts.category] ?? 0x5865f2,
      timestamp: new Date().toISOString(),
      fields: [
        { name: '👤 Reporter', value: `<@${opts.reporterId}> (\`${opts.reporterTag}\`)`, inline: true },
        { name: '🏷️ Category', value: CATEGORY_LABELS[opts.category] ?? opts.category, inline: true },
        { name: '📝 Message', value: opts.message.slice(0, 1000) || '(empty)', inline: false },
      ],
      footer: { text: `Report from Paradise • ${opts.reporterId}` },
    };
    if (opts.reporterAvatar) embed.thumbnail = { url: opts.reporterAvatar };

    const msgRes = await fetch(`https://discord.com/api/channels/${dm.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!msgRes.ok) {
      const t = await msgRes.text().catch(() => '');
      return { ok: false, error: `Owner DM failed (Discord ${msgRes.status}): ${t.slice(0, 150)}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error';
    return { ok: false, error: `Owner DM failed: ${message}` };
  }
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const category = CATEGORIES.includes(body.category) ? body.category : 'general';
  const message = String(body.message || '').trim();

  if (message.length < 10) {
    return NextResponse.json({ error: 'Please describe the problem in at least 10 characters.' }, { status: 400 });
  }
  if (message.length > 1500) {
    return NextResponse.json({ error: 'Report is too long (max 1500 characters).' }, { status: 400 });
  }

  if (isDevBypassToken(token)) {
    devSubmitReport(category, message, {
      id: token.discordId as string,
      name: (token.username as string) || (token.globalName as string) || 'Staff',
    });
    return NextResponse.json({ success: true, message: 'Report submitted (dev mock — no Discord DM).', devMock: true });
  }

  const reporterId = token.discordId as string;
  const reporterTag = (token.username as string) || (token.globalName as string) || reporterId;
  const reporterAvatar = (token.avatar as string) || null;

  // 1) Best-effort DB store so reports still show up on the dashboard even if the DM fails.
  let stored = false;
  let storeError: string | null = null;
  try {
    const { error } = await supabaseServer.from('reports').insert({
      reporter_id: reporterId,
      reporter_name: reporterTag,
      category,
      message,
      status: 'open',
    });
    if (!error) stored = true;
    else storeError = error.message;
  } catch (err) {
    storeError = err instanceof Error ? err.message : 'insert failed';
  }

  // 2) DM the owner via the bot's REST API — this is the step that was previously missing,
  // so reports were silently saved to the database with no notification ever sent.
  const dm = await sendOwnerDMEmbed({ reporterId, reporterTag, reporterAvatar, category, message });

  if (!dm.ok && !stored) {
    return NextResponse.json(
      { error: `Report could not be delivered. ${dm.error || ''} ${storeError ? `(DB: ${storeError})` : ''}`.trim() },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    message: dm.ok
      ? 'Report submitted. The owner has been notified.'
      : 'Report saved, but the owner DM failed — staff can still review it in the dashboard.',
    dmSent: dm.ok,
    stored,
    ...(dm.ok ? {} : { dmError: dm.error }),
  });
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (token.discordId !== process.env.OWNER_DISCORD_ID) {
    return NextResponse.json({ error: 'Owner only.' }, { status: 403 });
  }
  try {
    const { data, error } = await supabaseServer
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json([]); // table may not exist yet
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}
