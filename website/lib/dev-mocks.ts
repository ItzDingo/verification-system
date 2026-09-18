import { DEV_BYPASS_USER } from '@/lib/dev-bypass';

const embed = (index: number) => `https://cdn.discordapp.com/embed/avatars/${index % 6}.png`;

export interface DevPendingUser {
  discord_id: string;
  username: string;
  global_name: string | null;
  avatar: string;
  joined_at: string;
}

export interface DevMember extends DevPendingUser {
  roles: string[];
  is_verified: boolean;
}

export interface DevLog {
  id: number;
  target_id: string;
  target_username: string;
  staff_id: string;
  staff_tag: string;
  action: string;
  reason: string;
  timestamp: string;
}

export interface DevBlacklistEntry {
  user_id: string;
  reason: string;
  blacklisted_by: string;
  active: boolean;
  displayName: string;
  username: string;
  avatar: string;
}

const now = Date.now();
const ago = (hours: number) => new Date(now - hours * 3600_000).toISOString();

const initialPending: DevPendingUser[] = [
  { discord_id: '111111111111111111', username: 'nova_rider', global_name: 'Nova Rider', avatar: embed(1), joined_at: ago(2) },
  { discord_id: '222222222222222222', username: 'pixel_echo', global_name: 'Pixel Echo', avatar: embed(2), joined_at: ago(5) },
  { discord_id: '333333333333333333', username: 'ghostline', global_name: null, avatar: embed(3), joined_at: ago(12) },
  { discord_id: '444444444444444444', username: 'arcade_kid', global_name: 'Arcade Kid', avatar: embed(4), joined_at: ago(24) },
];

const initialVerified: DevMember[] = [
  { discord_id: '555555555555555555', username: 'verified_one', global_name: 'Verified One', avatar: embed(0), joined_at: ago(72), roles: ['verified'], is_verified: true },
  { discord_id: '666666666666666666', username: 'trusted_user', global_name: 'Trusted User', avatar: embed(5), joined_at: ago(120), roles: ['verified'], is_verified: true },
];

let pendingUsers = [...initialPending];
let verifiedMembers = [...initialVerified];
let logs: DevLog[] = [
  { id: 1, target_id: '555555555555555555', target_username: 'verified_one', staff_id: DEV_BYPASS_USER.discordId, staff_tag: DEV_BYPASS_USER.username, action: 'accepted', reason: 'Met server rules', timestamp: ago(48) },
  { id: 2, target_id: '777777777777777777', target_username: 'old_spammer', staff_id: DEV_BYPASS_USER.discordId, staff_tag: DEV_BYPASS_USER.username, action: 'denied', reason: 'Suspicious account age', timestamp: ago(36) },
  { id: 3, target_id: '888888888888888888', target_username: 'bad_actor', staff_id: DEV_BYPASS_USER.discordId, staff_tag: DEV_BYPASS_USER.username, action: 'blacklisted', reason: 'Repeated ban evasion', timestamp: ago(20) },
];
let blacklist: DevBlacklistEntry[] = [
  { user_id: '888888888888888888', reason: 'Repeated ban evasion', blacklisted_by: DEV_BYPASS_USER.discordId, active: true, displayName: 'Bad Actor', username: 'bad_actor', avatar: embed(2) },
];
let staffStats = { staff_id: DEV_BYPASS_USER.discordId, accepted: 12, denied: 3 };
let nextLogId = 4;

function hourBuckets(seed: number[]) {
  const labels = Array.from({ length: 24 }, (_, i) => {
    const h = i % 12 || 12;
    return `${h} ${i < 12 ? 'AM' : 'PM'}`;
  });
  return seed.map((count, hour) => ({ hour, label: labels[hour], count }));
}

function dayBuckets(seed: number[]) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return seed.map((count, day) => ({ day, label: labels[day], count }));
}

export function getDevUnverified() {
  return [...pendingUsers];
}

