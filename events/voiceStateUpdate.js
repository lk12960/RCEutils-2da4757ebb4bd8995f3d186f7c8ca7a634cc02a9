// events/voiceStateUpdate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'voiceStateUpdate',

  async execute(oldState, newState) {
    const member = newState.member;
    const guild = newState.guild;

    // Ignore if not in a guild
    if (!guild) return;

    // Detect the type of voice state change
    const changes = [];

    // Channel changes
    if (!oldState.channelId && newState.channelId) {
      // Joined voice channel
      await logVoiceJoin(oldState, newState);
    } else if (oldState.channelId && !newState.channelId) {
      // Left voice channel
      await logVoiceLeave(oldState, newState);
    } else if (oldState.channelId !== newState.channelId) {
      // Moved between channels
      await logVoiceMove(oldState, newState);
    }

    // State changes (mute, deafen, streaming, video)
    if (oldState.channelId && newState.channelId) {
      // Server mute/unmute
      if (oldState.serverMute !== newState.serverMute) {
        await logServerMuteChange(oldState, newState);
      }

      // Server deafen/undeafen
      if (oldState.serverDeaf !== newState.serverDeaf) {
        await logServerDeafenChange(oldState, newState);
      }

      // Self mute/unmute
      if (oldState.selfMute !== newState.selfMute) {
        await logSelfMuteChange(oldState, newState);
      }

      // Self deafen/undeafen
      if (oldState.selfDeaf !== newState.selfDeaf) {
        await logSelfDeafenChange(oldState, newState);
      }

      // Streaming
      if (oldState.streaming !== newState.streaming) {
        await logStreamingChange(oldState, newState);
      }

      // Video
      if (oldState.selfVideo !== newState.selfVideo) {
        await logVideoChange(oldState, newState);
      }

      // Suppress (stage channels)
      if (oldState.suppress !== newState.suppress) {
        await logSuppressChange(oldState, newState);
      }
    }
  },
};

// ============================================================================
// VOICE CHANNEL JOIN/LEAVE/MOVE
// ============================================================================

async function logVoiceJoin(oldState, newState) {
  const embed = createBaseEmbed({
    title: 'Voice Channel Joined',
    emoji: LogEmojis.VOICE_JOIN,
    color: LogColors.VOICE_JOIN,
  });

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
    { name: '🔊 Channel', value: `<#${newState.channelId}> (\`${newState.channelId}\`)`, inline: true },
    { name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false }
  );

  if (newState.member.user.avatarURL()) {
    embed.setThumbnail(newState.member.user.avatarURL());
  }

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}

async function logVoiceLeave(oldState, newState) {
  const embed = createBaseEmbed({
    title: 'Voice Channel Left',
    emoji: LogEmojis.VOICE_LEAVE,
    color: LogColors.VOICE_LEAVE,
  });

  const duration = oldState.channelId ? Date.now() - (oldState.member.voice.sessionStartedTimestamp || Date.now()) : 0;
  const durationText = duration > 0 ? `\nDuration: ${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s` : '';

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
    { name: '🔇 Channel', value: `<#${oldState.channelId}> (\`${oldState.channelId}\`)${durationText}`, inline: true },
    { name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false }
  );

  if (newState.member.user.avatarURL()) {
    embed.setThumbnail(newState.member.user.avatarURL());
  }

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}

async function logVoiceMove(oldState, newState) {
  // Check if it was a forced move (by moderator)
  let executor = null;
  const entry = await findExecutor(newState.guild, AuditLogEvent.MemberMove, {
    id: newState.member.id,
  });

  if (entry && entry.executor) {
    executor = entry.executor;
  }

  const embed = createBaseEmbed({
    title: executor ? 'Voice Channel Moved (Forced)' : 'Voice Channel Moved',
    emoji: LogEmojis.VOICE_MOVE,
    color: LogColors.UPDATE,
  });

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: false },
    { name: '📤 From', value: `<#${oldState.channelId}>`, inline: true },
    { name: '📥 To', value: `<#${newState.channelId}>`, inline: true }
  );

  if (executor) {
    embed.addFields({ name: '👮 Moved By', value: formatExecutor(executor), inline: false });
  }

  embed.addFields({ name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false });

  if (newState.member.user.avatarURL()) {
    embed.setThumbnail(newState.member.user.avatarURL());
  }

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}

// ============================================================================
// MUTE/DEAFEN CHANGES
// ============================================================================

