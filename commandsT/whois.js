const { EmbedBuilder } = require('discord.js');
const { isVerified } = require('../utils/permissions'); // your verified check

module.exports = {
  name: 'whois',
  description: 'Get info about a user by ID or mention',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    if (!isVerified(message.member)) {
      return message.reply('❌ You must be verified to use this command.');
    }

    // Try to get the user from mention or ID
    const user =
      message.mentions.users.first() ||
      message.client.users.cache.get(args[0]);

    if (!user) {
      return message.reply('❌ Please mention a user or provide a valid user ID.');
    }

    // Fetch member from guild cache
    const member = message.guild.members.cache.get(user.id);

    const createdAt = user.createdAt.toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const createdAgo = Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24 * 365)) + ' years ago';

    const embed = new EmbedBuilder()
      .setTitle(`User Information`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setColor(member ? member.displayHexColor : '#5865F2')
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

      try {
        const flags = await user.fetchFlags();
        if (flags.has('HypeSquadBrilliance')) {
          embed.addFields({ name: 'Badge', value: '🎉 HypeSquad Brilliance' });
        }
        // Add other flags here if needed
      } catch {
        // Ignore fetchFlags error silently
      }
    }

    await message.channel.send({ embeds: [embed] });
  },
};