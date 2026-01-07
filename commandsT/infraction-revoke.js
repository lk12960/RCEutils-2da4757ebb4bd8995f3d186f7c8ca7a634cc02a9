const { EmbedBuilder } = require('discord.js');
const infractionManager = require('../utils/infractionManager');
const { isManagement } = require('../utils/permissions');

const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
const DOT_EMOJI = '•'; // your emoji or replace
const GUILD_TAG = "King's Customs"; // your server tag or name to include in DM message

module.exports = {
  name: 'infraction-revoke',
  description: 'Revoke (void) an infraction by case ID',
  usage: '!infraction-revoke <caseId>',
  
  async execute(message, args) {
    if (!isManagement(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const caseId = parseInt(args[0], 10);
    if (!caseId || isNaN(caseId)) {
      return message.reply('❌ You must provide a valid infraction case ID.');
    }

    const infraction = await infractionManager.getInfractionById(caseId);
    if (!infraction) {
      return message.reply(`❌ Infraction case #${caseId} not found.`);
    }

    if (infraction.revoked) {
      return message.reply(`❌ Infraction case #${caseId} is already revoked.`);
    }

    const revoked = await infractionManager.revokeInfraction(caseId);
    if (!revoked) {
      return message.reply('❌ Failed to revoke the infraction.');
    }

    // Update original infraction embed in log channel with revoked status
    if (infraction.message_id && INFRACTIONS_CHANNEL_ID) {
      try {
        const channel = await message.client.channels.fetch(INFRACTIONS_CHANNEL_ID);
        if (channel?.isTextBased()) {
          const logMessage = await channel.messages.fetch(infraction.message_id).catch(() => null);
          if (logMessage) {
            const embed = logMessage.embeds[0];
            if (embed) {
              const revokedEmbed = EmbedBuilder.from(embed)
                .setColor(0x808080)
                .setTitle(embed.data.title ? `~ Revoked ${embed.data.title} ~` : `~ Revoked Infraction Case #${infraction.id} ~`)
                .addFields({ name: 'Status', value: 'Revoked', inline: true })
                .setFooter({
                  text: `Revoked by: ${message.author.tag} ${DOT_EMOJI} ${new Date().toUTCString()}`,
                  iconURL: message.author.displayAvatarURL()
                });

              await logMessage.edit({ embeds: [revokedEmbed], components: [] });
              await channel.send({ content: `Revoked by ${message.author.tag}`, reply: { messageReference: logMessage.id } });
            }
          }
        }
      } catch (error) {
        console.error('Failed to update infraction log message:', error);
      }
    }

    // DM the user with a simple text message (no embed)
    try {
      const user = await message.client.users.fetch(infraction.user_id);
      await user.send(`Your ${infraction.type.toLowerCase()} for \`${infraction.reason}\` in ${GUILD_TAG} was revoked by ${message.author.tag}.`);
    } catch {
      // User DMs off or blocked, silently ignore
    }

    return message.reply(`✅ Successfully revoked infraction case #${caseId}.`);
  }
};