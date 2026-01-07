const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('Enlarge a custom emoji to a PNG image')
    .addStringOption(option =>
      option.setName('emoji')
        .setDescription('The emoji to enlarge')
        .setRequired(true)
    ),

  async execute(interaction) {
    const emojiInput = interaction.options.getString('emoji');

    // Regex to match custom emojis: <a:name:id> or <name:id>
    const emojiRegex = /<a?:\w+:(\d+)>/;
    const match = emojiRegex.exec(emojiInput);

    if (!match) {
      // Not a custom emoji, so just reply with the emoji as plain text (can't convert Unicode to PNG easily)
      return interaction.reply({ content: `Here’s your emoji: ${emojiInput}`, ephemeral: true });
    }

    const emojiId = match[1];
    const isAnimated = emojiInput.startsWith('<a:');
    const extension = 'png'; // Discord supports png & gif, but we force png here for simplicity

    // Build URL for emoji image
    const emojiURL = `https://cdn.discordapp.com/emojis/${emojiId}.${extension}?size=512`;

    // Send the emoji image as attachment
    const attachment = new AttachmentBuilder(emojiURL);

    await interaction.reply({ files: [attachment], ephemeral: true });
  },
};