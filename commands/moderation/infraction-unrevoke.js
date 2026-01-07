const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const infractionManager = require('../../utils/infractionManager');
const { isManagement } = require('../../utils/permissions');

const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
const DOT_EMOJI = '•';
const GUILD_TAG = "King's Customs"; // Your server tag for DM message

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction-unrevoke')
    .setDescription('Unrevoke an infraction by case ID')
    .addIntegerOption(option =>
      option.setName('id').setDescription('Infraction case ID').setRequired(true)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const caseId = interaction.options.getInteger('id');
    const infraction = await infractionManager.getInfractionById(caseId);

    if (!infraction) {
      return interaction.reply({ content: `❌ Infraction case #${caseId} not found.`, ephemeral: true });
    }

    if (!infraction.revoked) {
      return interaction.reply({ content: `❌ Infraction case #${caseId} is not revoked.`, ephemeral: true });
    }

    const unrevokeResult = await infractionManager.unrevokeInfraction(caseId);
    if (!unrevokeResult) {
      return interaction.reply({ content: '❌ Failed to unrevoke the infraction.', ephemeral: true });
    }

    // Update original infraction message embed (restore original info)
    if (infraction.message_id && INFRACTIONS_CHANNEL_ID) {
      try {
        const channel = await interaction.client.channels.fetch(INFRACTIONS_CHANNEL_ID);
        if (channel?.isTextBased()) {
          const originalMessage = await channel.messages.fetch(infraction.message_id).catch(() => null);
          if (originalMessage) {
            const embed = originalMessage.embeds[0];
            if (embed) {
              const restoredEmbed = EmbedBuilder.from(embed)
                .setColor(0x3a5ae4)
                .setTitle(`Staff Punishment • Case #${infraction.id}`)
                .spliceFields(0, embed.data.fields.length)
                .addFields(
                  { name: 'Case', value: `#${infraction.id}`, inline: true },
                  { name: 'Punishment', value: infraction.type, inline: true },
                  { name: 'Date', value: `<t:${Math.floor(new Date(infraction.timestamp).getTime() / 1000)}:F>`, inline: true },
                  { name: 'Reason', value: infraction.reason || 'No reason provided', inline: true },
                  { name: 'Notes', value: infraction.notes || 'None', inline: true }
                )
                .setFooter({
                  text: `Issued by: Unknown ${DOT_EMOJI} ${new Date(infraction.timestamp).toUTCString()}`,
                  iconURL: null
                });

              await originalMessage.edit({ embeds: [restoredEmbed] });
            }

            // Edit the revocation message ("Revoked by ...") to "Unrevoked by ..."
            const messagesAfter = await channel.messages.fetch({ after: originalMessage.id, limit: 5 });
            const revocationMessage = messagesAfter.find(msg =>
              msg.author.id === interaction.client.user.id &&
              msg.reference?.messageId === originalMessage.id &&
              msg.content?.startsWith('Revoked by')
            );

            if (revocationMessage) {
              await revocationMessage.edit({ content: `Unrevoked by ${interaction.user.tag}` });
            }
          }
        }
      } catch (error) {
        console.error('Failed to update infraction log messages:', error);
      }
    }

    // DM the user a simple plain text message (no embed)
    try {
      const user = await interaction.client.users.fetch(infraction.user_id);
      await user.send(
        `Your ${infraction.type.toLowerCase()} for \`${infraction.reason}\` in ${GUILD_TAG} has been **unrevoked** by ${interaction.user.tag}.`
      );
    } catch {
      // silently fail if DMs are closed
    }

    return interaction.reply({ content: `✅ Successfully unrevoked infraction case #${caseId}.`, ephemeral: true });
  }
};