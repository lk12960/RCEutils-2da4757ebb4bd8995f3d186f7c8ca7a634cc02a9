const { EmbedBuilder } = require('discord.js');
const { getInfractionById } = require('../utils/infractionManager');

module.exports = {
  name: 'infraction-case',
  description: 'View details of an infraction by its case ID.',
  usage: '>infraction-case <case ID>',
  async execute(message, args) {
    const caseId = parseInt(args[0]);

    if (isNaN(caseId)) {
      return message.reply('❌ Please provide a valid infraction case ID.');
    }

    const infraction = await getInfractionById(caseId);

    if (!infraction) {
      return message.reply(`❌ Infraction #${caseId} not found.`);
    }

    const timestamp = new Date(infraction.timestamp);
    const formattedDate = `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`;

    const embed = new EmbedBuilder()
      .setColor(infraction.revoked ? 0x808080 : 0x3a5ae4) // Gray if revoked, blue otherwise
      .setTitle(`Infraction Case #${infraction.id}${infraction.revoked ? ' (Revoked)' : ''}`)
      .addFields(
        { name: 'User ID', value: `<@${infraction.user_id}>`, inline: true },
        { name: 'Moderator ID', value: `<@${infraction.moderator_id}>`, inline: true },
        { name: 'Type', value: infraction.type, inline: true },
        { name: 'Reason', value: infraction.reason || 'No reason provided', inline: false },
        { name: 'Notes', value: infraction.notes || 'None', inline: false },
        { name: 'Date Issued', value: formattedDate, inline: false }
      );

    await message.reply({ embeds: [embed] });
  },
};