import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseServer } from '@/lib/supabase';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { getDevLogs } from '@/lib/dev-mocks';

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));

  if (isDevBypassToken(token)) {
    const action = req.nextUrl.searchParams.get('action') || 'all';
    const staffId = req.nextUrl.searchParams.get('staffId') || '';
    return NextResponse.json(getDevLogs(page, action, staffId));
  }
  const action = req.nextUrl.searchParams.get('action') || 'all';
  const staffId = req.nextUrl.searchParams.get('staffId') || '';
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabaseServer
    .from('logs')
    .select('*', { count: 'exact' })
    .order('timestamp', { ascending: false });

  if (action !== 'all') query = query.eq('action', action);
  if (staffId) query = query.eq('staff_id', staffId);

  const { data, count, error } = await query.range(from, to);
  if (error) return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 });

  const staffRes = await supabaseServer.from('logs').select('staff_id, staff_tag');
  const staffMap = new Map<string, string>();
  for (const row of staffRes.data || []) {
    if (!staffMap.has(row.staff_id)) staffMap.set(row.staff_id, row.staff_tag);
  }

  return NextResponse.json({
    logs: data || [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    staffOptions: Array.from(staffMap.entries()).map(([id, tag]) => ({ id, tag })),
  });
}
