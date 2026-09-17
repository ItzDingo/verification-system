import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { supabaseServer } from '@/lib/supabase';
import { isDevBypassToken } from '@/lib/dev-bypass';
import { getDevServerStats } from '@/lib/dev-mocks';

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return `${h} ${ampm}`;
});

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function bucketByHour(timestamps: string[]) {
  const buckets = new Array(24).fill(0);
  for (const ts of timestamps) {
    const hour = new Date(ts).getHours();
    buckets[hour]++;
  }
  return buckets.map((count, hour) => ({ hour, label: HOUR_LABELS[hour], count }));
}

function bucketByDay(timestamps: string[]) {
  const buckets = new Array(7).fill(0);
  for (const ts of timestamps) {
    buckets[new Date(ts).getDay()]++;
  }
  return buckets.map((count, day) => ({ day, label: DAY_LABELS[day], count }));
}

function peak<T extends { count: number }>(items: T[]): T | null {
  if (!items.length) return null;
  return items.reduce((best, cur) => (cur.count > best.count ? cur : best));
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.discordId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (isDevBypassToken(token)) {
    return NextResponse.json(getDevServerStats());
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [logsRes, requestsRes] = await Promise.all([
    supabaseServer
      .from('logs')
      .select('timestamp, action')
      .gte('timestamp', thirtyDaysAgo.toISOString()),
    supabaseServer
      .from('verify_requests')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString()),
  ]);

  const logs = logsRes.data || [];
  const requests = requestsRes.data || [];

  const verificationTimestamps = logs
    .filter((l) => l.action === 'accepted')
    .map((l) => l.timestamp as string);

  const requestTimestamps = requests.map((r) => r.created_at as string);
  const allActivity = [...verificationTimestamps, ...requestTimestamps];

  const verificationsByHour = bucketByHour(verificationTimestamps);
  const requestsByHour = bucketByHour(requestTimestamps);
  const activityByHour = bucketByHour(allActivity);
  const verificationsByDay = bucketByDay(verificationTimestamps);
  const requestsByDay = bucketByDay(requestTimestamps);

  return NextResponse.json({
    periodDays: 30,
    totals: {
      verifications: verificationTimestamps.length,
      requests: requestTimestamps.length,
      denied: logs.filter((l) => l.action === 'denied').length,
    },
    peakVerificationHour: peak(verificationsByHour),
    peakRequestHour: peak(requestsByHour),
    peakActivityHour: peak(activityByHour),
    peakVerificationDay: peak(verificationsByDay),
    peakRequestDay: peak(requestsByDay),
    verificationsByHour,
    requestsByHour,
    activityByHour,
    verificationsByDay,
    requestsByDay,
  });
}
