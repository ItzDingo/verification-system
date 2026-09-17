require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AuditLogEvent,
  PermissionFlagsBits
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages
  ]
});

const OWNER_ID       = process.env.OWNER_DISCORD_ID;
const GUILD_ID       = process.env.GUILD_ID;
const BLACKLIST_ROLE = process.env.BLACKLIST_ROLE_ID;
const VERIFIED_ROLE  = process.env.VERIFIED_ROLE_ID;
const STAFF_ROLE     = process.env.STAFF_ROLE_ID;

// ─── Protected role registry ──────────────────────────────────────────────────
// Add any new protected role here — nowhere else in the code needs to change.
const PROTECTED_ROLES = {
  [VERIFIED_ROLE]:  { protectAdd: true,  protectRemove: true },
  [BLACKLIST_ROLE]: { protectAdd: true,  protectRemove: true },
  [STAFF_ROLE]:     { protectAdd: true,  protectRemove: true },
};

console.log(`[Config] Guild:          ${GUILD_ID}`);
console.log(`[Config] Verified Role:  ${VERIFIED_ROLE}`);
console.log(`[Config] Blacklist Role: ${BLACKLIST_ROLE}`);
console.log(`[Config] Staff Role:     ${STAFF_ROLE}`);

// ─── Counter-based bot-action tracker ────────────────────────────────────────
//
// WHY COUNTERS INSTEAD OF TTL FLAGS:
// A TTL flag stays true for N seconds after a bot-initiated role change.
// If an admin re-adds the same role within that window, isBotAction() returns
// true and the bot silently skips it — the role sticks. A counter fixes this:
// each expected Discord event decrements the counter by exactly 1. Once all
// expected events have fired the counter returns to 0, so the very next change
// (even 1 ms later) is treated as a fresh, potentially unauthorized, event.
//
// Key format: `${userId}_${roleId}`

const botActionCounters = new Map();

function markBotAction(userId, roleId) {
  const key = `${userId}_${roleId}`;
  botActionCounters.set(key, (botActionCounters.get(key) || 0) + 1);

  // Safety drain: if Discord never fires the resulting guildMemberUpdate
  // (network issue, rate-limit drop, etc.) the counter won't block future
  // detections forever.
  setTimeout(() => {
    if ((botActionCounters.get(key) || 0) > 0) {
      console.warn(`[BotActions] Safety drain for ${key} — Discord event never arrived`);
      botActionCounters.delete(key);
    }
  }, 20000);
}

// Returns true (and consumes one credit) if this event was caused by the bot.
// Repeated manual re-additions are never skipped because each one decrements
// the counter independently.
function consumeBotAction(userId, roleId) {
  const key   = `${userId}_${roleId}`;
  const count = botActionCounters.get(key) || 0;
  if (count <= 0) return false;
  if (count === 1) botActionCounters.delete(key);
  else botActionCounters.set(key, count - 1);
  return true;
}

// Tracks pending web-portal verifications to prevent double-apply
const pendingWebVerify = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function dmUser(user, embed) {
  try {
    await user.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

// Fetch audit logs and find the entry matching a specific user + role set.
// Retries up to `retries` times so simultaneous violations don't miss each
// other in a small log window.
async function findAuditEntry(guild, userId, roleIds, {
  delay    = 1500,
  retries  = 2,
  windowMs = 20000,
} = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Always wait before fetching — audit logs are async on Discord's side
    await new Promise(res => setTimeout(res, attempt === 0 ? delay : 1500));

    let logs;
    try {
      logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 25 });
    } catch (err) {
      console.error(`[AuditLog] Fetch error (attempt ${attempt + 1}):`, err.message);
      continue;
    }

    const entry = logs.entries.find(e => {
      if (e.target?.id !== userId) return false;
      if (Date.now() - e.createdTimestamp > windowMs) return false;

      // Match against the SPECIFIC roles affected — not just any entry for this user.
      // This is critical under load: multiple members changing roles simultaneously
      // will all appear in the log; we must pick the right entry per member per role.
      const changes = e.changes || [];
      return changes.some(change =>
        (change.key === '$add' || change.key === '$remove') &&
        Array.isArray(change.new) &&
        change.new.some(r => roleIds.includes(r.id))
      );
    });

    if (entry) {
      console.log(`[AuditLog] Match found on attempt ${attempt + 1} — executor: ${entry.executor?.username}`);
      return entry;
    }

    console.log(`[AuditLog] No match on attempt ${attempt + 1}/${retries + 1} for user ${userId}`);
  }

  return null;
}

// ─── clientReady ──────────────────────────────────────────────────────────────

