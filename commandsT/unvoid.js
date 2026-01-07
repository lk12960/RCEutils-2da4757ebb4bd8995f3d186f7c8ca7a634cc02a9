const { EmbedBuilder } = require('discord.js');
const { getCaseById, unvoidCase } = require('../utils/caseManager');
const { isManagement } = require('../utils/permissions'); // your custom permission check

const LOG_CHANNEL_ID = '1411411537494806709';

module.exports = {
  name: 'unvoid',
  description: 'Remove the void status from a moderation case',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    if (!isManagement(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const caseId = parseInt(args[0], 10);
    if (isNaN(caseId)) {
      return message.reply('❌ Please provide a valid case ID.');
    }

    const modCase = await getCaseById(caseId);
    if (!modCase) {
      return message.reply(`❌ Case #${caseId} not found.`);
    }

    if (!modCase.voided) {
      return message.reply(`⚠️ Case #${caseId} is not currently voided.`);
    }

    const success = await unvoidCase(caseId);
    if (!success) {
      return message.reply(`❌ Failed to unvoid Case #${caseId}.`);
    }

    const timestamp = new Date();
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71) // green
      .setTitle('✅ Case Unvoided')
      .addFields(
        { name: '➜ Case ID', value: `#${modCase.id}`, inline: true },
        { name: '➜ Type', value: modCase.action, inline: true },
        { name: '➜ User', value: `<@${modCase.user_id}>`, inline: true },
        { name: '➜ Reason', value: modCase.reason || 'No reason', inline: false },
        { name: '➜ Original Date', value: `<t:${Math.floor(new Date(modCase.timestamp).getTime() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `Unvoided at ${timestamp.toUTCString()}` });

    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    return message.channel.send(`✅ Case #${caseId} has been unvoided.`);
  },
};