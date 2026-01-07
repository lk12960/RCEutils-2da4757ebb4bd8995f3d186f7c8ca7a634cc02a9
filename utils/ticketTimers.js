const timers = new Map();

function setChannelTimer(channelId, timeout) {
  clearChannelTimer(channelId);
  timers.set(channelId, timeout);
}

function clearChannelTimer(channelId) {
  const t = timers.get(channelId);
  if (t) {
    clearTimeout(t);
    timers.delete(channelId);
  }
}

module.exports = { setChannelTimer, clearChannelTimer };
