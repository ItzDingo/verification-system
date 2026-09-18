require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AuditLogEvent,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
  ]
});

const OWNER_ID = process.env.OWNER_DISCORD_ID;
const GUILD_ID = process.env.GUILD_ID;
const BLACKLIST_ROLE = process.env.BLACKLIST_ROLE_ID;
const VERIFIED_ROLE = process.env.VERIFIED_ROLE_ID;
const STAFF_ROLE = process.env.STAFF_ROLE_ID;
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://verification-system-plum.vercel.app/';
// Big banner GIF shown in the verification panel embed. Override via env var
// without touching code — any direct .gif/.png/.jpg link (e.g. a Tenor/Giphy
// "media" link, or a link to an image hosted on Discord/Imgur) works.
const VERIFY_PANEL_GIF = process.env.VERIFY_PANEL_GIF_URL
  || 'https://cdn.discordapp.com/attachments/1542010309886353428/1550193732844785664/standard_3.gif?ex=6aad71eb&is=6aac206b&hm=f0da2d85bebeddfd0f58ade94d0bc234add5d28a558013828ef0bfb52bf343ad&';

// ─── Protected role registry ──────────────────────────────────────────────────
const PROTECTED_ROLES = {
  [VERIFIED_ROLE]: { protectAdd: true, protectRemove: true },
  [BLACKLIST_ROLE]: { protectAdd: true, protectRemove: true },
  [STAFF_ROLE]: { protectAdd: true, protectRemove: true },
};

console.log(`[Config] Guild:          ${GUILD_ID}`);
console.log(`[Config] Verified Role:  ${VERIFIED_ROLE}`);
console.log(`[Config] Blacklist Role: ${BLACKLIST_ROLE}`);
console.log(`[Config] Staff Role:     ${STAFF_ROLE}`);
console.log(`[Config] Website:        ${WEBSITE_URL}`);

// ─── Counter-based bot-action tracker ────────────────────────────────────────
// Uses a counter per userId+roleId so admin re-adds after a bot revert are
// never silently skipped. Each mark() increments; each consume() decrements
// by exactly 1 and returns true only if there was a credit.

const botActionCounters = new Map();

function markBotAction(userId, roleId) {
  const key = `${userId}_${roleId}`;
  botActionCounters.set(key, (botActionCounters.get(key) || 0) + 1);
  // Safety drain if Discord never fires the resulting event
  setTimeout(() => {
    if ((botActionCounters.get(key) || 0) > 0) {
      console.warn(`[BotActions] Safety drain for ${key}`);
      botActionCounters.delete(key);
    }
  }, 20000);
}

function consumeBotAction(userId, roleId) {
  const key = `${userId}_${roleId}`;
  const count = botActionCounters.get(key) || 0;
  if (count <= 0) return false;
  if (count === 1) botActionCounters.delete(key);
  else botActionCounters.set(key, count - 1);
  return true;
}

// ─── Flagged executor role store ──────────────────────────────────────────────
// When an executor is flagged their roles are stripped and stored here so the
// owner can restore them via the Revoke button.
// Key: executorUserId, Value: string[] of role IDs

const flaggedUserRoles = new Map();

// Pending web-portal verification dedup
const pendingWebVerify = new Map();

// Verification button cooldowns — key: userId, value: last-request timestamp
const verificationCooldowns = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function dmUser(user, payload) {
  try {
    // payload can be an EmbedBuilder (plain embed) or a full message options object
    const options = payload instanceof EmbedBuilder
      ? { embeds: [payload] }
      : payload;
    await user.send(options);
    return true;
  } catch {
    return false;
  }
}

// Strip ALL removable roles from a member (excludes @everyone and bot-managed).
// Returns the array of stripped role IDs so they can be restored later.
async function stripAllRoles(member) {
  const removable = member.roles.cache.filter(r =>
    r.id !== member.guild.id && // not @everyone
    !r.managed                  // not a bot/integration managed role
  );

  if (removable.size === 0) return [];

  const roleIds = removable.map(r => r.id);

  // Mark each as a bot action so the security handler ignores the event
  for (const roleId of roleIds) markBotAction(member.id, roleId);

  try {
    await member.roles.set(
      [member.guild.id],
      'Security: flagged executor — all roles stripped'
    );
    console.log(`[Security] Stripped ${removable.size} roles from ${member.user.username}`);
    return roleIds;
  } catch (err) {
    console.error(`[Security] Failed to strip roles from ${member.user.username}:`, err.message);
    // Clean up marks on failure
    for (const roleId of roleIds) consumeBotAction(member.id, roleId);
    return [];
  }
}

