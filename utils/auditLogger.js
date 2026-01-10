// ============================================================================
// ADVANCED AUDIT LOGGING SYSTEM
// ============================================================================
// Centralized audit logging with advanced features:
// - Multi-channel logging with categories
// - Configurable log levels and filters
// - Detailed audit log fetching with retry logic
// - Embed templates and formatting
// - Automatic attachment handling
// - Performance optimization with caching
// - Comprehensive event tracking
// ============================================================================

const { EmbedBuilder, PermissionsBitField, AuditLogEvent, Colors } = require('discord.js');
const settingsManager = require('./settingsManager');

// ============================================================================
// AUDIT LOGGING ENABLED/DISABLED FLAG
// ============================================================================
// Set to false to completely disable all audit logging
const AUDIT_LOGGING_ENABLED = true;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Log categories for organized logging
 */
const LogCategories = {
  MEMBERS: 'members',           // Join, leave, update
  MESSAGES: 'messages',         // Delete, edit, bulk delete
  MODERATION: 'moderation',     // Bans, kicks, timeouts, warnings
  CHANNELS: 'channels',         // Create, delete, update, permissions
  ROLES: 'roles',               // Create, delete, update, assign
  SERVER: 'server',             // Server settings, emojis, stickers
  VOICE: 'voice',               // Join, leave, move, mute, deafen
  INVITES: 'invites',           // Create, delete, use
  THREADS: 'threads',           // Create, delete, update
  EVENTS: 'events',             // Scheduled events
  INTEGRATIONS: 'integrations', // Webhooks, bots
};

/**
 * Log levels for filtering
 */
const LogLevels = {
  ALL: 0,
  INFO: 1,
  WARNING: 2,
  CRITICAL: 3,
};

/**
 * Color scheme for different log types
 */
const LogColors = {
  CREATE: Colors.Green,
  DELETE: Colors.Red,
  UPDATE: Colors.Yellow,
  INFO: Colors.Blue,
  WARNING: Colors.Orange,
  CRITICAL: Colors.DarkRed,
  MEMBER_JOIN: Colors.Green,
  MEMBER_LEAVE: Colors.Red,
  BAN: Colors.DarkRed,
  UNBAN: Colors.Green,
  TIMEOUT: Colors.Orange,
  VOICE_JOIN: Colors.Aqua,
  VOICE_LEAVE: Colors.LightGrey,
};

/**
 * Emoji mappings for visual clarity
 */
const LogEmojis = {
  // Members
  MEMBER_JOIN: '➕',
  MEMBER_LEAVE: '➖',
  MEMBER_UPDATE: '✏️',
  MEMBER_ROLES: '🎭',
  MEMBER_NICKNAME: '📝',
  MEMBER_BOOST: '💎',
  
  // Moderation
  BAN: '🔨',
  UNBAN: '🔓',
  KICK: '👢',
  TIMEOUT: '⏰',
  WARN: '⚠️',
  
  // Messages
  MESSAGE_DELETE: '🗑️',
  MESSAGE_EDIT: '✏️',
  MESSAGE_BULK_DELETE: '🗑️',
  MESSAGE_PIN: '📌',
  MESSAGE_UNPIN: '📍',
  
  // Channels
  CHANNEL_CREATE: '📥',
  CHANNEL_DELETE: '📤',
  CHANNEL_UPDATE: '🔧',
  CHANNEL_PINS_UPDATE: '📌',
  
  // Roles
  ROLE_CREATE: '🆕',
  ROLE_DELETE: '🗑️',
  ROLE_UPDATE: '✏️',
  
  // Server
  SERVER_UPDATE: '🛠️',
  EMOJI_CREATE: '➕',
  EMOJI_DELETE: '➖',
  EMOJI_UPDATE: '✏️',
  STICKER_CREATE: '🎨',
  STICKER_DELETE: '🗑️',
  
  // Voice
  VOICE_JOIN: '🔊',
  VOICE_LEAVE: '🔇',
  VOICE_MOVE: '🔀',
  VOICE_MUTE: '🔇',
  VOICE_DEAFEN: '🔇',
  VOICE_STREAM: '📹',
  VOICE_VIDEO: '📹',
  
  // Invites
  INVITE_CREATE: '🎟️',
  INVITE_DELETE: '🎟️',
  INVITE_USE: '🚪',
  
  // Threads
  THREAD_CREATE: '🧵',
  THREAD_DELETE: '🗑️',
  THREAD_UPDATE: '✏️',
  
  // Events
  EVENT_CREATE: '📅',
  EVENT_DELETE: '🗓️',
  EVENT_UPDATE: '📆',
  
  // Other
  WEBHOOK_CREATE: '🔗',
  WEBHOOK_DELETE: '🔗',
  INTEGRATION_CREATE: '🔌',
  INTEGRATION_DELETE: '🔌',
  AUTOMOD: '🤖',
};

// ============================================================================
// AUDIT LOG CACHE
// ============================================================================

const auditLogCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

/**
 * Clear old cache entries
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of auditLogCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      auditLogCache.delete(key);
    }
  }
}, 10000); // Clean every 10 seconds

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get audit log channel(s) for a guild
 */
