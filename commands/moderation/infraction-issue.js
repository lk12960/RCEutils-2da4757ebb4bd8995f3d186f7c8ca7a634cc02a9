const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createInfraction, updateInfractionMessageId } = require('../../utils/infractionManager');
const { isManagement } = require('../../utils/permissions');

const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction-issue')
    .setDescription('Issue a formal infraction against a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to infract').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of infraction')
        .addChoices(
          { name: 'Notice', value: 'Notice' },
          { name: 'Warning', value: 'Warning' },
          { name: 'Strike', value: 'Strike' },
          { name: 'Termination', value: 'Termination' },
          { name: 'Blacklist', value: 'Blacklist' }
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for the infraction').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('notes').setDescription('Infraction notes').setRequired(false)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    const issuer = interaction.member;

    // Management only check
    if (!isManagement(issuer)) {
      return interaction.reply({ content: '❌ You do not have permission to issue infractions.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    const reason = interaction.options.getString('reason');
    const notes = interaction.options.getString('notes') || 'None';

    const timestamp = new Date();
    const caseId = await createInfraction(user.id, issuer.id, type, reason, notes);

    const dot = '•';
    const formattedDate = `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`;

    const embed = new EmbedBuilder()
      .setColor('#e566e2')
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
        text: `Issued by: ${issuer.user.tag} ${dot} ${timestamp.toUTCString()}`,
        iconURL: issuer.user.displayAvatarURL()
      });

    // Button ONLY for the DM to the user
    const footerButton = new ButtonBuilder()
      .setLabel("Sent from: King's Customs")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId('source_disabled')
      .setDisabled(true);

    const row = new ActionRowBuilder().addComponents(footerButton);

    try {
      const infractionsChannel = interaction.guild.channels.cache.get(INFRACTIONS_CHANNEL_ID);
      let logMessage;

      // Send embed WITHOUT button to infractions log
      if (infractionsChannel?.isTextBased()) {
        logMessage = await infractionsChannel.send({ embeds: [embed] }); // No components here
      }

      // Send embed WITH button ONLY to user DM
      try {
        await user.send({ embeds: [embed], components: [row] });
      } catch {
        console.warn(`⚠️ Could not DM ${user.tag} — they might have DMs disabled.`);
      }

      // Update DB with message ID if message was sent to infractions channel
      if (logMessage) {
        await updateInfractionMessageId(caseId, logMessage.id);
      }

      await interaction.reply({
        content: `✅ Infraction issued to ${user.tag} (Case #${caseId}).`,
        ephemeral: true
      });
    } catch (err) {
      console.error('Failed to issue infraction:', err);
      return interaction.reply({
        content: '❌ Failed to issue the infraction.',
        ephemeral: true
      });
    }
  }
};