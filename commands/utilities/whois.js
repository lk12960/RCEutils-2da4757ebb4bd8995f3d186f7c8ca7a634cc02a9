const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND_COLOR_HEX } = require('../../utils/branding');
const { isVerified } = require('../../utils/permissions'); // your verified check

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Get info about a user by ID')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to get info about')
        .setRequired(true)
    ),

  async execute(interaction) {
    // Verified permission check
    if (!isVerified(interaction.member)) {
      return interaction.reply({ content: '❌ You must be verified to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(user.id);

    const createdAt = user.createdAt.toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const createdAgo = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24 * 365)) + ' years ago';

    const embed = new EmbedBuilder()
      .setTitle(`User Information`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setColor(BRAND_COLOR_HEX)
      .addFields(
        { name: 'Mention', value: `<@${user.id}>`, inline: true },
        { name: 'Username', value: user.tag, inline: true },
        { name: 'ID', value: user.id, inline: true },
        { name: 'Account Created', value: `${createdAt} (${createdAgo})` }
      );

    if (!member) {
      embed.setDescription('⚠️ This user is not in this server.');
    } else {
      const joinedAt = member.joinedAt
        ? member.joinedAt.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
        : 'Unknown';
      embed.addFields({ name: 'Joined Server', value: joinedAt, inline: true });

      const flags = await user.fetchFlags();
      if (flags.has('HypeSquadBrilliance')) {
        embed.addFields({ name: 'Badge', value: '🎉 HypeSquad Brilliance' });
      }
      // Add other flags if you want
    }

    await interaction.reply({ embeds: [embed] });
  },
};
