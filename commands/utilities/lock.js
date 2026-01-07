const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { isManagement } = require('../../utils/permissions');

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock the current channel (prevents members from sending messages)'),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You need Management permission to use this command.', ephemeral: true });
    }

    const channel = interaction.channel;
    const everyoneRole = interaction.guild.roles.everyone;
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
      // Save in topic (if supported)
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
      return interaction.reply({ content: '✅ Channel locked successfully.', ephemeral: true });

    } catch (err) {
      console.error('Error locking channel:', err);
      return interaction.reply({ content: '❌ Failed to lock the channel.', ephemeral: true });
    }
  },
};
