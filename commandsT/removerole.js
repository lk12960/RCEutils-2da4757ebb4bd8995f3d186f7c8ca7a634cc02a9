const { isModerator } = require('../utils/permissions'); // your custom permission check

module.exports = {
  name: 'removerole',
  description: 'Remove a role from a user',
  usage: '<user> <role>',
  async execute(message, args) {
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to manage roles.');
    }

    if (args.length < 2) {
      return message.reply('❌ Usage: removerole <user> <role>');
    }

    // Resolve user mention or ID
    const userArg = args[0];
    const roleArg = args.slice(1).join(' ');

    // Try to get the member from mention or ID
    const member = message.mentions.members.first() || await message.guild.members.fetch(userArg).catch(() => null);
    if (!member) {
      return message.reply('User not found in this server.');
    }

    // Try to find the role by mention, ID, or name (case-insensitive)
    let role = message.mentions.roles.first() || message.guild.roles.cache.get(roleArg);
    if (!role) {
      role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
    }
    if (!role) {
      return message.reply('Role not found.');
    }

    // Check bot role position vs role to remove
    if (message.guild.members.me.roles.highest.position <= role.position) {
      return message.reply("❌ I don't have permission to remove that role.");
    }

    try {
      await member.roles.remove(role, `Role removed by ${message.author.tag}`);
      await message.reply(`Removed role **${role.name}** from ${member.user.tag}.`);
    } catch (error) {
      console.error(error);
      await message.reply('Failed to remove role. Check my permissions and role hierarchy.');
    }
  },
};