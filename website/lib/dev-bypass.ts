/** Local testing only — never enable in production. */

export const DEV_BYPASS_USER = {
  discordId: '999999999999999999',
  username: 'dev_staff',
  globalName: 'Dev Staff',
  avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
  highestRole: 'Staff (local dev)',
  roleColor: 0x5865f2,
} as const;

export function isDevBypassConfigured(): boolean {
  return process.env.DEV_BYPASS_AUTH === 'true';
}

export function isDevAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && isDevBypassConfigured();
}

export function isDevBypassToken(
  token: { isDevBypass?: boolean; discordId?: string | null } | null | undefined
): boolean {
  if (!isDevAuthBypassEnabled() || !token?.discordId) return false;
  return token.isDevBypass === true || token.discordId === DEV_BYPASS_USER.discordId;
}
