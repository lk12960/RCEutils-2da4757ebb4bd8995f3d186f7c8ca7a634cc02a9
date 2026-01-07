const { createCase } = require('../utils/caseManager');
const { isModerator } = require('../utils/permissions'); // your custom permission check

const LOG_CHANNEL_ID = process.env.MOD_LOG_CHANNEL_ID || process.env.AUDIT_LOG_CHANNEL_ID;

module.exports = {
  name: 'kick',
  description: 'Kick a user from the server',
  usage: '!kick @user [reason]',

  async execute(message, args) {
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    // Check for mention
    const target = message.mentions.users.first();
    if (!target) {
      return message.reply('❌ Please mention a user to kick.');
    }

    const member = await message.guild.members.fetch(target.id).catch(() => null);
    if (!member || !member.kickable) {
      return message.reply('❌ I cannot kick this user.');
    }

    // Reason is everything after the mention
    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      await member.kick(reason);

      const caseId = await createCase(target.id, message.author.id, 'Kick', reason);
      const timestamp = new Date();

      const embed = {
        color: 0xffa500,
        title: '👢 Member Kicked',
        fields: [
          { name: '➜ User', value: `${target.tag} (<@${target.id}>)`, inline: false },
          { name: '➜ Reason', value: reason, inline: false },
          { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false },
        ],
        footer: { text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` },
      };

      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel && logChannel.isTextBased()) {
        logChannel.send({ embeds: [embed] }).catch(console.error);
      }

      await message.channel.send(`👢 Kicked **${target.tag}**\n🆔 Case #${caseId}\n📄 Reason: ${reason}`);
    } catch (error) {
      console.error(error);
      message.reply('❌ Failed to kick the user.');
    }
  },
};