// Restore previously stripped roles to a member.
async function restoreRoles(member, roleIds) {
  const validRoles = roleIds.filter(id => member.guild.roles.cache.has(id));
  if (validRoles.length === 0) return;

  for (const roleId of validRoles) markBotAction(member.id, roleId);

  try {
    await member.roles.set(
      [...validRoles, member.guild.id],
      'Security: owner revoked flag — roles restored'
    );
    console.log(`[Security] Restored ${validRoles.length} roles to ${member.user.username}`);
  } catch (err) {
    console.error(`[Security] Failed to restore roles for ${member.user.username}:`, err.message);
    for (const roleId of validRoles) consumeBotAction(member.id, roleId);
  }
}

// ─── Audit log helpers ────────────────────────────────────────────────────────

// Short blocking fetch used at the top of guildMemberUpdate to check for the
// owner BEFORE any revert happens. Blocks for delayMs then does one fetch.
async function quickAuditExecutor(guild, userId, roleIds, delayMs = 700) {
  try {
    await new Promise(res => setTimeout(res, delayMs));
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 25 });
    const entry = logs.entries.find(e => {
      if (e.target?.id !== userId) return false;
      if (Date.now() - e.createdTimestamp > 12000) return false;
      return (e.changes || []).some(c =>
        (c.key === '$add' || c.key === '$remove') &&
        Array.isArray(c.new) &&
        c.new.some(r => roleIds.includes(r.id))
      );
    });
    return entry?.executor ?? null;
  } catch (err) {
    console.error('[AuditLog] Quick fetch error:', err.message);
    return null;
  }
}

