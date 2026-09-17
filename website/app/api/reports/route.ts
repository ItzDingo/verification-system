import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseServer } from '@/lib/supabase';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { devSubmitReport } from '@/lib/dev-mocks';

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { category, message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  if (isDevBypassToken(token)) {
    devSubmitReport(category, message.trim(), {
      id: token.discordId as string,
      name: (token.username as string) || (token.globalName as string) || 'Staff',
    });
    return NextResponse.json({ success: true, message: 'Report submitted (dev mock — no Discord DM).', devMock: true });
  }

  const { error } = await supabaseServer.from('reports').insert({
    reporter_id: token.discordId,
    reporter_name: token.username || token.globalName || 'Staff',
    category: category || 'general',
    message: message.trim(),
    status: 'open',
  });

  if (error) {
    console.error('[Reports]', error);
    return NextResponse.json({ error: 'Failed to submit report. Ensure the reports table exists.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Report submitted. The owner will be notified.' });
}
