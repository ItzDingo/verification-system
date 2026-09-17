export interface BotHealthResult {
  online: boolean;
  latencyMs?: number;
  error?: string;
  status?: string;
}

export interface BotWakeResult extends BotHealthResult {
  wokeUp: boolean;
  attempts: number;
  durationMs: number;
}

const DEFAULT_WAKE_MS = 15_000;
const DEFAULT_POLL_MS = 2_000;

function getBotHealthUrl(): string | null {
  const url = process.env.BOT_HEALTH_URL?.trim();
  return url || null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkBotHealth(timeoutMs = 5000): Promise<BotHealthResult> {
  const url = getBotHealthUrl();
  if (!url) {
    return { online: false, error: 'BOT_HEALTH_URL is not configured' };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    if (!res.ok) {
      let status = 'starting';
      try {
        const body = await res.json();
        status = body.status || status;
      } catch {
        /* ignore */
      }
      return {
        online: false,
        latencyMs,
        status,
        error: res.status === 503 ? 'Bot is waking up (cold start)' : `Bot returned HTTP ${res.status}`,
      };
    }

    let body: { status?: string } = {};
    try {
      body = await res.json();
    } catch {
      /* plain text health endpoint is fine */
    }

    if (body.status && body.status !== 'ok') {
      return { online: false, latencyMs, status: body.status, error: 'Bot reported unhealthy status' };
    }

    return { online: true, latencyMs, status: body.status || 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { online: false, error: `Bot unreachable: ${message}` };
  }
}

/** Ping Render (or any host) and poll until the bot responds ready — up to ~15s. */
export async function wakeBotAndWait(options?: {
  maxWaitMs?: number;
  pollIntervalMs?: number;
}): Promise<BotWakeResult> {
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_WAKE_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_MS;
  const url = getBotHealthUrl();

  if (!url) {
    return {
      online: false,
      wokeUp: false,
      attempts: 0,
      durationMs: 0,
      error: 'BOT_HEALTH_URL is not configured',
    };
  }

  const started = Date.now();
  let attempts = 0;
  let lastError = 'Bot offline';
  let wasEverOnline = false;

  // Fire-and-forget wake ping (Render cold start)
  void fetch(url, { cache: 'no-store' }).catch(() => {});

  while (Date.now() - started < maxWaitMs) {
    attempts += 1;
    const health = await checkBotHealth(8000);

    if (health.online) {
      return {
        ...health,
        wokeUp: !wasEverOnline && attempts > 1,
        attempts,
        durationMs: Date.now() - started,
      };
    }

    wasEverOnline = false;
    lastError = health.error || 'Bot is not ready yet';
    await sleep(pollIntervalMs);
  }

  return {
    online: false,
    wokeUp: false,
    attempts,
    durationMs: Date.now() - started,
    error: lastError || 'Bot did not respond within 15 seconds',
  };
}
