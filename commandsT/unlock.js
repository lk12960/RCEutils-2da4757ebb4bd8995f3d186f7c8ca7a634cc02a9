const { isManagement } = require('../utils/permissions');

module.exports = {
  name: 'unlock',
  description: 'Unlock the current channel (restores message permissions to previous state)',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    if (!isManagement(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const channel = message.channel;

    // Check if channel supports topic property (usually only text channels)
    if (!('topic' in channel)) {
      return message.reply('❌ This channel type does not support locking/unlocking.');
    }

    const topic = channel.topic || '';
    const match = topic.match(/\[lockperms\](.*)$/);

    if (!match) {
      return message.reply('⚠️ No saved lock permissions found for this channel.');
    }

    let savedPerms;
    try {
      savedPerms = JSON.parse(match[1]);
    } catch (err) {
      return message.reply('❌ Failed to parse saved permissions. Data may be corrupted.');
    }

    try {
      for (const [id, status] of Object.entries(savedPerms)) {
        try {
          if (status === 'allow') {
            await channel.permissionOverwrites.edit(id, { SendMessages: true });
          } else if (status === 'deny') {
            await channel.permissionOverwrites.edit(id, { SendMessages: false });
          } else {
            await channel.permissionOverwrites.edit(id, { SendMessages: null });
          }
        } catch (err) {
          console.warn(`Skipping permission restore for ${id}:`, err.message);
        }
      }

      // Remove the lockperms data from the topic
      const newTopic = topic.replace(/\s*\[lockperms\].*$/, '');
      await channel.setTopic(newTopic);

      await channel.send('🔓 This channel has been unlocked.');
      return message.reply('✅ Channel unlocked successfully.');
    } catch (err) {
      console.error('Unlock error:', err);
      return message.reply('❌ Failed to unlock the channel.');
    }
  }
};
