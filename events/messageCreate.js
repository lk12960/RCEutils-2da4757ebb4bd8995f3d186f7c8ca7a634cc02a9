module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;
    try { await (require('../utils/stats').track)('message', 1, message.guild.id); } catch {}

    const prefix = '>';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = client.textCommands.get(commandName); // ⬅️ IMPORTANT: changed to textCommands
    if (!command) return;

    try {
      await command.execute(message, args);
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      message.reply('❌ There was an error executing that command.');
    }
  },
};