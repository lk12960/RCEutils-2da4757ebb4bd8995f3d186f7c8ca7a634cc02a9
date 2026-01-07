const { PermissionsBitField } = require('discord.js');
const { isManagement } = require('../utils/permissions');

module.exports = {
  name: 'lock',
  description: 'Lock the current channel (prevents members from sending messages)',

  async execute(message, args) {
    if (!isManagement(message.member)) {
      return message.reply('❌ You need Management permission to use this command.');
    }

    const channel = message.channel;
    const everyoneRole = message.guild.roles.everyone;
    const SEND_MESSAGES = PermissionsBitField.Flags.SendMessages;

    const savedPerms = {};

    // Save current permission states
    for (const [id, overwrite] of channel.permissionOverwrites.cache) {
      if (overwrite.allow.has(SEND_MESSAGES)) {
        savedPerms[id] = 'allow';
      } else if (overwrite.deny.has(SEND_MESSAGES)) {
        savedPerms[id] = 'deny';
      } else {
        savedPerms[id] = 'neutral';
      }
    }

    try {
      // Save permissions snapshot in topic if supported
      if ('setTopic' in channel && typeof channel.topic !== 'undefined') {
        let topic = channel.topic || '';
        topic = topic.replace(/\[lockperms\].*$/, '').trim();
        const newTopic = `${topic} [lockperms]${JSON.stringify(savedPerms)}`;
        await channel.setTopic(newTopic);
      }

      // Deny everyone from sending messages
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });

      // Also deny send permission to roles/users that had it allowed
      for (const [id, status] of Object.entries(savedPerms)) {
        if (id !== everyoneRole.id && status === 'allow') {
          try {
            await channel.permissionOverwrites.edit(id, { SendMessages: false });
          } catch (err) {
            console.warn(`Skipping overwrite for ${id} (may be managed or invalid):`, err.message);
          }
        }
      }

      await channel.send('🔒 This channel has been locked.');
      return message.reply('✅ Channel locked successfully.');
    } catch (err) {
      console.error('Error locking channel:', err);
      return message.reply('❌ Failed to lock the channel.');
    }
  },
};