export function getDevMembers(): DevMember[] {
  return [...pendingUsers.map((u) => ({ ...u, roles: [], is_verified: false })), ...verifiedMembers];
}

export function getDevStats() {
  const accepted = logs.filter((l) => l.action === 'accepted').length;
  const denied = logs.filter((l) => l.action === 'denied').length;
  return {
    verified: verifiedMembers.length,
    pending: pendingUsers.length,
    blacklisted: blacklist.filter((b) => b.active).length,
    totalActions: logs.length,
    accepted,
    denied,
    todayActions: logs.filter((l) => new Date(l.timestamp) >= new Date(new Date().setHours(0, 0, 0, 0))).length,
    botOnline: true,
    botLatencyMs: 42,
  };
}

export function getDevLeaderboard() {
  const total = staffStats.accepted + staffStats.denied;
  return [
    {
      staffId: staffStats.staff_id,
      displayName: DEV_BYPASS_USER.globalName,
      username: DEV_BYPASS_USER.username,
      avatar: DEV_BYPASS_USER.avatar,
      accepted: staffStats.accepted,
      denied: staffStats.denied,
      total,
    },
    {
      staffId: '101010101010101010',
      displayName: 'Senior Mod',
      username: 'senior_mod',
      avatar: embed(1),
      accepted: 28,
      denied: 5,
      total: 33,
    },
    {
      staffId: '121212121212121212',
      displayName: 'Night Owl',
      username: 'night_owl',
      avatar: embed(4),
      accepted: 19,
      denied: 2,
      total: 21,
    },
    {
      staffId: '131313131313131313',
      displayName: 'Gate Keeper',
      username: 'gate_keeper',
      avatar: embed(3),
      accepted: 8,
      denied: 4,
      total: 12,
    },
  ].sort((a, b) => b.total - a.total || b.accepted - a.accepted);
}

