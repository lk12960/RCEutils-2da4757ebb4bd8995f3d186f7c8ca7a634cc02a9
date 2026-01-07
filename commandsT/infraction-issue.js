const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createInfraction, updateInfractionMessageId } = require('../utils/infractionManager');
const { isManagement } = require('../utils/permissions');

const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;

module.exports = {
  name: 'infraction-issue',
  description: 'Issue a formal infraction to a user.',
  usage: '>infraction-issue @user <type> <reason> [| notes]',
  async execute(message, args) {
    if (!isManagement(message.member)) {
      return message.reply('❌ You do not have permission to issue infractions.');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.reply('❌ Please mention a valid user.');
    }

    const validTypes = ['Notice', 'Warning', 'Strike', 'Termination', 'Blacklist'];
    const type = args[1];
    if (!validTypes.includes(type)) {
      return message.reply(`❌ Invalid type. Valid types are: ${validTypes.join(', ')}`);
    }

    const input = args.slice(2).join(' ').split('|');
    const reason = input[0]?.trim();
    const notes = input[1]?.trim() || 'None';

    if (!reason) {
      return message.reply('❌ Please provide a reason for the infraction.');
    }

    const timestamp = new Date();
    const caseId = await createInfraction(user.id, message.author.id, type, reason, notes);

    const dot = '•';
    const formattedDate = `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`;

    const embed = new EmbedBuilder()
      .setColor('#3a5ae4')
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setTitle('Staff Punishment')
      .addFields(
        { name: 'Case', value: `#${caseId}`, inline: true },
        { name: 'Punishment', value: type, inline: true },
        { name: 'Date', value: formattedDate, inline: true },
        { name: 'Reason', value: reason, inline: true },
        { name: 'Notes', value: notes, inline: true }
      )
      .setFooter({
        text: `Issued by: ${message.author.tag} ${dot} ${timestamp.toUTCString()}`,
        iconURL: message.author.displayAvatarURL()
      });

    const footerButton = new ButtonBuilder()
      .setLabel('Sent from: Lapeer County Correctional Facility')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId('source_disabled')
      .setDisabled(true);

    const row = new ActionRowBuilder().addComponents(footerButton);

    try {
      const infractionsChannel = message.guild.channels.cache.get(INFRACTIONS_CHANNEL_ID);
      let logMessage;

      if (infractionsChannel?.isTextBased()) {
        logMessage = await infractionsChannel.send({ embeds: [embed] });
      }

      try {
        await user.send({ embeds: [embed], components: [row] });
      } catch {
        console.warn(`⚠️ Could not DM ${user.tag} — they might have DMs disabled.`);
      }

      if (logMessage) {
        await updateInfractionMessageId(caseId, logMessage.id);
      }

      await message.reply(`✅ Infraction issued to ${user.tag} (Case #${caseId}).`);
    } catch (err) {
      console.error('Failed to issue infraction:', err);
      await message.reply('❌ Failed to issue the infraction.');
    }
  },
};