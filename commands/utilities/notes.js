const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { getUserNotes } = require('../../utils/noteManager');
const { isModerator } = require('../../utils/permissions');

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('notes')
    .setDescription('View all notes for a user')
    .addUserOption(option =>
      option.setName('target').setDescription('User to view notes for').setRequired(true)
    ),

  async execute(interaction) {
    if (!requireTier(interaction.member, 'moderator')) return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    if (!isModerator(interaction.member)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser('target');

    try {
      const notes = await getUserNotes(target.id);

      if (notes.length === 0) {
        return interaction.reply({
          content: `📝 No notes found for **${target.tag}**.`,
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📝 Notes for ${target.tag}`)
        .setDescription(
          notes
            .map(
              note =>
                `**Note ID:** ${note.id}\n**Content:** ${note.content}\n**Added by:** <@${note.moderatorId}>\n**Date:** <t:${Math.floor(
                  new Date(note.timestamp).getTime() / 1000
                )}:F>`
            )
            .join('\n\n')
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Error fetching notes:', error);
      await interaction.reply({
        content: '❌ Failed to fetch notes. Please try again later.',
        ephemeral: true,
      });
    }
  },
};