export function getDevLogs(page: number, action: string, staffId: string) {
  let filtered = [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (action !== 'all') filtered = filtered.filter((l) => l.action === action);
  if (staffId) filtered = filtered.filter((l) => l.staff_id === staffId);

  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const slice = filtered.slice(from, from + pageSize);
  const staffMap = new Map<string, string>();
  for (const row of logs) {
    if (!staffMap.has(row.staff_id)) staffMap.set(row.staff_id, row.staff_tag);
  }

  return {
    logs: slice,
    total: filtered.length,
    page,
    pageSize,
    totalPages: Math.ceil(filtered.length / pageSize) || 1,
    staffOptions: Array.from(staffMap.entries()).map(([id, tag]) => ({ id, tag })),
  };
}

export function getDevVerifiedUsers(page: number, search: string) {
  const pageSize = 15;
  let users = verifiedMembers.map((u) => ({
    discordId: u.discord_id,
    username: u.username,
    displayName: u.global_name || u.username,
    avatar: u.avatar,
    verifiedBy: DEV_BYPASS_USER.discordId,
    verifiedAt: ago(24),
    reason: 'Verified in dev mock',
    verifiedUntil: null as string | null,
    durationLabel: 'Permanent',
  }));

  if (search) {
    users = users.filter(
      (u) =>
        u.username.toLowerCase().includes(search) ||
        u.displayName.toLowerCase().includes(search) ||
        u.discordId.includes(search)
    );
  }

  const from = (page - 1) * pageSize;
  const slice = users.slice(from, from + pageSize);

  return {
    users: slice,
    total: users.length,
    page,
    pageSize,
    totalPages: Math.ceil(users.length / pageSize) || 1,
  };
}

export function getDevServerStats() {
  const verificationsByHour = hourBuckets([0, 0, 0, 1, 2, 4, 6, 8, 12, 10, 7, 5, 4, 6, 8, 9, 11, 14, 10, 6, 3, 2, 1, 0]);
  const requestsByHour = hourBuckets([0, 0, 1, 1, 2, 3, 5, 7, 9, 11, 8, 6, 5, 7, 8, 10, 12, 15, 11, 7, 4, 2, 1, 0]);
  const activityByHour = verificationsByHour.map((v, i) => ({
    ...v,
    count: v.count + requestsByHour[i].count,
  }));

  const peak = <T extends { count: number }>(items: T[]) =>
    items.reduce((best, cur) => (cur.count > best.count ? cur : best), items[0]);

  return {
    periodDays: 30,
    totals: { verifications: 42, requests: 68, denied: 3 },
    peakVerificationHour: peak(verificationsByHour),
    peakRequestHour: peak(requestsByHour),
    peakActivityHour: peak(activityByHour),
    peakVerificationDay: peak(dayBuckets([2, 8, 12, 10, 9, 6, 5])),
    peakRequestDay: peak(dayBuckets([3, 10, 14, 11, 9, 7, 6])),
    verificationsByHour,
    requestsByHour,
    activityByHour,
    verificationsByDay: dayBuckets([2, 8, 12, 10, 9, 6, 5]),
    requestsByDay: dayBuckets([3, 10, 14, 11, 9, 7, 6]),
  };
}

export function getDevBlacklist() {
  return blacklist.filter((b) => b.active);
}

export function devVerifyAction(
  targetId: string,
  action: 'accepted' | 'denied',
  reason: string,
  staff: { id: string; tag: string }
) {
  const pending = pendingUsers.find((u) => u.discord_id === targetId);
  const username = pending?.username || `user_${targetId.slice(-4)}`;
  const displayName = pending?.global_name || username;
  const avatar = pending?.avatar || embed(0);

  logs.unshift({
    id: nextLogId++,
    target_id: targetId,
    target_username: username,
    staff_id: staff.id,
    staff_tag: staff.tag,
    action,
    reason,
    timestamp: new Date().toISOString(),
  });

  if (action === 'accepted') {
    staffStats.accepted += 1;
    pendingUsers = pendingUsers.filter((u) => u.discord_id !== targetId);
    if (!verifiedMembers.some((u) => u.discord_id === targetId)) {
      verifiedMembers.unshift({
        discord_id: targetId,
        username,
        global_name: displayName,
        avatar,
        joined_at: pending?.joined_at || new Date().toISOString(),
        roles: ['verified'],
        is_verified: true,
      });
    }
  } else {
    staffStats.denied += 1;
    pendingUsers = pendingUsers.filter((u) => u.discord_id !== targetId);
  }

  return { username, displayName, avatar };
}

export function devBlacklistAction(userId: string, action: 'add' | 'remove', reason: string, by: string) {
  if (action === 'add') {
    const entry: DevBlacklistEntry = {
      user_id: userId,
      reason,
      blacklisted_by: by,
      active: true,
      displayName: `User ${userId.slice(-4)}`,
      username: `user_${userId.slice(-4)}`,
      avatar: embed(3),
    };
    blacklist = blacklist.filter((b) => b.user_id !== userId);
    blacklist.push(entry);
    logs.unshift({
      id: nextLogId++,
      target_id: userId,
      target_username: entry.username,
      staff_id: by,
      staff_tag: DEV_BYPASS_USER.username,
      action: 'blacklisted',
      reason,
      timestamp: new Date().toISOString(),
    });
  } else {
    blacklist = blacklist.map((b) => (b.user_id === userId ? { ...b, active: false } : b));
    logs.unshift({
      id: nextLogId++,
      target_id: userId,
      target_username: `user_${userId.slice(-4)}`,
      staff_id: by,
      staff_tag: DEV_BYPASS_USER.username,
      action: 'unblacklisted',
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}

export function devSubmitReport(category: string, message: string, reporter: { id: string; name: string }) {
  return {
    id: nextLogId++,
    category,
    message,
    reporter_id: reporter.id,
    reporter_name: reporter.name,
    status: 'open',
    created_at: new Date().toISOString(),
  };
}
