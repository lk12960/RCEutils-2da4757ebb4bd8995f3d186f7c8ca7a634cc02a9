const { SlashCommandBuilder, userMention } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Ship two users and get a compatibility percentage')
    .addUserOption(option =>
      option.setName('user1')
        .setDescription('First user')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('user2')
        .setDescription('Second user')
        .setRequired(true)),
  async execute(interaction) {
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');

    if (user1.id === user2.id) {
      return interaction.reply({ content: 'You cannot ship someone with themselves!', ephemeral: true });
    }

    const lovePercent = Math.floor(Math.random() * 101);
    let emoji = '💖';

    if (lovePercent > 80) emoji = '🔥';
    else if (lovePercent > 60) emoji = '💘';
    else if (lovePercent > 40) emoji = '💞';
    else if (lovePercent > 20) emoji = '💔';
    else emoji = '💔';

    await interaction.reply(`${userMention(user1.id)} ❤️ ${userMention(user2.id)} = **${lovePercent}%** compatibility! ${emoji}`);
  },
};
