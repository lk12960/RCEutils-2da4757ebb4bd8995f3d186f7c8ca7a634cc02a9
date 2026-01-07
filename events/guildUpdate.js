// events/guildUpdate.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildUpdate',

  async execute(oldGuild, newGuild) {
    const logChannelId = process.env.AUDIT_LOG_CHANNEL_ID;
    const logChannel = newGuild.channels.cache.get(logChannelId);
    if (!logChannel) return;

    let changes = [];

    // Compare relevant guild properties

    if (oldGuild.name !== newGuild.name) {
      changes.push({ name: 'Name', before: oldGuild.name, after: newGuild.name });
    }

    if (oldGuild.description !== newGuild.description) {
      changes.push({ name: 'Description', before: oldGuild.description ?? 'None', after: newGuild.description ?? 'None' });
    }

    if (oldGuild.banner !== newGuild.banner) {
      changes.push({ name: 'Banner', before: oldGuild.bannerURL() || 'None', after: newGuild.bannerURL() || 'None' });
    }

    if (oldGuild.icon !== newGuild.icon) {
      changes.push({ name: 'Icon', before: oldGuild.iconURL() || 'None', after: newGuild.iconURL() || 'None' });
    }

    if (oldGuild.splash !== newGuild.splash) {
      changes.push({ name: 'Splash', before: oldGuild.splashURL() || 'None', after: newGuild.splashURL() || 'None' });
    }

    if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
      const oldAfk = oldGuild.channels.cache.get(oldGuild.afkChannelId)?.name || 'None';
      const newAfk = newGuild.channels.cache.get(newGuild.afkChannelId)?.name || 'None';
      changes.push({ name: 'AFK Channel', before: oldAfk, after: newAfk });
    }

    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      changes.push({ name: 'Verification Level', before: oldGuild.verificationLevel, after: newGuild.verificationLevel });
    }

    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
      changes.push({ name: 'Vanity URL', before: oldGuild.vanityURLCode || 'None', after: newGuild.vanityURLCode || 'None' });
    }

    if (changes.length === 0) return; // No changes to log

    const embed = new EmbedBuilder()
      .setColor(0x3498db) // nice blue
      .setTitle('🛠️ Server Updated')
      .setTimestamp()
      .setFooter({ text: `Guild ID: ${newGuild.id}` });

    changes.forEach(change => {
      // For URL fields, make clickable links
      const beforeValue = change.before.startsWith('http') ? `[Link](${change.before})` : change.before;
      const afterValue = change.after.startsWith('http') ? `[Link](${change.after})` : change.after;
      embed.addFields({ name: change.name, value: `Before: ${beforeValue}\nAfter: ${afterValue}`, inline: false });
    });

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send guildUpdate log:', error);
    }
  },
};