// Full retry fetch used after the revert to find the executor for warnings.
// Explicitly excludes the bot's own entries and anything created after the
// revert started — this prevents the bot's correction entries from swallowing
// the warning (the root cause of intermittent DM failures).
async function findExecutorForWarning(guild, userId, roleIds, revertStartedAt, {
  retries = 4,
  windowMs = 30000,
} = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    await new Promise(res => setTimeout(res, 1500));

    let logs;
    try {
      logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 100 });
    } catch (err) {
      console.error(`[AuditLog] Warning-fetch error (attempt ${attempt + 1}):`, err.message);
      continue;
    }

    const candidates = logs.entries.filter(e => {
      if (e.target?.id !== userId) return false;
      if (e.executor?.id === client.user.id) return false;           // skip bot corrections
      if (e.createdTimestamp > revertStartedAt + 3000) return false; // skip post-revert entries
      if (Date.now() - e.createdTimestamp > windowMs) return false;
      return true;
    });

    // Strict: match one of the specific affected role IDs
    const strict = candidates.find(e =>
      (e.changes || []).some(c =>
        (c.key === '$add' || c.key === '$remove') &&
        Array.isArray(c.new) &&
        c.new.some(r => roleIds.includes(r.id))
      )
    );

    if (strict) {
      console.log(`[AuditLog] Strict match attempt ${attempt + 1} — executor: ${strict.executor?.username}`);
      return strict.executor;
    }

    // Loose fallback on final attempt only
    if (attempt === retries && candidates.length > 0) {
      console.log(`[AuditLog] Loose match (final) — executor: ${candidates[0].executor?.username}`);
      return candidates[0].executor;
    }

    console.log(`[AuditLog] No match attempt ${attempt + 1}/${retries + 1} for ${userId}`);
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

  // ── Supabase realtime: sync verification status ─────────────────────────
  supabase
    .channel('verification-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async (payload) => {
      const newUser = payload.new;
      if (!newUser) return;

      // verified = true → grant Verified role
      if (newUser.verified === true) {
        const key = `web_verify_${newUser.discord_id}`;
        if (pendingWebVerify.has(key)) return;
        pendingWebVerify.set(key, Date.now());
        setTimeout(() => pendingWebVerify.delete(key), 10000);

        console.log(`✅ DB: User ${newUser.discord_id} verified`);
        try {
          const member = await guild.members.fetch(newUser.discord_id).catch(() => null);
          if (!member) return;
          if (!member.roles.cache.has(VERIFIED_ROLE)) {
            markBotAction(member.id, VERIFIED_ROLE);
            await member.roles.add(VERIFIED_ROLE, 'Verified via Web Portal');
            console.log(`  ✔ Added Verified to ${member.user.username}`);

            let staffName = 'Staff Team', staffAvatar = null;
            if (newUser.verified_by) {
              const sm = await guild.members.fetch(newUser.verified_by).catch(() => null);
              if (sm) {
                staffName = sm.displayName || sm.user.username;
                staffAvatar = sm.displayAvatarURL({ dynamic: true, size: 1024 });
              }
            }
            const verifyReason = newUser.verify_reason || 'Verified by staff';
            const successEmbed = new EmbedBuilder()
              .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) || undefined })
              .setTitle('✅ Verification Successful!')
              .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
              .setDescription(`Welcome to **${guild.name}**! You're now verified and have full access to the server. 🎉`)
              .addFields({ name: '📝 Reason', value: verifyReason, inline: false })
              .setColor('#00ff00')
              .setTimestamp()
              .setFooter({ text: `Verified by: ${staffName}`, iconURL: staffAvatar || undefined });

            const successRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel('Open Server')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🚀')
                .setURL(`https://discord.com/channels/${guild.id}`)
            );
            await dmUser(member.user, { embeds: [successEmbed], components: [successRow] });
          }
        } catch (err) { console.error('[Supabase] Error applying verification:', err); }
      }

      // verified = false → revoke Verified role
      if (newUser.verified === false) {
        const key = `web_unverify_${newUser.discord_id}`;
        if (pendingWebVerify.has(key)) return;
        pendingWebVerify.set(key, Date.now());
        setTimeout(() => pendingWebVerify.delete(key), 10000);

        console.log(`❌ DB: User ${newUser.discord_id} un-verified`);
        try {
          const member = await guild.members.fetch(newUser.discord_id).catch(() => null);
          if (!member) return;
          if (member.roles.cache.has(VERIFIED_ROLE)) {
            markBotAction(member.id, VERIFIED_ROLE);
            await member.roles.remove(VERIFIED_ROLE, 'Un-verified via Web Portal');
            console.log(`  ✔ Removed Verified from ${member.user.username}`);
            await dmUser(member.user, new EmbedBuilder()
              .setAuthor({ name: guild.name, iconURL: guild.iconURL({ dynamic: true }) || undefined })
              .setTitle('❌ Verification Revoked')
              .setDescription(`Your verification in **${guild.name}** has been revoked.\n\n⚠️ If this is a mistake, open a ticket in #tickets.`)
              .setColor('#ff4444')
              .setTimestamp()
              .setFooter({ text: guild.name })
            );
          }
        } catch (err) { console.error('[Supabase] Error revoking verification:', err); }
      }
    })
    .subscribe();

  // ── Supabase realtime: staff reports from website ───────────────────────
  // The website's /api/reports route now DMs the owner directly via the
  // Discord REST API at submit-time (see website/app/api/reports/route.ts),
  // which is what actually reaches the owner — Realtime is not required for
  // that anymore. This listener is kept only as a lightweight log so it's
  // visible in the bot's console when a report comes in; it intentionally
  // does NOT also send a DM, since that would double-notify the owner for
  // every report whenever Realtime happens to be working.
  supabase
    .channel('report-updates')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
      const report = payload.new;
      if (!report) return;
      console.log(`[Reports] New report logged in DB from ${report.reporter_name || report.reporter_id} (${report.category}).`);
    })
    .subscribe((status, err) => {
      // Realtime subscriptions fail silently by default — if the "reports" table
      // isn't added to Supabase's realtime publication (Database > Replication),
      // this channel never fires. That's fine now (the DM no longer depends on
      // it), but logging the status still helps confirm the DB write path.
      if (status === 'SUBSCRIBED') {
        console.log('[Reports] Realtime channel subscribed.');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`[Reports] Realtime channel not connected (${status}) — this no longer affects report DMs.`, err || '');
      }
    });
});

// ─── !send command ────────────────────────────────────────────────────────────

