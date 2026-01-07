const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ms = require('ms');
const { createCase } = require('../utils/caseManager');
const LOG_CHANNEL_ID = '1411411537494806709';

module.exports = {
  name: 'mute',
  description: 'Temporarily mute a user using Discord timeout',

  async execute(message, args) {
    // Permission check - require ModerateMembers permission
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply('❌ You need the "Moderate Members" permission to use this command.');
    }

    if (args.length < 2) {
      return message.reply('❌ Usage: !mute <user> <duration> [reason]');
    }

    // Resolve user from mention or ID
    const target =
      message.mentions.users.first() ||
      await message.client.users.fetch(args[0]).catch(() => null);

    if (!target) {
      return message.reply('❌ Please provide a valid user to mute.');
    }

    const durationInput = args[1];
    const reason = args.slice(2).join(' ') || 'No reason provided';

    const durationMs = ms(durationInput);
    if (!durationMs || durationMs < 5000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return message.reply('❌ Invalid duration. Must be between 5 seconds and 28 days.');
    }

    const member = await message.guild.members.fetch(target.id).catch(() => null);
    if (!member || !member.moderatable) {
      return message.reply('❌ I cannot mute this user.');
    }

    try {
      await member.timeout(durationMs, reason);
    } catch (error) {
      console.error('Failed to timeout member:', error);
      return message.reply('❌ Failed to mute the user.');
    }

    const caseId = await createCase(target.id, message.author.id, 'Mute', reason);
    const timestamp = new Date();

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🔇 Member Muted')
      .addFields(
        { name: '➜ User', value: `${target.tag} (<@${target.id}>)`, inline: false },
        { name: '➜ Duration', value: durationInput, inline: false },
        { name: '➜ Reason', value: reason, inline: false },
        { name: '➜ Date', value: `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `Case ID: ${caseId} • ${timestamp.toUTCString()}` });

    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && logChannel.isTextBased()) {
      logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    await message.reply(`🔇 Muted **${target.tag}** for **${durationInput}**\n🆔 Case #${caseId}\n📄 Reason: ${reason}`);
  },
};