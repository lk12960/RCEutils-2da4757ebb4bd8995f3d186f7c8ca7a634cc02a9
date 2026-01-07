// commands/remindme.js
const ms = require('ms');

module.exports = {
  name: 'remindme',
  description: 'Set a reminder and get pinged when the time is up',
  usage: '<minutes> <message>',
  async execute(message, args) {
    if (args.length < 2) {
      return message.reply('❌ Usage: !remindme <minutes> <message>');
    }

    const minutes = parseInt(args[0], 10);
    if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
      return message.reply('❌ Invalid minutes. Must be a number between 1 and 1440 (24 hours).');
    }

    const reminderMessage = args.slice(1).join(' ');
    await message.reply(`⏰ Reminder set for ${minutes} minute(s). I will ping you then!`);

    setTimeout(() => {
      // Make sure channel still exists (e.g. message.channel can be deleted)
      if (!message.channel) return;
      message.channel.send(`${message.author}, ⏰ Reminder: ${reminderMessage}`).catch(console.error);
    }, minutes * 60 * 1000);
  },
};