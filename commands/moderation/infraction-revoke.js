const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const infractionManager = require('../../utils/infractionManager');
const { isManagement } = require('../../utils/permissions');

const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
const DOT_EMOJI = '•'; // your emoji or replace
const GUILD_TAG = "King's Customs"; // your server tag or name to include in DM message

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction-revoke')
    .setDescription('Revoke (void) an infraction by case ID')
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

    if (infraction.revoked) {
      return interaction.reply({ content: `❌ Infraction case #${caseId} is already revoked.`, ephemeral: true });
    }

    const revoked = await infractionManager.revokeInfraction(caseId);
    if (!revoked) {
      return interaction.reply({ content: '❌ Failed to revoke the infraction.', ephemeral: true });
    }

    // Update original infraction embed in log channel with revoked status
    if (infraction.message_id && INFRACTIONS_CHANNEL_ID) {
      try {
        const channel = await interaction.client.channels.fetch(INFRACTIONS_CHANNEL_ID);
        if (channel?.isTextBased()) {
          const message = await channel.messages.fetch(infraction.message_id).catch(() => null);
          if (message) {
            const embed = message.embeds[0];
            if (embed) {
              // Clone original embed, keep all fields and data, just add status field and update title/footer
              const revokedEmbed = EmbedBuilder.from(embed)
                .setColor(0x808080)
                .setTitle(embed.data.title ? `~ Revoked ${embed.data.title} ~` : `~ Revoked Infraction Case #${infraction.id} ~`)
                // Keep original fields and add a "Status: Revoked" field (append, don't remove others)
                .addFields({ name: 'Status', value: 'Revoked', inline: true })
                .setFooter({
                  text: `Revoked by: ${interaction.user.tag} ${DOT_EMOJI} ${new Date().toUTCString()}`,
                  iconURL: interaction.user.displayAvatarURL()
                });

              await message.edit({ embeds: [revokedEmbed], components: [] });

              // Optional: Send a small message under original embed mentioning revocation
              await channel.send({ content: `Revoked by ${interaction.user.tag}`, reply: { messageReference: message.id } });
            }
          }
        }
      } catch (error) {
        console.error('Failed to update infraction log message:', error);
      }
    }

    // DM the user with a simple text message (no embed)
    try {
      const user = await interaction.client.users.fetch(infraction.user_id);
      await user.send(`Your ${infraction.type.toLowerCase()} for \`${infraction.reason}\` in ${GUILD_TAG} was revoked by ${interaction.user.tag}.`);
    } catch {
      // User DMs off or blocked, silently ignore
    }

    return interaction.reply({ content: `✅ Successfully revoked infraction case #${caseId}.`, ephemeral: true });
  }
};
