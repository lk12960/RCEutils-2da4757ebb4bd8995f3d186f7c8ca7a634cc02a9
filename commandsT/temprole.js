const ms = require('ms');
const { isModerator } = require('../utils/permissions');

module.exports = {
  name: 'temprole',
  description: 'Manage temporary roles',
  usage: 'add <user> <role> <duration>',
  
  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   */
  async execute(message, args) {
    if (!isModerator(message.member)) {
      return message.reply("❌ You do not have permission to manage temporary roles.");
    }

    if (args[0] !== 'add') {
      return message.reply("❌ Invalid subcommand. Only `add` is supported in this text command.");
    }

    // Expecting: !temprole add @user RoleName 10m
    const userArg = args[1];
    const roleArg = args[2];
    const durationString = args.slice(3).join(' ');

    if (!userArg || !roleArg || !durationString) {
      return message.reply('Usage: temprole add <user> <role> <duration>\nExample: temprole add @User Member 10m');
    }

    // Resolve member from mention or ID
    const member = message.mentions.members.first() || await message.guild.members.fetch(userArg).catch(() => null);
    if (!member) {
      return message.reply('User not found in this guild.');
    }

    // Resolve role by mention, ID or name
    let role = null;
    if (message.mentions.roles.size) {
      role = message.mentions.roles.first();
    } else {
      role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase()) || message.guild.roles.cache.get(roleArg);
    }

    if (!role) {
      return message.reply('Role not found. Mention the role or provide its ID or exact name.');
    }

    const duration = ms(durationString);
    if (!duration || duration < 1000) {
      return message.reply('Please provide a valid duration (e.g., 10m, 2h, 1d).');
    }

    // Check bot role hierarchy
    if (!(message.guild.members.me.roles.highest.position > role.position)) {
      return message.reply("❌ I can't assign that role because it is higher than my highest role.");
    }

    try {
      await member.roles.add(role, `Temporary role assigned by ${message.author.tag} for ${durationString}`);

      await message.reply(`Added role ${role.name} to ${member.user.tag} for ${durationString}.`);

      setTimeout(async () => {
        const refreshedMember = await message.guild.members.fetch(member.id).catch(() => null);
        if (refreshedMember && refreshedMember.roles.cache.has(role.id)) {
          await refreshedMember.roles.remove(role, 'Temporary role duration expired');
        }
      }, duration);

    } catch (error) {
      console.error(error);
      return message.reply('Failed to assign the role. Make sure I have the correct permissions and role hierarchy.');
    }
  }
};
