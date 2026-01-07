const {
  EmbedBuilder,
} = require('discord.js');
const {
  getCaseById,
  voidCase,
  unvoidCase,
  updateCaseReason,
  updateCaseUser,
  updateCaseAction,
  updateCaseModerator,
} = require('../utils/caseManager');
const { isManagement } = require('../utils/permissions');

module.exports = {
  name: 'editcase',
  description: 'View and edit a moderation case.',
  usage: '>editcase <caseId>',
  async execute(message, args) {
    if (!isManagement(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const caseId = parseInt(args[0]);
    if (isNaN(caseId)) {
      return message.reply('❌ Please provide a valid case ID. Example: `>editcase 123`');
    }

    let modCase = await getCaseById(caseId);
    if (!modCase) {
      return message.reply(`❌ Case ID ${caseId} not found.`);
    }

    const buildEmbed = (modCase) => {
      return new EmbedBuilder()
        .setColor(modCase.voided ? 0x95a5a6 : 0x3498db)
        .setTitle(`Case #${modCase.id} ${modCase.voided ? '(Voided)' : ''}`)
        .addFields(
          { name: 'User ID', value: modCase.user_id, inline: true },
          { name: 'Moderator ID', value: modCase.moderator_id, inline: true },
          { name: 'Action', value: modCase.action, inline: true },
          { name: 'Reason', value: modCase.reason || 'No reason provided', inline: false },
          { name: 'Date', value: new Date(modCase.timestamp).toUTCString(), inline: false },
        );
    };

    const sent = await message.reply({
      embeds: [buildEmbed(modCase)],
      content: `🛠️ React to edit the case:
1️⃣ Void Case
2️⃣ Unvoid Case
3️⃣ Edit Reason
4️⃣ Edit User ID
5️⃣ Edit Action
6️⃣ Edit Moderator ID
❌ Cancel`,
    });

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '❌'];
    for (const emoji of emojis) await sent.react(emoji);

    const filter = (reaction, user) => emojis.includes(reaction.emoji.name) && user.id === message.author.id;
    const collector = sent.createReactionCollector({ filter, time: 5 * 60 * 1000, max: 1 });

    collector.on('collect', async (reaction) => {
      const choice = reaction.emoji.name;

      const promptInput = async (label) => {
        await message.channel.send(`💬 Enter the new ${label}:`);
        const msgFilter = m => m.author.id === message.author.id;
        const collected = await message.channel.awaitMessages({ filter: msgFilter, max: 1, time: 30000 });
        return collected.first()?.content || null;
      };

      try {
        switch (choice) {
          case '1️⃣':
            await voidCase(caseId);
            modCase = await getCaseById(caseId);
            await sent.edit({ embeds: [buildEmbed(modCase)], content: '✅ Case voided.' });
            break;
          case '2️⃣':
            await unvoidCase(caseId);
            modCase = await getCaseById(caseId);
            await sent.edit({ embeds: [buildEmbed(modCase)], content: '✅ Case unvoided.' });
            break;
          case '3️⃣':
            const reason = await promptInput('reason');
            if (reason) {
              await updateCaseReason(caseId, reason);
              modCase = await getCaseById(caseId);
              await sent.edit({ embeds: [buildEmbed(modCase)], content: '✅ Reason updated.' });
            }
            break;
          case '4️⃣':
            const userId = await promptInput('user ID');
            if (userId) {
              await updateCaseUser(caseId, userId);
              modCase = await getCaseById(caseId);
              await sent.edit({ embeds: [buildEmbed(modCase)], content: '✅ User updated.' });
            }
            break;
          case '5️⃣':
            const action = await promptInput('action');
            if (action) {
              await updateCaseAction(caseId, action);
              modCase = await getCaseById(caseId);
              await sent.edit({ embeds: [buildEmbed(modCase)], content: '✅ Action updated.' });
            }
            break;
          case '6️⃣':
            const modId = await promptInput('moderator ID');
            if (modId) {
              await updateCaseModerator(caseId, modId);
              modCase = await getCaseById(caseId);
              await sent.edit({ embeds: [buildEmbed(modCase)], content: '✅ Moderator updated.' });
            }
            break;
          case '❌':
            await sent.edit({ content: '❌ Cancelled.', embeds: [] });
            break;
        }
      } catch (err) {
        console.error(err);
        await message.reply('❌ Something went wrong during the edit.');
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) sent.edit({ content: '⏱️ Timed out.', components: [], embeds: [] }).catch(() => {});
    });
  },
};