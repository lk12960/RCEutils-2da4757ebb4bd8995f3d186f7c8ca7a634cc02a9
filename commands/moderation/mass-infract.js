const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createInfraction, updateInfractionMessageId } = require('../../utils/infractionManager');

const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
const OWNER_ID = '698200964917624936';

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('mass-infraction-issue')
    .setDescription('Issue formal infractions against multiple users or all members of a role')
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
    .addRoleOption(option =>
      option.setName('role').setDescription('Role to infract all members').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('targets').setDescription('Comma-separated user mentions or IDs').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('notes').setDescription('Infraction notes').setRequired(false)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'management')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    const issuer = interaction.member;

    // Owner only check
    if (issuer.id !== OWNER_ID) {
      return interaction.reply({ content: '❌ This command is restricted to the server owner.', ephemeral: true });
    }

    const type = interaction.options.getString('type');
    const reason = interaction.options.getString('reason');
    const role = interaction.options.getRole('role');
    const targetsStr = interaction.options.getString('targets');
    const notes = interaction.options.getString('notes') || 'None';

    if (!role && !targetsStr) {
      return interaction.reply({ content: '❌ Provide at least a role or targets.', ephemeral: true });
    }

    const users = new Set();

    if (role) {
      role.members.forEach(member => users.add(member.user));
    }

    if (targetsStr) {
      const targetList = targetsStr.split(',').map(t => t.trim());
      for (const t of targetList) {
        let userId = t;
        if (t.startsWith('<@') && t.endsWith('>')) {
          userId = t.slice(2, -1);
          if (userId.startsWith('!')) userId = userId.slice(1);
        }
        try {
          const user = await interaction.client.users.fetch(userId);
          users.add(user);
        } catch {
          // Ignore invalid user IDs
        }
      }
    }

    if (users.size === 0) {
      return interaction.reply({ content: '❌ No valid users found.', ephemeral: true });
    }

    const successes = [];
    const failures = [];

    // Button for DM footer
    const footerButton = new ButtonBuilder()
      .setLabel("Sent from: King's Customs")
      .setStyle(ButtonStyle.Secondary)
      .setCustomId('source_disabled')
      .setDisabled(true);

    const row = new ActionRowBuilder().addComponents(footerButton);

    const infractionsChannel = interaction.guild.channels.cache.get(INFRACTIONS_CHANNEL_ID);

    for (const user of users) {
      try {
        const timestamp = new Date();
        const caseId = await createInfraction(user.id, issuer.id, type, reason, notes);

        const dot = '•';
        const formattedDate = `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`;

        const embed = new EmbedBuilder()
          .setColor('#FF4757')
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

        let logMessage;
        if (infractionsChannel?.isTextBased()) {
          logMessage = await infractionsChannel.send({ embeds: [embed] });
        }

        // Send DM with button
        try {
          await user.send({ embeds: [embed], components: [row] });
        } catch {
          console.warn(`⚠️ Could not DM ${user.tag} — they might have DMs disabled.`);
        }

        // Update DB with message ID if sent
        if (logMessage) {
          await updateInfractionMessageId(caseId, logMessage.id);
        }

        successes.push(user.tag);
      } catch (err) {
        console.error(`Failed to issue infraction for ${user.tag}:`, err);
        failures.push(user.tag);
      }
    }

    let replyContent = `✅ Infractions issued to ${successes.length} users.`;
    if (failures.length > 0) {
      replyContent += `\n❌ Failed for ${failures.length} users: ${failures.join(', ')}`;
    }
    await interaction.reply({ content: replyContent, ephemeral: true });
  }
};