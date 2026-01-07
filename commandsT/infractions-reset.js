const { wipeAllInfractions } = require('../utils/infractionManager'); // you’ll create this
const OWNER_ID = '698200964917624936';

module.exports = {
  name: 'wipe-infractions',
  description: 'Wipes ALL infractions from the database (irreversible)',
  usage: '!wipe-infractions',

  async execute(message, args) {
    if (message.author.id !== OWNER_ID) {
      return message.reply('❌ You are not authorized to use this command.');
    }

    try {
      const wipedCount = await wipeAllInfractions();
      return message.channel.send(`✅ Wiped **${wipedCount}** infractions from the database.`);
    } catch (error) {
      console.error('Failed to wipe infractions:', error);
      return message.reply('❌ Failed to wipe infractions. Check the logs.');
    }
  },
};