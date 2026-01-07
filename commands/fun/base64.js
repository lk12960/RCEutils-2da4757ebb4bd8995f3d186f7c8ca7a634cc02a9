const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('base64')
    .setDescription('Encode or decode text using Base64')
    .addSubcommand(subcommand =>
      subcommand
        .setName('encode')
        .setDescription('Encode text to Base64')
        .addStringOption(option =>
          option.setName('text')
            .setDescription('Text to encode')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('decode')
        .setDescription('Decode Base64 to text')
        .addStringOption(option =>
          option.setName('base64')
            .setDescription('Base64 string to decode')
            .setRequired(true))),
  
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'encode') {
      const text = interaction.options.getString('text');
      const encoded = Buffer.from(text).toString('base64');

      await interaction.reply({
        content: `📥 **Encoded:**\n\`\`\`\n${encoded}\n\`\`\``,
        ephemeral: true
      });
    }

    if (subcommand === 'decode') {
      const base64 = interaction.options.getString('base64');
      try {
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        await interaction.reply({
          content: `📤 **Decoded:**\n\`\`\`\n${decoded}\n\`\`\``,
          ephemeral: true
        });
      } catch (err) {
        await interaction.reply({
          content: '❌ Invalid Base64 string.',
          ephemeral: true
        });
      }
    }
  }
};
