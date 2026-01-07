// Text command: >stop
// Safely shuts down the bot. Restricted to the bot owner.

module.exports = {
  name: 'stop',
  description: 'Shut down the bot (owner only)',
  usage: '',
  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    const ownerId = (process.env.OWNER_ID || '698200964917624936').trim();

    if (message.author.id !== ownerId) {
      return message.reply('❌ You are not authorized to stop the bot.');
    }

    try {
      await message.reply('🛑 Shutting down...');
      // Give Discord a moment to send the reply before destroying
      setTimeout(async () => {
        try {
          await message.client.destroy();
        } catch (e) {
          // ignore
        }
        process.exit(0);
      }, 500);
    } catch (err) {
      console.error('Failed to shut down gracefully:', err);
      process.exit(1);
    }
  }
};