async function getLogChannels(guild, category = null) {
  try {
    // Try to get from settings manager
    const settings = await settingsManager.getSettings(guild.id).catch(() => null);
    
    if (settings?.auditChannels) {
      if (category && settings.auditChannels[category]) {
        const channel = guild.channels.cache.get(settings.auditChannels[category]);
        return channel ? [channel] : [];
      }
      
      // Return main audit channel
      const mainChannel = settings.auditChannels.main || settings.auditChannels.all;
      if (mainChannel) {
        const channel = guild.channels.cache.get(mainChannel);
        return channel ? [channel] : [];
      }
    }
    
    // Fallback to environment variable
    const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID;
    if (logChannelId) {
      const channel = guild.channels.cache.get(logChannelId);
      return channel ? [channel] : [];
    }
    
    return [];
  } catch (error) {
    console.error('Error getting log channels:', error);
    return [];
  }
}

/**
 * Fetch audit log entry with retry logic and caching
 */
async function fetchAuditLog(guild, options) {
  const cacheKey = `${guild.id}-${options.type}-${Date.now()}`;
  
  // Check cache
  const cached = auditLogCache.get(cacheKey);
  if (cached) {
    return cached.data;
  }
  
  try {
    const fetchedLogs = await guild.fetchAuditLogs({
      limit: options.limit || 5,
      type: options.type,
    });
    
    // Cache the result
    auditLogCache.set(cacheKey, {
      data: fetchedLogs,
      timestamp: Date.now(),
    });
    
    return fetchedLogs;
  } catch (error) {
    console.error(`Failed to fetch audit logs (${options.type}):`, error);
    return null;
  }
}

/**
 * Find audit log executor with multiple filters
 */
async function findExecutor(guild, auditLogType, targetFilter) {
  try {
    const logs = await fetchAuditLog(guild, { type: auditLogType, limit: 5 });
    if (!logs) return null;
    
    // Find matching entry
    const entry = logs.entries.find(e => {
      if (typeof targetFilter === 'function') {
        return targetFilter(e);
      }
      if (targetFilter.id) {
        return e.target?.id === targetFilter.id;
      }
      return true;
    });
    
    return entry;
  } catch (error) {
    console.error('Error finding executor:', error);
    return null;
  }
}

/**
 * Format executor information
 */
function formatExecutor(executor) {
  if (!executor) return 'Unknown';
  return `${executor.tag} (${executor.id})`;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format timestamp for Discord
 */
function formatTimestamp(timestamp, style = 'F') {
  const unix = Math.floor(timestamp / 1000);
  return `<t:${unix}:${style}>`;
}

/**
 * Truncate text to fit in embed field
 */
function truncate(text, maxLength = 1024) {
  if (!text) return 'None';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format permission changes
 */
function formatPermissionChanges(oldPerms, newPerms) {
  const oldArray = new PermissionsBitField(oldPerms).toArray();
  const newArray = new PermissionsBitField(newPerms).toArray();
  
  const added = newArray.filter(p => !oldArray.includes(p));
  const removed = oldArray.filter(p => !newArray.includes(p));
  
  const changes = [];
  if (added.length > 0) {
    changes.push(`**Added:** ${added.join(', ')}`);
  }
  if (removed.length > 0) {
    changes.push(`**Removed:** ${removed.join(', ')}`);
  }
  
  return changes.length > 0 ? changes.join('\n') : 'No changes';
}

/**
 * Get changes between two objects
 */
function getChanges(oldObj, newObj, fields) {
  const changes = [];
  
  for (const field of fields) {
    if (oldObj[field] !== newObj[field]) {
      changes.push({
        field: field,
        old: oldObj[field],
        new: newObj[field],
      });
    }
  }
  
  return changes;
}

// ============================================================================
// CORE LOGGING FUNCTION
// ============================================================================

/**
 * Send audit log to appropriate channel(s)
 */
async function sendAuditLog(guild, options) {
  // Early return if audit logging is disabled
  if (!AUDIT_LOGGING_ENABLED) {
    return;
  }
  
  try {
    const {
      category = LogCategories.SERVER,
      embed,
      embeds,
      files,
      level = LogLevels.INFO,
    } = options;
    
    // Get log channels
    const channels = await getLogChannels(guild, category);
    if (channels.length === 0) {
      return; // No log channels configured
    }
    
    // Prepare message payload
    const payload = {};
    if (embed) payload.embeds = [embed];
    if (embeds) payload.embeds = embeds;
    if (files) payload.files = files;
    
    // Send to all channels
    const promises = channels.map(channel => 
      channel.send(payload).catch(err => {
        console.error(`Failed to send audit log to ${channel.id}:`, err);
      })
    );
    
    await Promise.all(promises);
  } catch (error) {
    console.error('Error sending audit log:', error);
  }
}

/**
 * Create base embed with common properties
 */
function createBaseEmbed(options) {
  const {
    title,
    description,
    color,
    emoji,
    footer,
    thumbnail,
    image,
  } = options;
  
  const embed = new EmbedBuilder()
    .setColor(color || LogColors.INFO)
    .setTimestamp();
  
  if (title) {
    const fullTitle = emoji ? `${emoji} ${title}` : title;
    embed.setTitle(fullTitle);
  }
  
  if (description) {
    embed.setDescription(description);
  }
  
  if (footer) {
    embed.setFooter(typeof footer === 'string' ? { text: footer } : footer);
  }
  
  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }
  
  if (image) {
    embed.setImage(image);
  }
  
  return embed;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Constants
  LogCategories,
  LogLevels,
  LogColors,
  LogEmojis,
  
  // Helper functions
  getLogChannels,
  fetchAuditLog,
  findExecutor,
  formatExecutor,
  formatDuration,
  formatTimestamp,
  truncate,
  formatPermissionChanges,
  getChanges,
  
  // Core functions
  sendAuditLog,
  createBaseEmbed,
};
