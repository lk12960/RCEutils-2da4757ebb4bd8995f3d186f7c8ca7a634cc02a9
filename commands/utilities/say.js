const { SlashCommandBuilder } = require('discord.js');
const { isManagement } = require('../../utils/permissions'); // your custom permission check

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message as the bot to a specific channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send the message in')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to send')
        .setRequired(true)),
    // removed setDefaultMemberPermissions to override default permission

  async execute(interaction) {
    // Custom permission check override
    if (!isManagement(interaction.member)) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    if (!channel.isTextBased()) {
      return interaction.reply({ content: '❌ That channel is not text-based.', ephemeral: true });
    }

    try {
      await channel.send(message);
      await interaction.reply({ content: `✅ Message sent in ${channel}.`, ephemeral: true });
    } catch (error) {
      console.error('Failed to send message:', error);
      await interaction.reply({ content: '⚠️ Failed to send the message.', ephemeral: true });
    }
  },
};
