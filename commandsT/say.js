const { isManagement } = require('../utils/permissions'); // your custom permission check

module.exports = {
  name: 'say',
  description: 'Send a message as the bot to a specific channel',
  usage: '<#channel|channelID> <message>',
  async execute(message, args) {
    // Permission check
    if (!isManagement(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    if (args.length < 2) {
      return message.reply('❌ Usage: say <#channel|channelID> <message>');
    }

    // Get the channel from mention or ID
    const channelArg = args[0];
    let channel = null;

    // Check for channel mention
    if (message.mentions.channels.size > 0) {
      channel = message.mentions.channels.first();
    } else {
      channel = message.guild.channels.cache.get(channelArg);
    }

    if (!channel || !channel.isTextBased()) {
      return message.reply('❌ That channel is not text-based or does not exist.');
    }

    const sayMessage = args.slice(1).join(' ');

    try {
      await channel.send(sayMessage);
      await message.reply(`✅ Message sent in ${channel}.`);
    } catch (error) {
      console.error('Failed to send message:', error);
      await message.reply('⚠️ Failed to send the message.');
    }
  },
};