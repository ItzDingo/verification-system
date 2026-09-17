import { NextResponse, NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getToken } from 'next-auth/jwt';
import { checkBotHealth } from '@/lib/bot-health';
import { fetchMemberDisplay } from '@/lib/discord';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { devVerifyAction, getDevBlacklist } from '@/lib/dev-mocks';

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { targetId, action, reason } = body;

    if (!targetId || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const normalizedAction = action === 'accept' ? 'accepted' : action === 'deny' ? 'denied' : action;
    const normalizedReason = (reason || '').trim() || `${normalizedAction === 'accepted' ? 'Verified' : 'Denied'} by Staff`;

    if (isDevBypassToken(token)) {
      if (normalizedAction === 'accepted' && getDevBlacklist().some((b) => b.user_id === targetId)) {
        return NextResponse.json({ error: 'User is blacklisted.' }, { status: 403 });
      }

      const display = devVerifyAction(
        targetId,
        normalizedAction as 'accepted' | 'denied',
        normalizedReason,
        { id: token.discordId as string, tag: (token.username as string) || 'Staff' }
      );

      return NextResponse.json({
        success: true,
        message: normalizedAction === 'accepted' ? 'User verified successfully (dev mock)' : 'User denied (dev mock)',
        target: { id: targetId, username: display.username, displayName: display.displayName, avatar: display.avatar },
        action: normalizedAction,
        reason: normalizedReason,
        staff: { id: token.discordId, tag: token.username || 'Staff' },
        timestamp: new Date().toISOString(),
        botOnline: true,
        devMock: true,
      });
    }

    // Bot health check — required before accept
    if (normalizedAction === 'accepted') {
      const botHealth = await checkBotHealth();
      if (!botHealth.online) {
        return NextResponse.json(
          {
            error: 'Verification rejected: Bot is offline or unreachable.',
            reason: botHealth.error || 'The Discord bot must be online to assign roles and notify the user.',
            botOnline: false,
          },
          { status: 503 }
        );
      }
    }

    const blRes = await supabaseServer
      .from('blacklist')
      .select('active')
      .eq('user_id', targetId)
      .eq('active', true)
      .maybeSingle();

    if (blRes.data?.active) {
      return NextResponse.json({ error: 'User is blacklisted.' }, { status: 403 });
    }

    const targetDisplay = await fetchMemberDisplay(targetId);
    const targetUsername = targetDisplay.username;

    const fiveSecAgo = new Date(Date.now() - 5000).toISOString();

    const dupRes = await supabaseServer
      .from('logs')
      .select('id')
      .eq('target_id', targetId)
      .eq('staff_id', token.discordId)
      .eq('action', normalizedAction)
      .eq('reason', normalizedReason)
      .gte('timestamp', fiveSecAgo)
      .maybeSingle();

    if (dupRes.data) {
      if (normalizedAction === 'accepted') {
        const botHealth = await checkBotHealth();
        if (!botHealth.online) {
          return NextResponse.json(
            { error: 'Verification rejected: Bot is offline.', reason: botHealth.error, botOnline: false },
            { status: 503 }
          );
        }
        await supabaseServer.from('users').upsert(
          {
            discord_id: targetId,
            verified: true,
            verified_by: token.discordId,
            verified_at: new Date().toISOString(),
            verify_reason: normalizedReason,
            username: targetDisplay.username,
            display_name: targetDisplay.displayName,
            avatar: targetDisplay.avatar,
          },
          { onConflict: 'discord_id' }
        );
      }
      return NextResponse.json({
        success: true,
        message: 'Action already processed recently',
        duplicate: true,
        target: { id: targetId, ...targetDisplay },
        action: normalizedAction,
        reason: normalizedReason,
      });
    }

    await supabaseServer.from('logs').insert({
      target_id: targetId,
      target_username: targetUsername,
      staff_id: token.discordId,
      staff_tag: token.username || 'Staff',
      action: normalizedAction,
      reason: normalizedReason,
    });

    const field = normalizedAction === 'accepted' ? 'accepted' : 'denied';
    const stRes = await supabaseServer.from('staff_stats').select('*').eq('staff_id', token.discordId).maybeSingle();

    const st = stRes.data;
    if (st) {
      await supabaseServer
        .from('staff_stats')
        .update({ [field]: (st as Record<string, number>)[field] + 1 })
        .eq('staff_id', token.discordId);
    } else {
      await supabaseServer.from('staff_stats').insert({ staff_id: token.discordId, [field]: 1 });
    }

    if (normalizedAction === 'accepted') {
      const { error: upsertError } = await supabaseServer.from('users').upsert(
        {
          discord_id: targetId,
          verified: true,
          verified_by: token.discordId,
          verified_at: new Date().toISOString(),
          verify_reason: normalizedReason,
          username: targetDisplay.username,
          display_name: targetDisplay.displayName,
          avatar: targetDisplay.avatar,
        },
        { onConflict: 'discord_id' }
      );

      if (upsertError) {
        console.error('[Verify] Upsert failed:', upsertError);
        return NextResponse.json(
          {
            error: 'Verification rejected: Failed to register in database.',
            reason: upsertError.message,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: normalizedAction === 'accepted' ? 'User verified successfully' : 'User denied',
      target: { id: targetId, ...targetDisplay },
      action: normalizedAction,
      reason: normalizedReason,
      staff: {
        id: token.discordId,
        tag: token.username || 'Staff',
      },
      timestamp: new Date().toISOString(),
      botOnline: normalizedAction === 'accepted',
    });
  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Verification rejected due to an internal error.', reason: message },
      { status: 500 }
    );
  }
}