client.on('clientReady', async () => {
  console.log(`🟢 Bot ready: ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);

  if (!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
    console.warn('⚠️  CRITICAL: Bot is missing "View Audit Log" permission!');
  }

  // ── Supabase realtime: sync verification status from web portal ─────────────
  supabase
    .channel('verification-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async (payload) => {
      const newUser = payload.new;
      if (!newUser) return;

      // ── verified = true → grant Verified role ──────────────────────────────
      if (newUser.verified === true) {
        const key = `web_verify_${newUser.discord_id}`;
        if (pendingWebVerify.has(key)) return;
        pendingWebVerify.set(key, Date.now());
        setTimeout(() => pendingWebVerify.delete(key), 10000);

        console.log(`✅ DB: User ${newUser.discord_id} marked verified`);
        try {
          const member = await guild.members.fetch(newUser.discord_id).catch(() => null);
          if (!member) return;

          if (!member.roles.cache.has(VERIFIED_ROLE)) {
            markBotAction(member.id, VERIFIED_ROLE);
            await member.roles.add(VERIFIED_ROLE, 'Verified via Web Portal');
            console.log(`  ✔ Added Verified to ${member.user.username}`);

            let staffName   = 'Staff Team';
            let staffAvatar = null;
            if (newUser.verified_by) {
              const staffMember = await guild.members.fetch(newUser.verified_by).catch(() => null);
              if (staffMember) {
                staffName   = staffMember.displayName || staffMember.user.username;
                staffAvatar = staffMember.displayAvatarURL({ dynamic: true, size: 1024 });
              }
            }

            await dmUser(member.user, new EmbedBuilder()
              .setTitle('✅ Verification Successful!')
              .setDescription(`Welcome to **${guild.name}**! You have been verified.`)
              .setColor('#00ff00')
              .setTimestamp()
              .setFooter({ text: `Verified by: ${staffName}`, iconURL: staffAvatar || undefined })
            );
          }
        } catch (err) {
          console.error('[Supabase] Error applying verification:', err);
        }
      }

      // ── verified = false → revoke Verified role ────────────────────────────
      if (newUser.verified === false) {
        const key = `web_unverify_${newUser.discord_id}`;
        if (pendingWebVerify.has(key)) return;
        pendingWebVerify.set(key, Date.now());
        setTimeout(() => pendingWebVerify.delete(key), 10000);

        console.log(`❌ DB: User ${newUser.discord_id} marked un-verified`);
        try {
          const member = await guild.members.fetch(newUser.discord_id).catch(() => null);
          if (!member) return;

          if (member.roles.cache.has(VERIFIED_ROLE)) {
            markBotAction(member.id, VERIFIED_ROLE);
            await member.roles.remove(VERIFIED_ROLE, 'Un-verified via Web Portal');
            console.log(`  ✔ Removed Verified from ${member.user.username}`);

            await dmUser(member.user, new EmbedBuilder()
              .setTitle('❌ Verification Revoked')
              .setDescription(
                `Your verification in **${guild.name}** has been revoked.\n\n` +
                `⚠️ If this is a mistake, open a ticket in #tickets.`
              )
              .setColor('#ff4444')
              .setTimestamp()
            );
          }
        } catch (err) {
          console.error('[Supabase] Error revoking verification:', err);
        }
      }
    })
    .subscribe();
});