client.on('messageCreate', async (message) => {
  if (!message.guild || message.guild.id !== GUILD_ID) return;
  if (message.author.bot) return;
  if (message.content.trim().toLowerCase() !== '!send') return;

  const isStaff = message.member.roles.cache.has(STAFF_ROLE);
  const isOwner = message.author.id === OWNER_ID;
  if (!isStaff && !isOwner) return;

  const embed = new EmbedBuilder()
    .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) || undefined })
    .setTitle('🛡️  Verify to Unlock the Server')
    .setDescription(
      `Welcome! Most channels stay locked until you're verified — it only takes a minute.\n\n` +
      `**How it works**\n` +
      `> \`1.\` Click **Get Verified** below\n` +
      `> \`2.\` Our staff team gets notified instantly\n` +
      `> \`3.\` You're reviewed and approved — done! ✅\n\n` +
      `-# One request every 24 hours · Have a question? Open a ticket.`
    )
    .setImage(VERIFY_PANEL_GIF)
    .setColor('#5865F2')
    .setTimestamp()
    .setFooter({ text: 'Verification System', iconURL: client.user.displayAvatarURL() });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_request')
      .setLabel('Get Verified')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setLabel('Visit Dashboard')
      .setStyle(ButtonStyle.Link)
      .setEmoji('🌐')
      .setURL(WEBSITE_URL)
  );

  await message.channel.send({ embeds: [embed], components: [row] });
  await message.delete().catch(() => { });
  console.log(`[Send] Verification panel posted in #${message.channel.name} by ${message.author.username}`);
});

