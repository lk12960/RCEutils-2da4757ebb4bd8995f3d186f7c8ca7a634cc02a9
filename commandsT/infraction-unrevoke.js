const { EmbedBuilder } = require('discord.js');
const infractionManager = require('../utils/infractionManager');
const { isManagement } = require('../utils/permissions');

const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
const DOT_EMOJI = '•';
const GUILD_TAG = "King's Customs"; // Your server tag for DM message

module.exports = {
  name: 'infraction-unrevoke',
  description: 'Unrevoke an infraction by case ID',
  usage: '!infraction-unrevoke <caseId>',

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

    if (!infraction.revoked) {
      return message.reply(`❌ Infraction case #${caseId} is not revoked.`);
    }

    const unrevokeResult = await infractionManager.unrevokeInfraction(caseId);
    if (!unrevokeResult) {
      return message.reply('❌ Failed to unrevoke the infraction.');
    }

    // Update original infraction message embed (restore original info)
    if (infraction.message_id && INFRACTIONS_CHANNEL_ID) {
      try {
        const channel = await message.client.channels.fetch(INFRACTIONS_CHANNEL_ID);
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
              msg.author.id === message.client.user.id &&
              msg.reference?.messageId === originalMessage.id &&
              msg.content?.startsWith('Revoked by')
            );

            if (revocationMessage) {
              await revocationMessage.edit({ content: `Unrevoked by ${message.author.tag}` });
            }
          }
        }
      } catch (error) {
        console.error('Failed to update infraction log messages:', error);
      }
    }

    // DM the user a simple plain text message (no embed)
    try {
      const user = await message.client.users.fetch(infraction.user_id);
      await user.send(
        `Your ${infraction.type.toLowerCase()} for \`${infraction.reason}\` in ${GUILD_TAG} has been **unrevoked** by ${message.author.tag}.`
      );
    } catch {
      // silently fail if DMs are closed
    }

    return message.reply(`✅ Successfully unrevoked infraction case #${caseId}.`);
  },
};
