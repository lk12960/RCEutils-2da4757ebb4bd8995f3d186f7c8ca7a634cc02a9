const { isManagement } = require('../utils/permissions');

module.exports = {
  name: 'purge',
  description: 'Bulk delete messages in the channel',
  usage: '>purge <amount>',

  async execute(message, args) {
    if (!isManagement(message.member)) {
      return message.reply("❌ You don't have permission to manage messages.");
    }

    const amount = parseInt(args[0], 10);

    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('❌ Please specify a number between 1 and 100.');
    }

    try {
      const deleted = await message.channel.bulkDelete(amount, true);
      message.reply(`✅ Deleted ${deleted.size} messages.`);
    } catch (error) {
      console.error(error);
      message.reply('❌ Failed to delete messages. Messages older than 14 days cannot be deleted.');
    }
  },
};