async function logServerMuteChange(oldState, newState) {
  const isMuted = newState.serverMute;
  
  // Try to find who muted/unmuted
  let executor = null;
  const entry = await findExecutor(newState.guild, AuditLogEvent.MemberUpdate, {
    id: newState.member.id,
  });

  if (entry && entry.executor) {
    executor = entry.executor;
  }

  const embed = createBaseEmbed({
    title: isMuted ? 'Member Server Muted' : 'Member Server Unmuted',
    emoji: LogEmojis.VOICE_MUTE,
    color: isMuted ? LogColors.WARNING : LogColors.INFO,
  });

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
    { name: '🔊 Channel', value: `<#${newState.channelId}>`, inline: true },
    { name: '🔇 Status', value: isMuted ? '**Muted**' : '**Unmuted**', inline: true }
  );

  if (executor) {
    embed.addFields({ name: '👮 By', value: formatExecutor(executor), inline: false });
  }

  if (newState.member.user.avatarURL()) {
    embed.setThumbnail(newState.member.user.avatarURL());
  }

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}

async function logServerDeafenChange(oldState, newState) {
  const isDeafened = newState.serverDeaf;
  
  // Try to find who deafened/undeafened
  let executor = null;
  const entry = await findExecutor(newState.guild, AuditLogEvent.MemberUpdate, {
    id: newState.member.id,
  });

  if (entry && entry.executor) {
    executor = entry.executor;
  }

  const embed = createBaseEmbed({
    title: isDeafened ? 'Member Server Deafened' : 'Member Server Undeafened',
    emoji: LogEmojis.VOICE_DEAFEN,
    color: isDeafened ? LogColors.WARNING : LogColors.INFO,
  });

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
    { name: '🔊 Channel', value: `<#${newState.channelId}>`, inline: true },
    { name: '🔇 Status', value: isDeafened ? '**Deafened**' : '**Undeafened**', inline: true }
  );

  if (executor) {
    embed.addFields({ name: '👮 By', value: formatExecutor(executor), inline: false });
  }

  if (newState.member.user.avatarURL()) {
    embed.setThumbnail(newState.member.user.avatarURL());
  }

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}

async function logSelfMuteChange(oldState, newState) {
  const isMuted = newState.selfMute;

  const embed = createBaseEmbed({
    title: isMuted ? 'Member Self-Muted' : 'Member Self-Unmuted',
    emoji: '🎤',
    color: LogColors.INFO,
  });

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
    { name: '🔊 Channel', value: `<#${newState.channelId}>`, inline: true },
    { name: 'Status', value: isMuted ? '**Self-Muted**' : '**Self-Unmuted**', inline: true }
  );

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}

async function logSelfDeafenChange(oldState, newState) {
  const isDeafened = newState.selfDeaf;

  const embed = createBaseEmbed({
    title: isDeafened ? 'Member Self-Deafened' : 'Member Self-Undeafened',
    emoji: '🔇',
    color: LogColors.INFO,
  });

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
    { name: '🔊 Channel', value: `<#${newState.channelId}>`, inline: true },
    { name: 'Status', value: isDeafened ? '**Self-Deafened**' : '**Self-Undeafened**', inline: true }
  );

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}

// ============================================================================
// STREAMING/VIDEO CHANGES
// ============================================================================

async function logStreamingChange(oldState, newState) {
  const isStreaming = newState.streaming;

  const embed = createBaseEmbed({
    title: isStreaming ? 'Member Started Streaming' : 'Member Stopped Streaming',
    emoji: LogEmojis.VOICE_STREAM,
    color: isStreaming ? LogColors.CREATE : LogColors.INFO,
  });

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
    { name: '🔊 Channel', value: `<#${newState.channelId}>`, inline: true },
    { name: '📹 Status', value: isStreaming ? '**Streaming**' : '**Stopped**', inline: true }
  );

  if (newState.member.user.avatarURL()) {
    embed.setThumbnail(newState.member.user.avatarURL());
  }

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}

async function logVideoChange(oldState, newState) {
  const isVideo = newState.selfVideo;

  const embed = createBaseEmbed({
    title: isVideo ? 'Member Started Video' : 'Member Stopped Video',
    emoji: LogEmojis.VOICE_VIDEO,
    color: isVideo ? LogColors.CREATE : LogColors.INFO,
  });

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
    { name: '🔊 Channel', value: `<#${newState.channelId}>`, inline: true },
    { name: '📹 Status', value: isVideo ? '**Video On**' : '**Video Off**', inline: true }
  );

  if (newState.member.user.avatarURL()) {
    embed.setThumbnail(newState.member.user.avatarURL());
  }

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}

async function logSuppressChange(oldState, newState) {
  const isSuppressed = newState.suppress;

  const embed = createBaseEmbed({
    title: isSuppressed ? 'Member Suppressed (Stage)' : 'Member Unsuppressed (Stage)',
    emoji: '🎙️',
    color: isSuppressed ? LogColors.WARNING : LogColors.INFO,
  });

  embed.addFields(
    { name: '👤 Member', value: `${newState.member.user.tag} (${newState.member.id})`, inline: true },
    { name: '🎙️ Stage', value: `<#${newState.channelId}>`, inline: true },
    { name: 'Status', value: isSuppressed ? '**Audience**' : '**Speaker**', inline: true }
  );

  await sendAuditLog(newState.guild, {
    category: LogCategories.VOICE,
    embed,
  });
}