// ─── guildMemberUpdate — Role Protection ──────────────────────────────────────

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (newMember.guild.id !== GUILD_ID || newMember.user.bot) return;

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  // ── Diff roles and classify violations ───────────────────────────────────

  const toRevoke  = []; // added without permission → must be stripped
  const toRestore = []; // removed without permission → must be restored

  for (const [roleId, config] of Object.entries(PROTECTED_ROLES)) {
    const wasPresent = oldRoles.has(roleId);
    const isPresent  = newRoles.has(roleId);

    if (!wasPresent && isPresent && config.protectAdd) {
      if (consumeBotAction(newMember.id, roleId)) {
        console.log(`[Security] Bot-initiated ADD consumed for ${roleId} / ${newMember.user.username}`);
        continue;
      }
      const role = newMember.guild.roles.cache.get(roleId);
      if (role) toRevoke.push(role);
    }

    if (wasPresent && !isPresent && config.protectRemove) {
      if (consumeBotAction(newMember.id, roleId)) {
        console.log(`[Security] Bot-initiated REMOVE consumed for ${roleId} / ${newMember.user.username}`);
        continue;
      }
      const role = newMember.guild.roles.cache.get(roleId);
      if (role) toRestore.push(role);
    }
  }

  if (toRevoke.length === 0 && toRestore.length === 0) return;

  const username = newMember.user.username;
  console.log(`[Security] ⚠️  Violation — ${username} (${newMember.id})`);
  console.log(`  Revoking:  [${toRevoke.map(r  => r.name).join(', ') || 'none'}]`);
  console.log(`  Restoring: [${toRestore.map(r => r.name).join(', ') || 'none'}]`);

  // ── PHASE 1: Revert immediately ───────────────────────────────────────────
  //
  // Mark bot actions BEFORE the API calls. This guarantees the counter is
  // already incremented by the time Discord fires the resulting
  // guildMemberUpdate events (which can arrive in under 100ms).
  //
  // Both remove() and add() accept role arrays — one API call each, fully
  // parallel via Promise.all, and NOT awaited in this handler so it returns
  // as fast as possible regardless of how many members are being processed.

  const revertPromises = [];

  if (toRevoke.length > 0) {
    for (const role of toRevoke) markBotAction(newMember.id, role.id);
    revertPromises.push(
      newMember.roles.remove(toRevoke, 'Security: unauthorized assignment')
        .then(() => console.log(`[Security] ✔ Revoked [${toRevoke.map(r => r.name).join(', ')}] from ${username}`))
        .catch(err => console.error(`[Security] ✘ Revoke failed for ${username}:`, err.message))
    );
  }

  if (toRestore.length > 0) {
    for (const role of toRestore) markBotAction(newMember.id, role.id);
    revertPromises.push(
      newMember.roles.add(toRestore, 'Security: role restored')
        .then(() => console.log(`[Security] ✔ Restored [${toRestore.map(r => r.name).join(', ')}] to ${username}`))
        .catch(err => console.error(`[Security] ✘ Restore failed for ${username}:`, err.message))
    );
  }

  Promise.all(revertPromises); // fire-and-forget: handler returns immediately

  // ── PHASE 2: Identify executor and warn (fully async) ─────────────────────
  //
  // Runs independently in its own async IIFE. The roles are already being
  // fixed above. This block only figures out who to blame and sends DMs.
  //
  // findAuditEntry() matches by BOTH user ID AND the specific role IDs so
  // simultaneous violations across many members don't cross-contaminate.

  const affectedRoleIds = [...toRevoke, ...toRestore].map(r => r.id);
  const guild           = newMember.guild;
  const memberId        = newMember.id;
  const allAffected     = [...toRevoke, ...toRestore];

  (async () => {
    try {
      const entry    = await findAuditEntry(guild, memberId, affectedRoleIds);
      const executor = entry?.executor;

      if (!executor) {
        console.warn(`[Security] Executor not found for ${username} — roles reverted, no DM sent.`);
        return;
      }

      if (executor.id === client.user.id || executor.id === OWNER_ID) {
        console.log(`[Security] Executor is bot/owner (${executor.username}) — warnings skipped.`);
        return;
      }

      const actionSummary = [
        ...toRevoke.map(r  => `added **${r.name}**`),
        ...toRestore.map(r => `removed **${r.name}**`),
      ].join(', ');

      // ── DM the executor ──────────────────────────────────────────────────
      const executorDmSent = await dmUser(executor, new EmbedBuilder()
        .setTitle('🚫 Prohibited Action Detected')
        .setDescription(
          `You manually ${actionSummary} on <@${memberId}>.\n\n` +
          `These roles are **system-controlled** and cannot be assigned or removed manually.\n` +
          `All ${allAffected.length} change(s) have been **immediately reverted**.\n\n` +
          `⚠️ If you believe this is a mistake, please open a ticket in #tickets.`
        )
        .setColor('#ff0000')
        .setTimestamp()
        .setFooter({ text: 'Unauthorized Role Management' })
      );

      console.log(`[Security] Executor DM → ${executor.username}: ${executorDmSent ? 'delivered' : 'failed (DMs closed)'}`);

      // ── DM the owner ─────────────────────────────────────────────────────
      const owner = await client.users.fetch(OWNER_ID).catch(() => null);
      if (owner) {
        const ownerDmSent = await dmUser(owner, new EmbedBuilder()
          .setTitle('🔔 Security Alert — Unauthorized Role Change')
          .addFields(
            { name: 'Executor',       value: `<@${executor.id}> (\`${executor.username}\`)`,      inline: true  },
            { name: 'Target Member',  value: `<@${memberId}> (\`${username}\`)`,                  inline: true  },
            { name: 'Action',         value: actionSummary,                                        inline: false },
            { name: 'Roles Affected', value: allAffected.map(r => `\`${r.name}\``).join(', '),    inline: false },
            { name: 'Status',         value: '✅ All changes automatically reverted',              inline: false },
          )
          .setColor('#ff6600')
          .setTimestamp()
          .setFooter({ text: 'Role Protection System' })
        );

        console.log(`[Security] Owner DM: ${ownerDmSent ? 'delivered' : 'failed (DMs closed)'}`);
      } else {
        console.warn('[Security] Could not fetch owner for alert DM.');
      }

    } catch (err) {
      console.error('[Security] Async warning block error:', err);
    }
  })();
});

// ─── Health Check Server (keeps bot alive on Render) ─────────────────────────

const http = require('http');
const port = process.env.PORT || 8080;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is alive!');
}).listen(port, '0.0.0.0', () => {
  console.log(`🟢 Health check server listening on port ${port}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
