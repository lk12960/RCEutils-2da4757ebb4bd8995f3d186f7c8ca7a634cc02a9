const { EmbedBuilder } = require('discord.js');
const { isVerified } = require('../utils/permissions');

module.exports = {
  name: 'feedback',
  description: 'Send feedback for a staff member or the server.',
  usage: '>feedback <staff|server> <rating 1-5> [@staffMember] [comments...]',
  async execute(message, args) {
    if (!isVerified(message.member)) {
      return message.reply('❌ You must be verified to use this command.');
    }

    const type = args[0]?.toLowerCase();
    const rating = parseInt(args[1]);
    const isStaff = type === 'staff';

    if (!['staff', 'server'].includes(type)) {
      return message.reply('❌ Invalid feedback type. Must be `staff` or `server`.\nExample: `>feedback staff 5 @User Great help!`');
    }

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return message.reply('❌ Rating must be a number between 1 and 5.');
    }

    let staffMember = null;
    let comments = 'No additional comments';

    if (isStaff) {
      staffMember = message.mentions.users.first();
      if (!staffMember) {
        return message.reply('❌ You must mention a staff member for staff feedback.');
      }
      comments = args.slice(3).join(' ') || comments;
    } else {
      comments = args.slice(2).join(' ') || comments;
    }

    const channelId = process.env.FEEDBACK_CHANNEL_ID;
    const feedbackChannel = await message.client.channels.fetch(channelId).catch(() => null);

    if (!feedbackChannel) {
      return message.reply('❌ Feedback channel not found. Please contact an administrator.');
    }

    const embed = new EmbedBuilder()
      .setTitle('New Feedback Received')
      .setColor('#0099ff')
      .addFields(
        { name: 'Feedback Type', value: isStaff ? 'Staff Member' : 'Server' },
        { name: 'Rating', value: rating.toString(), inline: true },
        { name: 'From', value: `${message.author.tag} (${message.author.id})` },
      )
      .setTimestamp();

    if (isStaff) {
      embed.addFields({ name: 'Staff Member', value: `${staffMember.tag} (${staffMember.id})` });
    }

    embed.addFields({ name: 'Comments', value: comments });

    await feedbackChannel.send({ embeds: [embed] });
    await message.reply('✅ Thank you for your feedback! 🙏');
  },
};
