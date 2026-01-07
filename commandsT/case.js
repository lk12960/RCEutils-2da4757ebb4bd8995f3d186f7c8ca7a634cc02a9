const { EmbedBuilder } = require('discord.js');
const { getCaseById } = require('../utils/caseManager');
const { isModerator } = require('../utils/permissions');

module.exports = {
  name: 'case',
  description: 'View details of a moderation case by its ID.',
  usage: '>case <case_id>',

  async execute(message, args) {
    // Check permissions
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const caseId = parseInt(args[0]);
    if (isNaN(caseId)) {
      return message.reply('❌ You must provide a valid case ID. Usage: `>case <id>`');
    }

    const modCase = await getCaseById(caseId);
    if (!modCase) {
      return message.reply(`❌ Case #${caseId} not found.`);
    }

    const timestamp = new Date(modCase.timestamp);
    const crossedOut = (text) => `~~${text}~~`;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`~~📁 Case #${modCase.id}~~ 🟡Case #${modCase.id} voided`)
      .addFields(
        { name: '➜ Type', value: crossedOut(modCase.action), inline: true },
        { name: '➜ User', value: crossedOut(`<@${modCase.user_id}>`), inline: true },
        { name: '➜ Moderator', value: crossedOut(`<@${modCase.moderator_id}>`), inline: true },
        { name: '➜ Reason', value: crossedOut(modCase.reason || 'No reason provided'), inline: false },
        { name: '➜ Date', value: crossedOut(`<t:${Math.floor(timestamp.getTime() / 1000)}:F>`), inline: false }
      )
      .setFooter({ text: `Case ID: ${modCase.id} • ${timestamp.toUTCString()}` });

    return message.reply({ embeds: [embed] });
  },
};
