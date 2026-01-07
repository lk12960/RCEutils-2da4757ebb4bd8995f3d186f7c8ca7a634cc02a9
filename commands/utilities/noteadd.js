const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { addNote } = require('../../utils/noteManager');
const { isModerator } = require('../../utils/permissions');

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

const { requireTier } = require('../../utils/permissions');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Manage notes for a user')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a note to a user')
        .addUserOption(option =>
          option.setName('target').setDescription('User to add note for').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('note').setDescription('Content of the note').setRequired(true)
        )
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
    const noteContent = interaction.options.getString('note');

    try {
      const noteId = await addNote(target.id, interaction.user.id, noteContent);
      const timestamp = new Date();

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('📝 Note Added')
        .addFields(
          { name: '➜ User', value: `${target.tag} (<@${target.id}>)`, inline: false },
          { name: '➜ Note', value: noteContent, inline: false },
          { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false },
        )
        .setFooter({ text: `Note ID: ${noteId} • ${timestamp.toUTCString()}` });

      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel?.isTextBased()) {
        logChannel.send({ embeds: [embed] }).catch(console.error);
      }

      await interaction.reply({
        content: `📝 Added note for **${target.tag}**\n🆔 Note #${noteId}\n📄 Note: ${noteContent}`,
        ephemeral: false,
      });
    } catch (error) {
      console.error('Error adding note:', error);
      await interaction.reply({
        content: '❌ Failed to add note. Please try again later.',
        ephemeral: true,
      });
    }
  },
};