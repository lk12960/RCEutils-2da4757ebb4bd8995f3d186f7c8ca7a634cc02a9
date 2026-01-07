const { isModerator } = require('../utils/permissions'); // use moderator check

module.exports = {
  name: 'addrole',
  description: 'Add a role to a user',
  usage: '>addrole @user @role',

  async execute(message, args) {
    if (!isModerator(message.member)) {
      return message.reply('❌ You do not have permission to manage roles.');
    }

    const user = message.mentions.users.first();
    const role = message.mentions.roles.first();

    if (!user || !role) {
      return message.reply('❌ Usage: `>addrole @user @role`');
    }

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return message.reply('❌ Could not find that user in the server.');
    }

    // Check bot's role hierarchy
    const botMember = message.guild.members.me;
    if (botMember.roles.highest.position <= role.position) {
      return message.reply("❌ I don't have permission to assign that role.");
    }

    try {
      await member.roles.add(role, `Role added by ${message.author.tag}`);
      return message.reply(`✅ Added role **${role.name}** to ${user.tag}.`);
    } catch (error) {
      console.error(error);
      return message.reply('❌ Failed to add role. Check my permissions and role hierarchy.');
    }
  },
};
