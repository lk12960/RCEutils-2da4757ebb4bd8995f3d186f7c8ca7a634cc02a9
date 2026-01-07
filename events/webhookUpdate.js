// events/webhookUpdate.js
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendAuditLog, createBaseEmbed, LogCategories, LogColors, LogEmojis, formatExecutor, formatTimestamp, findExecutor } = require('../utils/auditLogger');

module.exports = {
  name: 'webhookUpdate',

  async execute(channel) {
    try {
      // Fetch webhooks for the channel
      const webhooks = await channel.fetchWebhooks().catch(() => null);
      if (!webhooks) return;

      // Try to find who made the webhook change
      let executor = null;
      const entry = await findExecutor(channel.guild, AuditLogEvent.WebhookUpdate, (e) => e.target?.channelId === channel.id);

      if (entry) {
        executor = entry.executor;
      }

      const embed = createBaseEmbed({
        title: 'Webhook Updated',
        emoji: '🔗',
        color: LogColors.UPDATE,
      });

      embed.addFields(
        { name: '📍 Channel', value: `<#${channel.id}> (\`${channel.name}\`)`, inline: true },
        { name: '🔗 Webhooks', value: `${webhooks.size} webhook(s)`, inline: true }
      );

      if (executor) {
        embed.addFields({ name: '👮 Updated By', value: formatExecutor(executor), inline: false });
      }

      embed.addFields({ name: '⏰ Time', value: formatTimestamp(Date.now()), inline: false });

      embed.setFooter({ text: `Channel ID: ${channel.id}` });

      await sendAuditLog(channel.guild, {
        category: LogCategories.INTEGRATIONS,
        embed,
      });
    } catch (error) {
      console.error('Error in webhookUpdate:', error);
    }
  },
};
