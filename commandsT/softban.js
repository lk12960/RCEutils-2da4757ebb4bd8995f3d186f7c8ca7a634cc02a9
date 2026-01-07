const { EmbedBuilder } = require('discord.js');
const { createCase } = require('../utils/caseManager');
const { isModerator } = require('../utils/permissions');

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

module.exports = {
  name: 'softban',
  description: 'Softban a user (ban then unban, deleting recent messages)',
  usage: '<user> [reason]',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    if (!args[0]) {
      return message.reply('❌ Please specify a user to softban.');
    }

    // Try to resolve user from mention, ID, or username
    let target;
    try {
      target = await message.client.users.fetch(args[0].replace(/[<@!>]/g, ''));
    } catch {
      return message.reply('❌ Could not find that user.');
    }

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      const member = await message.guild.members.fetch(target.id);

      // Ban with 1 day message deletion
      await message.guild.bans.create(target.id, {
        deleteMessageDays: 1,
        reason,
      });

      // Immediately unban user
      await message.guild.bans.remove(target.id, 'Softban: immediate unban');

      // Create case & log
      const caseId = await createCase(target.id, message.author.id, 'Softban', reason);
      const timestamp = new Date();

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🚫 Member Softbanned')
        .addFields(
          { name: '➜ User', value: `${target.tag} (<@${target.id}>)`, inline: false },
          { name: '➜ Reason', value: reason, inline: false },
          { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false },
        )
        .setFooter({ text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` });

      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel && logChannel.isTextBased()) {
        logChannel.send({ embeds: [embed] }).catch(console.error);
      }

      await message.reply(`🚫 Softbanned ${target.tag}.\n🆔 Case #${caseId}`);
    } catch (error) {
      console.error(error);
      await message.reply('❌ Failed to softban the user.');
    }
  },
};