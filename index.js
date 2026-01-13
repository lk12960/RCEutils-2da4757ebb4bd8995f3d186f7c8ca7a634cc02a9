require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
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
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildBans,
  ],
  partials: [
    Partials.Message,
    Partials.Channel, 
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User
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
  
  // Initialize applications database
  try {
    require('./database/applications');
    console.log('✅ Applications database initialized');
  } catch (err) {
    console.error('Failed to initialize applications database:', err);
  }
  
  // Start ban appeal web server (includes applications routes)
  try {
    const { startServer } = require('./appealServer');
    startServer(client, app);
  } catch (err) {
    console.error('Failed to start appeal server:', err);
  }
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

// Styled homepage with portal links
app.get('/', (req, res) => {
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>King's Customs - Portal</title>
  <link rel="stylesheet" href="/css/home.css">
  <link rel="icon" href="${serverLogoUrl}" type="image/png">
</head>
<body>
  <!-- Animated background particles -->
  <div class="particles">
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
    <div class="particle"></div>
  </div>

  <div class="home-container">
    <!-- Logo and title -->
    <div class="logo-section">
      <img src="${serverLogoUrl}" alt="King's Customs" class="server-logo">
      <h1 class="site-title">King's Customs</h1>
      <p class="site-subtitle">Select a portal to continue</p>
      <div class="status-indicator">
        <span class="status-dot"></span>
        All Systems Online
      </div>
    </div>

    <!-- Portal cards -->
    <div class="portal-grid">
      <!-- Ban Appeals -->
      <a href="/appeal" class="portal-card appeals">
        <div class="portal-icon">⚖️</div>
        <h2 class="portal-title">Ban Appeals</h2>
        <p class="portal-description">
          Were you banned? Submit an appeal to request a review of your ban and potentially get unbanned.
        </p>
        <div class="portal-arrow">
          Enter Portal <span>→</span>
        </div>
        <div class="portal-glow"></div>
      </a>

      <!-- Applications -->
      <a href="/applications" class="portal-card applications">
        <div class="portal-icon">📝</div>
        <h2 class="portal-title">Applications</h2>
        <p class="portal-description">
          Looking to join our team? Browse available positions and submit your application.
        </p>
        <div class="portal-arrow">
          Enter Portal <span>→</span>
        </div>
        <div class="portal-glow"></div>
      </a>
    </div>

    <!-- Footer -->
    <div class="home-footer">
      <p>© ${new Date().getFullYear()} King's Customs. All rights reserved.</p>
    </div>
  </div>

  <script>
    // Add mouse tracking glow effect
    document.querySelectorAll('.portal-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
      });
    });
  </script>
</body>
</html>
  `);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🌐 Web server running on port ${PORT}`); });
