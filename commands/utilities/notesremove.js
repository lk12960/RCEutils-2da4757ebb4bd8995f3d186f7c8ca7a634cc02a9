const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { removeNote } = require('../../utils/noteManager');
const { isModerator } = require('../../utils/permissions');

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('note-remove')
    .setDescription('Remove a note from a user by its ID')
    .addStringOption(option =>
      option
        .setName('noteid')
        .setDescription('The ID of the note to remove')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for removing the note')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isModerator(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const noteId = interaction.options.getString('noteid');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const removedNote = await removeNote(noteId);
      if (!removedNote) {
        return interaction.reply({
          content: `❌ No note found with ID **${noteId}**.`,
          ephemeral: true,
        });
      }

      const timestamp = new Date();
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🗑️ Note Removed')
        .addFields(
          { name: '➜ User', value: `<@${removedNote.userId}>`, inline: false },
          { name: '➜ Note ID', value: noteId, inline: false },
          { name: '➜ Note Content', value: removedNote.content, inline: false },
          { name: '➜ Reason', value: reason, inline: false },
          { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false },
        )
        .setFooter({ text: `${timestamp.toUTCString()}` });

      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel?.isTextBased()) {
        logChannel.send({ embeds: [embed] }).catch(console.error);
      }

      await interaction.reply({
        content: `🗑️ Removed note **${noteId}** for user <@${removedNote.userId}>\n📄 Reason: ${reason}`,
        ephemeral: false,
      });
    } catch (error) {
      console.error('Error removing note:', error);
      await interaction.reply({
        content: '❌ Failed to remove note. Please try again later.',
        ephemeral: true,
      });
    }
  },
};