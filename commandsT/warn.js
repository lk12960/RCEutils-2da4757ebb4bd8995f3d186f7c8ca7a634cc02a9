const { EmbedBuilder } = require('discord.js');
const { createCase } = require('../utils/caseManager');
const { isModerator } = require('../utils/permissions');

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

module.exports = {
  name: 'warn',
  description: 'Warn a user and log it as a case',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    // Expecting user mention or ID as first argument
    const target = message.mentions.users.first() || message.client.users.cache.get(args[0]);
    if (!target) {
      return message.reply('❌ Please mention a user or provide a valid user ID.');
    }

    // Reason is rest of the arguments after user
    const reason = args.slice(1).join(' ') || 'No reason provided';

    const caseId = await createCase(target.id, message.author.id, 'Warn', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(0xffff00) // yellow for warning
      .setTitle('⚠️ Member Warned')
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

    await message.channel.send(`⚠️ Warned **${target.tag}**\n🆔 Case #${caseId}\n📄 Reason: ${reason}`);
  },
};