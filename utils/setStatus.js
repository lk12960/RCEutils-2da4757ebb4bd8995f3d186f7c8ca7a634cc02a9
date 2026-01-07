module.exports = async function setBotStatus(client) {
  if (!client || !client.user) return;

  try {
    await client.user.setStatus('dnd');
    await client.user.setActivity("King's Customs", { type: 'WATCHING' });
  } catch (error) {
    console.error('Error setting bot status:', error);
  }
};
