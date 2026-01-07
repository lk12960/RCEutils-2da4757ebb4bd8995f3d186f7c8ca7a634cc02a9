const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { isManagement } = require('../../utils/permissions');

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock the current channel (restores message permissions to previous state)'),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isManagement(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const channel = interaction.channel;

    // Check if topic is supported
    if (!('topic' in channel)) {
      return interaction.reply({
        content: '❌ This channel type does not support locking/unlocking.',
        ephemeral: true,
      });
    }

    let topic = channel.topic || '';
    const match = topic.match(/\[lockperms\](.*)$/);

    if (!match) {
      return interaction.reply({
        content: '⚠️ No saved lock permissions found for this channel.',
        ephemeral: true,
      });
    }

    let savedPerms;
    try {
      savedPerms = JSON.parse(match[1]);
    } catch (err) {
      return interaction.reply({
        content: '❌ Failed to parse saved permissions. Data may be corrupted.',
        ephemeral: true,
      });
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

      // Clean up topic
      const newTopic = topic.replace(/\s*\[lockperms\].*$/, '');
      await channel.setTopic(newTopic);

      await channel.send('🔓 This channel has been unlocked.');
      return interaction.reply({
        content: '✅ Channel unlocked successfully.',
        ephemeral: true,
      });
    } catch (err) {
      console.error('Unlock error:', err);
      return interaction.reply({
        content: '❌ Failed to unlock the channel.',
        ephemeral: true,
      });
    }
  },
};