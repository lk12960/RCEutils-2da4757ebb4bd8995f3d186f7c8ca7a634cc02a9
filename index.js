require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping
  ],
});

client.commands = new Collection();
client.textCommands = new Collection(); // For >prefix commands

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);

    if (command?.data?.name) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`⚠️ Command at ${filePath} is missing "data.name"`);
    }
  }
}

// Load text commands
const textCommandsPath = path.join(__dirname, 'commandsT');
if (fs.existsSync(textCommandsPath)) {
  const textCommandFiles = fs.readdirSync(textCommandsPath).filter(file => file.endsWith('.js'));

  for (const file of textCommandFiles) {
    const filePath = path.join(textCommandsPath, file);
    const command = require(filePath);

    if (command?.name) {
      client.textCommands.set(command.name, command);
    } else {
      console.warn(`⚠️ Text command at ${filePath} is missing "name"`);
    }
  }
} else {
  console.warn(`⚠️ Text commands directory not found at ${textCommandsPath}`);
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Import your status setter utility here:
const setBotStatus = require('./utils/setStatus');

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`Build marker: ${new Date().toISOString()} (startup)`);

  try {
    await setBotStatus(client); // Set status immediately on startup
  } catch (err) {
    console.error('Failed to set bot status on startup:', err);
  }

  setInterval(async () => {
    try {
      await setBotStatus(client); // Update status every 2.5 minutes
    } catch (err) {
      console.error('Failed to update bot status:', err);
    }
  }, 150000); // 150000 ms = 2.5 minutes
});

const TOKEN = (process.env.TOKEN || '').trim();
const CLIENT_ID = (process.env.CLIENT_ID || '').trim();
const GUILD_ID = (process.env.GUILD_ID || '').trim();
console.log('🔍 ENV CHECK:', {
  TOKEN_present: TOKEN.length >= 10,
  CLIENT_ID_present: !!CLIENT_ID,
  GUILD_ID_present: !!GUILD_ID,
});

console.log('🚀 Attempting Discord login...');
client.login(TOKEN);

// Soft watchdog: warn if ready doesn't fire within 30s (do not exit)
let readyFired = false;
client.once('ready', () => { readyFired = true; });
setTimeout(() => {
  if (!readyFired) {
    console.warn('⏳ Discord ready event not fired within 30s. If this persists, check: TOKEN validity, privileged intents enabled on the app, and whether the bot is invited to the guild.');
  }
}, 30000);

// Diagnostics
client.on('error', (e) => console.error('Client error:', e));
client.on('shardError', (e) => console.error('Shard error:', e));
process.on('unhandledRejection', (r) => console.error('UnhandledRejection:', r));
process.on('uncaughtException', (e) => console.error('UncaughtException:', e));

// Minimal parsers
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// Status root remains simple
app.get('/', (req, res) => {
  res.send('King\'s Customs bot is online');
});

// Start server
const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => { console.log(`🌐 Web server running on port ${PORT}`); });