// ─── Interaction handler ──────────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {

  // ── Verify Request button ─────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'verify_request') {
    if (!interaction.guild || interaction.guild.id !== GUILD_ID) return;

    const user = interaction.user;
    const guild = interaction.guild;
    const now = Date.now();
    const COOLDOWN_MS = 24 * 60 * 60 * 1000;

    // Defer FIRST — must happen within 3 seconds before any async work
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.warn(`[Verify] Failed to defer for ${user.username}:`, err.message);
      return;
    }

    // Cooldown check
    const lastRequest = verificationCooldowns.get(user.id);
    if (lastRequest && now - lastRequest < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - (now - lastRequest);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      await interaction.editReply({
        content: `⏳ You already submitted a request recently. Please wait **${hours}h ${minutes}m** before trying again.`,
      });
      return;
    }

    // Fetch only this member — not the whole server
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.editReply({ content: '❌ Could not fetch your member data. Please try again.' });
      return;
    }

    if (member.roles.cache.has(VERIFIED_ROLE)) {
      await interaction.editReply({ content: '✅ You are already verified!' });
      return;
    }

    // Log request to Supabase for peak-time analytics
    supabase.from('verify_requests').insert({
      user_id: user.id,
      username: user.username,
    }).then(({ error }) => {
      if (error) console.warn('[Verify] Failed to log request:', error.message);
    });

    // Lock cooldown before slow DM operations
    verificationCooldowns.set(user.id, now);

    const accountCreatedTs = Math.floor(user.createdTimestamp / 1000);
    const joinedServerTs = Math.floor(member.joinedTimestamp / 1000);

    const staffEmbed = new EmbedBuilder()
      .setAuthor({ name: `${user.username} wants to be verified`, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setTitle('🔔 New Verification Request')
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👤 Username', value: user.username, inline: true },
        { name: '📛 Display Name', value: member.displayName || user.username, inline: true },
        { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
        { name: '📅 Account Created', value: `<t:${accountCreatedTs}:D>\n<t:${accountCreatedTs}:R>`, inline: true },
        { name: '📥 Joined Server', value: `<t:${joinedServerTs}:D>\n<t:${joinedServerTs}:R>`, inline: true },
        { name: '📌 Mention', value: `<@${user.id}>`, inline: true },
      )
      .setColor('#5865F2')
      .setTimestamp()
      .setFooter({ text: 'Verification Request System', iconURL: client.user.displayAvatarURL() });

    const bannerUrl = user.bannerURL?.({ dynamic: true, size: 512 });
    if (bannerUrl) staffEmbed.setImage(bannerUrl);

    const staffRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Review on Dashboard')
        .setStyle(ButtonStyle.Link)
        .setEmoji('🌐')
        .setURL(WEBSITE_URL)
    );

    // DM all staff members in parallel
    const staffMembers = guild.members.cache.filter(m => m.roles.cache.has(STAFF_ROLE) && !m.user.bot);

    let notified = 0;
    await Promise.all(staffMembers.map(async (sm) => {
      const sent = await dmUser(sm.user, { embeds: [staffEmbed], components: [staffRow] });
      if (sent) notified++;
    }));

    console.log(`[Verify] Request from ${user.username} (${user.id}) — notified ${notified}/${staffMembers.size} staff`);

    await interaction.editReply({
      content:
        `✅ Your request has been sent to the staff team!\n` +
        `They will review it and contact you shortly.\n\n` +
        `⏳ You can submit another request in **24 hours**.`,
    });
    return;
  }

  // ── Revoke button (owner only) ────────────────────────────────────────────
  // customId format: revoke_EXECUTORUSERID
  if (interaction.isButton() && interaction.customId.startsWith('revoke_')) {
    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({
        content: '❌ Only the server owner can use this button.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const executorId = interaction.customId.replace('revoke_', '');

    if (!flaggedUserRoles.has(executorId)) {
      await interaction.reply({
        content: '⚠️ No stored role data found for this user. They may have already been revoked or the bot restarted.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Show modal asking for the revoke reason
    const modal = new ModalBuilder()
      .setCustomId(`revoke_modal_${executorId}`)
      .setTitle('Revoke Flag — Enter Reason');

    const reasonInput = new TextInputBuilder()
      .setCustomId('revoke_reason')
      .setLabel('Reason for revoking this flag')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('e.g. Reviewed and confirmed no violation. User is clear.')
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    await interaction.showModal(modal);
    return;
  }

  // ── Revoke modal submission ───────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('revoke_modal_')) {
    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({
        content: '❌ Only the server owner can submit this.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Defer so we have time to restore roles and send DMs
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.warn('[Revoke] Failed to defer modal reply:', err.message);
      return;
    }

    const executorId = interaction.customId.replace('revoke_modal_', '');
    const reason = interaction.fields.getTextInputValue('revoke_reason');
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);

    if (!guild) {
      await interaction.editReply({ content: '❌ Could not fetch the server. Please try again.' });
      return;
    }

    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) {
      await interaction.editReply({ content: '❌ Could not find this user in the server. They may have left.' });
      flaggedUserRoles.delete(executorId);
      return;
    }

    const storedRoles = flaggedUserRoles.get(executorId);
    if (!storedRoles || storedRoles.length === 0) {
      await interaction.editReply({ content: '⚠️ No stored roles found for this user.' });
      return;
    }

    // Restore all their roles
    await restoreRoles(member, storedRoles);
    flaggedUserRoles.delete(executorId);

    const restoredNames = storedRoles
      .map(id => guild.roles.cache.get(id)?.name)
      .filter(Boolean)
      .map(n => `\`${n}\``)
      .join(', ');

    // DM the user with the revoke reason
    const userDmSent = await dmUser(member.user, new EmbedBuilder()
      .setTitle('✅ Flag Revoked — Roles Restored')
      .setDescription(
        `Your flag in **${guild.name}** has been reviewed and revoked by the server owner.\n\n` +
        `**Reason:**\n${reason}\n\n` +
        `All your previous roles have been restored.`
      )
      .addFields({ name: 'Roles Restored', value: restoredNames || 'None', inline: false })
      .setColor('#00cc66')
      .setTimestamp()
      .setFooter({ text: guild.name })
    );

    console.log(`[Revoke] Owner revoked flag for ${member.user.username} — DM: ${userDmSent ? 'sent' : 'failed'}`);

    await interaction.editReply({
      content:
        `✅ Flag revoked for <@${executorId}>.\n` +
        `Their ${storedRoles.length} role(s) have been restored.\n` +
        `${userDmSent ? 'They have been notified by DM.' : '⚠️ Could not DM them (DMs closed).'}`,
    });
    return;
  }
});

// ─── guildMemberUpdate — Role Protection ──────────────────────────────────────
//
// FLOW:
//  1. Diff roles → collect violations (toRevoke / toRestore)
//  2. Quick audit fetch (700ms block) → if owner, return — no revert
//  3. Revert all violations in parallel (instant, fire-and-forget)
//  4. Async IIFE:
//     a. Find executor (retry fetch, excludes bot entries + post-revert entries)
//     b. Strip ALL roles from the EXECUTOR (not the target)
//     c. Store stripped roles under executor.id for owner revoke
//     d. DM executor with warning
//     e. DM owner with security alert + profile pic + Revoke button

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (newMember.guild.id !== GUILD_ID || newMember.user.bot) return;

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const toRevoke = []; // added without permission → strip
  const toRestore = []; // removed without permission → restore

  for (const [roleId, config] of Object.entries(PROTECTED_ROLES)) {
    const wasPresent = oldRoles.has(roleId);
    const isPresent = newRoles.has(roleId);

    if (!wasPresent && isPresent && config.protectAdd) {
      if (consumeBotAction(newMember.id, roleId)) {
        console.log(`[Security] Bot ADD consumed — ${roleId} / ${newMember.user.username}`);
        continue;
      }
      const role = newMember.guild.roles.cache.get(roleId);
      if (role) toRevoke.push(role);
    }

    if (wasPresent && !isPresent && config.protectRemove) {
      if (consumeBotAction(newMember.id, roleId)) {
        console.log(`[Security] Bot REMOVE consumed — ${roleId} / ${newMember.user.username}`);
        continue;
      }
      const role = newMember.guild.roles.cache.get(roleId);
      if (role) toRestore.push(role);
    }
  }

  if (toRevoke.length === 0 && toRestore.length === 0) return;

  const username = newMember.user.username;
  const memberId = newMember.id; // the TARGET (Ali in the example)
  const affectedRoleIds = [...toRevoke, ...toRestore].map(r => r.id);
  const allAffected = [...toRevoke, ...toRestore];
  const guild = newMember.guild;

  console.log(`[Security] ⚠️  Violation — target: ${username} (${memberId})`);
  console.log(`  Revoking:  [${toRevoke.map(r => r.name).join(', ') || 'none'}]`);
  console.log(`  Restoring: [${toRestore.map(r => r.name).join(', ') || 'none'}]`);

  // ── STEP 1: Quick owner check (blocks ~700ms) ─────────────────────────────
  // Check who made the change BEFORE reverting. If it was the owner, return
  // immediately — no revert, no warnings, no role strip.
  const quickExecutor = await quickAuditExecutor(guild, memberId, affectedRoleIds, 700);

  if (quickExecutor?.id === OWNER_ID) {
    console.log(`[Security] ✅ Owner action confirmed (${quickExecutor.username}) — no revert.`);
    return;
  }
  if (quickExecutor?.id === client.user.id) {
    console.log(`[Security] Bot action confirmed on quick check — skipping.`);
    return;
  }

  // ── STEP 2: Revert the protected role changes on the TARGET ──────────────
  // Mark bot actions BEFORE the API call so the counter is set when Discord
  // fires the resulting guildMemberUpdate events (<100ms typically).
  const revertStartedAt = Date.now();
  const revertPromises = [];

  if (toRevoke.length > 0) {
    for (const role of toRevoke) markBotAction(memberId, role.id);
    revertPromises.push(
      newMember.roles.remove(toRevoke, 'Security: unauthorized assignment')
        .then(() => console.log(`[Security] ✔ Revoked [${toRevoke.map(r => r.name).join(', ')}] from ${username}`))
        .catch(err => console.error(`[Security] ✘ Revoke failed for ${username}:`, err.message))
    );
  }

  if (toRestore.length > 0) {
    for (const role of toRestore) markBotAction(memberId, role.id);
    revertPromises.push(
      newMember.roles.add(toRestore, 'Security: role restored')
        .then(() => console.log(`[Security] ✔ Restored [${toRestore.map(r => r.name).join(', ')}] to ${username}`))
        .catch(err => console.error(`[Security] ✘ Restore failed for ${username}:`, err.message))
    );
  }

  Promise.all(revertPromises); // fire-and-forget — handler returns immediately

  // ── STEP 3: Identify executor, strip THEIR roles, warn owner (async) ──────
  (async () => {
    try {
      // Reuse the quick-fetch result if it was a real non-owner/non-bot executor
      let executor = (quickExecutor && quickExecutor.id !== client.user.id && quickExecutor.id !== OWNER_ID)
        ? quickExecutor
        : await findExecutorForWarning(guild, memberId, affectedRoleIds, revertStartedAt);

      if (!executor) {
        console.warn(`[Security] Executor not found for ${username} — roles reverted, no DM sent.`);
        return;
      }

      // Final safety guard
      if (executor.id === client.user.id || executor.id === OWNER_ID) {
        console.log(`[Security] Executor is bot/owner (${executor.username}) — warnings skipped.`);
        return;
      }

      console.log(`[Security] Executor identified: ${executor.username} (${executor.id})`);

      const actionSummary = [
        ...toRevoke.map(r => `added **${r.name}**`),
        ...toRestore.map(r => `removed **${r.name}**`),
      ].join(', ');

      // ── Strip ALL roles from the EXECUTOR (Ahmed), not the target (Ali) ───
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      let strippedRoleIds = [];

      if (executorMember) {
        strippedRoleIds = await stripAllRoles(executorMember);
        if (strippedRoleIds.length > 0) {
          flaggedUserRoles.set(executor.id, strippedRoleIds); // store for owner revoke
        }
      } else {
        console.warn(`[Security] Could not fetch executor member for strip — ${executor.username}`);
      }

      // Get executor's guild avatar (server-specific avatar takes priority)
      const executorAvatar = executorMember
        ? executorMember.displayAvatarURL({ dynamic: true, size: 256 })
        : executor.displayAvatarURL({ dynamic: true, size: 256 });

      // ── DM the executor ──────────────────────────────────────────────────
      const executorDmSent = await dmUser(executor, new EmbedBuilder()
        .setTitle('🚫 Prohibited Action Detected')
        .setThumbnail(executorAvatar)
        .setDescription(
          `You manually ${actionSummary} on <@${memberId}>.\n\n` +
          `These roles are **system-controlled** and cannot be assigned or removed manually.\n` +
          `All ${allAffected.length} change(s) have been **immediately reverted** and you have been flagged.\n` +
          `All your server roles have been removed pending owner review.\n\n` +
          `⚠️ If you believe this is a mistake, please contact the owner`
        )
        .setColor('#ff0000')
        .setTimestamp()
        .setFooter({ text: 'Unauthorized Role Management' })
      );
      console.log(`[Security] Executor DM → ${executor.username}: ${executorDmSent ? 'delivered' : 'failed (DMs closed)'}`);

      // ── DM the owner with Revoke button ─────────────────────────────────
      const owner = await client.users.fetch(OWNER_ID).catch(() => null);
      if (owner) {
        const ownerEmbed = new EmbedBuilder()
          .setTitle('🔔 Security Alert — Unauthorized Role Change')
          .setThumbnail(executorAvatar)
          .addFields(
            { name: 'Executor', value: `<@${executor.id}> (\`${executor.username}\`)`, inline: true },
            { name: 'Target Member', value: `<@${memberId}> (\`${username}\`)`, inline: true },
            { name: 'Action', value: actionSummary, inline: false },
            { name: 'Roles Affected', value: allAffected.map(r => `\`${r.name}\``).join(', '), inline: false },
            { name: 'Protected Roles', value: '✅ All changes automatically reverted', inline: true },
            {
              name: 'Roles Stripped', value: strippedRoleIds.length > 0
                ? `✅ ${strippedRoleIds.length} role(s) removed from executor`
                : '⚠️ Could not strip roles', inline: true
            },
          )
          .setColor('#ff6600')
          .setTimestamp()
          .setFooter({ text: 'Role Protection System — Click Revoke to restore this user' });

        const revokeButton = new ButtonBuilder()
          .setCustomId(`revoke_${executor.id}`)
          .setLabel('Revoke Flag & Restore Roles')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔓');

        const ownerDmSent = await dmUser(owner, {
          embeds: [ownerEmbed],
          components: [new ActionRowBuilder().addComponents(revokeButton)],
        });
        console.log(`[Security] Owner DM: ${ownerDmSent ? 'delivered with Revoke button' : 'failed (DMs closed)'}`);
      } else {
        console.warn('[Security] Could not fetch owner for alert DM.');
      }

    } catch (err) {
      console.error('[Security] Async warning block error:', err);
    }
  })();
});

// ─── Global unhandled rejection guard ────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err?.message || err);
});

// ─── Health Check Server (keeps bot alive on Render) ─────────────────────────

const http = require('http');
const port = process.env.PORT || 8080;

http.createServer((req, res) => {
  const ready = client.isReady();
  const body = JSON.stringify({
    status: ready ? 'ok' : 'starting',
    uptime: process.uptime(),
    guild: GUILD_ID,
    timestamp: new Date().toISOString(),
  });
  res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(body);
}).listen(port, '0.0.0.0', () => {
  console.log(`🟢 Health check server listening on port ${port}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
