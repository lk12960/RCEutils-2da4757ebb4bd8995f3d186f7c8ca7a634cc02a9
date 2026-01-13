// Ban Appeal Web Server with Discord OAuth
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getBanAppeal, getBanCaseDetails, getCooldownInfo, createBanAppeal } = require('./utils/banAppeals');

// Use provided app or create new one
let app = null;
const PORT = process.env.APPEAL_SERVER_PORT || 3001; // Different port from main server
const BASE_URL = process.env.APPEAL_BASE_URL || `http://localhost:${PORT}`;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = `${BASE_URL}/auth/discord/callback`;

// Create sessions directory if it doesn't exist
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

// Create appeals data directory
const appealsDataDir = path.join(__dirname, 'appeal_data');
if (!fs.existsSync(appealsDataDir)) {
  fs.mkdirSync(appealsDataDir, { recursive: true });
}

const appealsDataFile = path.join(appealsDataDir, 'appeals.json');

// Store appeal data (appealId -> { userId, guildId, createdAt, expiresAt })
const appealData = new Map();

// Load appeal data from file on startup
function loadAppealData() {
  try {
    if (fs.existsSync(appealsDataFile)) {
      const data = JSON.parse(fs.readFileSync(appealsDataFile, 'utf8'));
      const now = Date.now();
      
      // Load non-expired appeals
      for (const [id, appeal] of Object.entries(data)) {
        if (appeal.expiresAt > now) {
          appealData.set(id, appeal);
        }
      }
      console.log(`📝 Loaded ${appealData.size} active appeal(s)`);
    }
  } catch (error) {
    console.error('Error loading appeal data:', error);
  }
}

// Save appeal data to file
function saveAppealData() {
  try {
    const data = Object.fromEntries(appealData);
    fs.writeFileSync(appealsDataFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving appeal data:', error);
  }
}

// Cleanup expired appeals every hour
setInterval(() => {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [id, data] of appealData.entries()) {
    if (data.expiresAt && data.expiresAt < now) {
      appealData.delete(id);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} expired appeal(s)`);
    saveAppealData();
  }
}, 60 * 60 * 1000);

/**
 * Initialize the appeal system with an Express app
 */
function initializeApp(expressApp) {
  app = expressApp;
  
  // Check if session middleware already exists
  const hasSession = app._router && app._router.stack.some(layer => 
    layer.name === 'session' || (layer.handle && layer.handle.name === 'session')
  );
  
  if (hasSession) {
    console.log('📝 Session middleware already registered, skipping');
    registerRoutes();
    return;
  }
  
  // Ensure static files are served (CSS, images, etc.)
  app.use(express.static('public'));
  
  // These might already be set up by main app, but ensure they're available
  if (!app._json_parser) {
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
  }
  
  // Session must be set BEFORE routes
  const sessionMiddleware = session({
    store: new FileStore({
      path: sessionsDir,
      ttl: 86400, // 24 hours in seconds
      retries: 2,
      reapInterval: 3600, // Cleanup expired sessions every hour
      logFn: () => {} // Suppress logs
    }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: true, // Changed to true to ensure saves
    saveUninitialized: false,
    name: 'appeal_session', // Use different cookie name to avoid conflicts
    cookie: { 
      secure: false, // Set to false for testing, should be true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' // Important for OAuth redirects
    }
  });
  
  // Apply session to all routes
  app.use(sessionMiddleware);
  
  console.log('📝 Session middleware registered');
  console.log('🎨 Static files being served from /public');
  
  registerRoutes();
}

/**
 * Create a new appeal URL for a banned user
 */
function createAppealUrl(userId, guildId, banInfo) {
  const appealId = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days from creation
  
  appealData.set(appealId, {
    userId,
    guildId,
    banInfo,
    createdAt: Date.now(),
    expiresAt,
    lastAccessedAt: Date.now()
  });
  
  // Save to file immediately
  saveAppealData();
  
  console.log(`📝 Created appeal link for user ${userId} in guild ${guildId}: ${appealId}`);
  
  return `${BASE_URL}/appeal/${appealId}`;
}

// ============================================================================
// MIDDLEWARE: Authentication Check
// ============================================================================
function requireAuth(req, res, next) {
  console.log(`🔍 Auth check for ${req.originalUrl} - Session user:`, req.session?.user?.username || 'NOT LOGGED IN');
  
  if (!req.session || !req.session.user) {
    // Store the original URL they tried to access
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    console.log(`❌ No auth, redirecting to /login`);
    return res.redirect('/login');
  }
  
  console.log(`✅ Auth OK for user ${req.session.user.username}`);
  next();
}

/**
 * Register all appeal routes
 */
function registerRoutes() {
  if (!app) {
    console.error('❌ Cannot register routes: app not initialized');
    return;
  }

// ============================================================================
// DISCORD OAUTH ROUTES
// ============================================================================

  /**
   * GET /login - Show login page
   */
  app.get('/login', (req, res) => {
  const authUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;
  
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Ban Appeals</title>
  <link rel="stylesheet" href="/css/appeal.css">
</head>
<body>
  <div class="container">
    <div class="appeal-card login-card">
      <div class="header">
        <h1>🔐 Login Required</h1>
        <p class="subtitle">Authenticate with Discord to continue</p>
      </div>
      
      <div class="login-content">
        <p class="login-description">
          You must log in with your Discord account to view or submit ban appeals.
        </p>
        
        <a href="${authUrl}" class="discord-login-button">
          <svg class="discord-icon" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
          <span>Login with Discord</span>
        </a>
        
        <div class="login-note">
          <p>🔒 We only request permission to verify your Discord identity.</p>
          <p>Your information is secure and not stored permanently.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `);
});

  /**
   * GET /auth/discord/callback - OAuth callback
   */
  app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('No code provided');
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.error('No access token received:', tokenData);
      return res.status(500).send('Failed to authenticate');
    }
    
    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    
    const userData = await userResponse.json();
    
    // Store user in session
    req.session.user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
    };
    
    // Get return URL before clearing it
    const returnTo = req.session.returnTo || '/appeal-home';
    delete req.session.returnTo;
    
    console.log(`✅ User ${userData.username} (${userData.id}) authenticated, redirecting to: ${returnTo}`);
    
    // Save session before redirecting (critical!)
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).send('Failed to save session');
      }
      res.redirect(returnTo);
    });
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('Authentication failed');
  }
});

  /**
   * GET /logout - Logout user
   */
  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/appeal-home');
  });

  /**
   * GET /test - Test route to verify server is working
   */
  app.get('/test', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'Appeal server is running',
      timestamp: new Date().toISOString(),
      activeAppeals: appealData.size
    });
  });

  // ============================================================================
  // APPEAL ROUTES
  // ============================================================================

  /**
   * GET /appeal - Main appeal entry point - checks ban status and redirects accordingly
   */
  app.get('/appeal', requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const db = require('./database/db');
    const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
    
    try {
      // Check if user has any active bans
      const bans = await new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM cases WHERE user_id = ? AND action = 'BAN' ORDER BY timestamp DESC`,
          [String(userId)],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });
      
      if (bans.length === 0) {
        // User is NOT banned - show styled "not banned" page
        return res.send(generateStyledNotBannedPage(req.session.user, serverLogoUrl));
      }
      
      // User IS banned - check for existing appeal link or create one
      const ban = bans[0]; // Most recent ban
      
      // Look for an existing active appeal link for this user
      let existingAppealId = null;
      for (const [id, data] of appealData.entries()) {
        if (data.userId === userId && data.guildId === ban.guild_id && data.expiresAt > Date.now()) {
          existingAppealId = id;
          break;
        }
      }
      
      if (existingAppealId) {
        // Redirect to existing appeal
        return res.redirect(`/appeal/${existingAppealId}`);
      }
      
      // Create a new appeal link for this user
      const banInfo = {
        reason: ban.reason || 'No reason provided',
        moderator: ban.mod_username || 'Unknown',
        caseId: ban.id,
        timestamp: new Date(ban.timestamp).getTime(),
        guildName: "King's Customs",
        guildIcon: serverLogoUrl
      };
      
      // Create appeal entry
      const appealId = require('crypto').randomBytes(16).toString('hex');
      const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
      
      appealData.set(appealId, {
        userId,
        guildId: ban.guild_id,
        banInfo,
        createdAt: Date.now(),
        expiresAt,
        lastAccessedAt: Date.now()
      });
      
      saveAppealData();
      
      // Redirect to the new appeal
      res.redirect(`/appeal/${appealId}`);
      
    } catch (error) {
      console.error('Error checking ban status:', error);
      res.status(500).send(generateErrorPage('Error', 'Failed to check ban status. Please try again later.'));
    }
  });

  /**
   * GET /appeal-home - Legacy home/status page (redirects to /appeal)
   */
  app.get('/appeal-home', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  
  // Check if user has any bans across guilds
  const db = require('./database/db');
  
  try {
    const bans = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM cases WHERE user_id = ? AND action = 'BAN' ORDER BY timestamp DESC`,
        [String(userId)],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
    
    if (bans.length === 0) {
      return res.send(generateNotBannedPage(req.session.user));
    }
    
    // Show ban status
    res.send(generateBanStatusPage(req.session.user, bans));
  } catch (error) {
    console.error('Error fetching ban status:', error);
    res.status(500).send('Error loading status');
  }
});

  /**
   * GET /appeal/:appealId - View/submit appeal
   */
  app.get('/appeal/:appealId', requireAuth, async (req, res) => {
  const { appealId } = req.params;
  const appeal = appealData.get(appealId);
  
  if (!appeal) {
    return res.status(404).send(generateErrorPage('Appeal Not Found', 'This appeal link is invalid or has expired.'));
  }
  
  // Check if logged-in user matches the banned user
  if (req.session.user.id !== appeal.userId) {
    return res.status(403).send(generateErrorPage('Access Denied', 'You do not have permission to view this appeal.'));
  }
  
  // Check if already expired (30 days of inactivity)
  if (appeal.expiresAt < Date.now()) {
    appealData.delete(appealId);
    return res.status(410).send(generateErrorPage('Appeal Expired', 'This appeal has expired due to 30 days of inactivity.'));
  }
  
  // Reset expiration to 30 days from now (extends on each access)
  appeal.expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
  appeal.lastAccessedAt = Date.now();
  appealData.set(appealId, appeal);
  saveAppealData(); // Persist the update
  
  // Check if appeal already exists in database
  const db = require('./database/db');
  const existingAppeal = await new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM ban_appeals WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT 1`,
      [String(appeal.userId), String(appeal.guildId)],
      (err, row) => err ? reject(err) : resolve(row || null)
    );
  }).catch(() => null);
  
  if (existingAppeal) {
    // Show status page
    return res.send(generateAppealStatusPage(req.session.user, appeal, existingAppeal, appealId));
  }
  
  // Check cooldown
  const cooldownInfo = await getCooldownInfo(appeal.userId, appeal.guildId).catch(() => null);
  
  if (cooldownInfo) {
    return res.send(generateCooldownPage(req.session.user, appeal, cooldownInfo));
  }
  
  // Show appeal form
  res.send(generateAppealFormPage(req.session.user, appeal, appealId));
});

  /**
   * POST /appeal/:appealId - Submit appeal
   */
  app.post('/appeal/:appealId', requireAuth, async (req, res) => {
  const { appealId } = req.params;
  const appeal = appealData.get(appealId);
  
  if (!appeal || req.session.user.id !== appeal.userId) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  
  // Reset expiration to 30 days from now on appeal attempt
  appeal.expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
  appeal.lastAccessedAt = Date.now();
  appealData.set(appealId, appeal);
  saveAppealData(); // Persist the update
  
  const { reason_for_ban, why_unban } = req.body;
  
  if (!reason_for_ban || !why_unban) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  
  try {
    // Check cooldown again
    const cooldownInfo = await getCooldownInfo(appeal.userId, appeal.guildId).catch(() => null);
    if (cooldownInfo) {
      return res.status(403).json({ success: false, message: 'You are on cooldown' });
    }
    
    // Create appeal
    const appealDbId = await createBanAppeal(appeal.userId, appeal.guildId, reason_for_ban, why_unban);
    console.log(`📝 Created appeal in database: ID ${appealDbId} for user ${appeal.userId}`);
    
    // Send to appeals channel
    let channelSent = false;
    if (global.discordClient) {
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const guild = global.discordClient.guilds.cache.get(appeal.guildId);
      
      if (guild) {
        const APPEALS_CHANNEL_ID = '1459306472004649032';
        const appealsChannel = guild.channels.cache.get(APPEALS_CHANNEL_ID);
        
        if (appealsChannel) {
          try {
            const user = await global.discordClient.users.fetch(appeal.userId).catch(() => null);
            
            const appealEmbed = new EmbedBuilder()
              .setTitle('📝 New Ban Appeal')
              .setColor(0x2E7EFE)
              .addFields([
                { name: '👤 User', value: user ? `${user.tag} (<@${appeal.userId}>)` : `<@${appeal.userId}>`, inline: true },
                { name: '🆔 User ID', value: appeal.userId, inline: true },
                { name: '📅 Submitted', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                { name: '📋 What led to your ban?', value: reason_for_ban, inline: false },
                { name: '❓ Why should you be unbanned?', value: why_unban, inline: false }
              ])
              .setFooter({ text: `Appeal ID: ${appealDbId}` })
              .setTimestamp();
            
            if (user && user.avatarURL()) {
              appealEmbed.setThumbnail(user.avatarURL());
            }
            
            if (appeal.banInfo) {
              if (appeal.banInfo.reason) {
                appealEmbed.addFields({ name: '⚖️ Ban Reason', value: appeal.banInfo.reason, inline: false });
              }
              if (appeal.banInfo.moderator) {
                appealEmbed.addFields({ name: '👮 Banned By', value: appeal.banInfo.moderator, inline: true });
              }
              if (appeal.banInfo.caseId) {
                appealEmbed.addFields({ name: '🔢 Case ID', value: `#${appeal.banInfo.caseId}`, inline: true });
              }
            }
            
            const buttons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`ban_appeal_approve:${appealDbId}`)
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
              new ButtonBuilder()
                .setCustomId(`ban_appeal_deny:${appealDbId}`)
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
            );
            
            // Hardcoded management role ping
            const managementRoleId = '1411100904949682236';
            const pingContent = `<@&${managementRoleId}>`;
            
            await appealsChannel.send({ 
              content: pingContent,
              embeds: [appealEmbed], 
              components: [buttons] 
            });
            
            channelSent = true;
            console.log(`✅ Appeal ${appealDbId} sent to channel ${APPEALS_CHANNEL_ID}`);
          } catch (channelError) {
            console.error(`❌ Failed to send appeal to channel:`, channelError);
            // Don't throw - appeal is already in DB, just log the error
          }
        } else {
          console.error(`❌ Appeals channel ${APPEALS_CHANNEL_ID} not found`);
        }
      } else {
        console.error(`❌ Guild ${appeal.guildId} not found`);
      }
    } else {
      console.error(`❌ Discord client not available`);
    }
    
    if (!channelSent) {
      console.warn(`⚠️ Appeal ${appealDbId} created in DB but NOT sent to channel`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting appeal:', error);
    res.status(500).json({ success: false, message: 'Failed to submit appeal' });
  }
  });
} // End of registerRoutes()

// ============================================================================
// HTML GENERATION FUNCTIONS
// ============================================================================

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function generateNotBannedPage(user) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Banned - Ban Appeals</title>
  <link rel="stylesheet" href="/css/appeal.css">
</head>
<body>
  <div class="container">
    <div class="appeal-card">
      <div class="header">
        <h1>✅ Not Banned</h1>
        <p class="subtitle">Welcome, ${escapeHtml(user.username)}</p>
      </div>
      
      <div class="status-content success-status">
        <div class="status-icon">🎉</div>
        <h2>You're all set!</h2>
        <p>You are not currently banned from any servers.</p>
        <a href="/logout" class="logout-button">Logout</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

function generateErrorPage(title, message) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Ban Appeals</title>
  <link rel="stylesheet" href="/css/appeal.css">
</head>
<body>
  <div class="container">
    <div class="error-card">
      <h1>❌ ${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </div>
</body>
</html>
  `;
}

function generateAppealStatusPage(user, appeal, existingAppeal, appealId) {
  const status = existingAppeal.status; // 'pending', 'approved', 'denied'
  const statusConfig = {
    pending: { icon: '⏳', color: '#FFA500', title: 'Appeal Pending', message: 'Your appeal is being reviewed by our moderation team.' },
    approved: { icon: '✅', color: '#00FF88', title: 'Appeal Approved', message: 'Your ban appeal has been approved! You should be unbanned shortly.' },
    denied: { icon: '❌', color: '#FF4757', title: 'Appeal Denied', message: 'Your ban appeal has been denied.' }
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  const cooldownInfo = existingAppeal.can_appeal_after ? new Date(existingAppeal.can_appeal_after) : null;
  const now = new Date();
  const canReappeal = cooldownInfo && now >= cooldownInfo;
  const daysLeft = cooldownInfo && now < cooldownInfo ? Math.ceil((cooldownInfo - now) / (1000 * 60 * 60 * 24)) : 0;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appeal Status - Ban Appeals</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body class="has-nav">
  ${generateNavBar('appeals')}
  <div class="container">
    <div class="appeal-card">
      <div class="header">
        ${appeal.banInfo && appeal.banInfo.guildIcon ? `<img src="${appeal.banInfo.guildIcon}" alt="Server Icon" class="guild-icon">` : ''}
        <h1>Ban Appeal Status</h1>
        <p class="subtitle">${appeal.banInfo ? escapeHtml(appeal.banInfo.guildName) : 'Server'}</p>
      </div>
      
      <div class="appeal-status-card" style="border-left: 4px solid ${config.color};">
        <div class="status-icon-large">${config.icon}</div>
        <h2>${config.title}</h2>
        <p class="status-message">${config.message}</p>
        
        ${status === 'denied' ? `
          <div class="denial-reason-section" style="margin-top: 24px; padding: 20px; background: rgba(255, 71, 87, 0.1); border-left: 4px solid var(--error); border-radius: 8px;">
            <p style="color: var(--text-primary); font-weight: 600; margin-bottom: 12px;">Reason for Denial:</p>
            <p style="color: var(--text-secondary);">${escapeHtml(existingAppeal.denial_reason || 'No reason provided')}</p>
          </div>
          ${cooldownInfo ? `
            <div class="cooldown-section">
              ${canReappeal ? `
                <p class="cooldown-expired">✅ Your cooldown has expired. You may submit a new appeal.</p>
                <a href="/appeal/${appealId}" class="submit-button" style="display: inline-block; text-decoration: none; margin-top: 20px;">Submit New Appeal</a>
              ` : `
                <div class="cooldown-active">
                  <p class="cooldown-title">⏰ Cooldown Active</p>
                  <p class="cooldown-time">${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining</p>
                  <p class="cooldown-note">You can submit another appeal after <strong>${cooldownInfo.toLocaleDateString()}</strong></p>
                </div>
              `}
            </div>
          ` : ''}
        ` : ''}
        
        <div class="appeal-details">
          <h3>Appeal Details</h3>
          <div class="detail-item">
            <span class="detail-label">Submitted:</span>
            <span class="detail-value">${new Date(existingAppeal.created_at).toLocaleString()}</span>
          </div>
          ${existingAppeal.reviewed_at ? `
          <div class="detail-item">
            <span class="detail-label">Reviewed:</span>
            <span class="detail-value">${new Date(existingAppeal.reviewed_at).toLocaleString()}</span>
          </div>
          ` : ''}
        </div>
      </div>
      
      <a href="/logout" class="logout-link">Logout</a>
    </div>
  </div>
</body>
</html>
  `;
}

function generateCooldownPage(user, appeal, cooldownInfo) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appeal Denied - Ban Appeals</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body class="has-nav">
  ${generateNavBar('appeals')}
  <div class="container">
    <div class="cooldown-card">
      ${appeal.banInfo && appeal.banInfo.guildIcon ? `<img src="${appeal.banInfo.guildIcon}" alt="Server Icon" class="guild-icon">` : ''}
      <h1>❌ Appeal Denied</h1>
      <p>Your previous ban appeal was denied.</p>
      <div class="cooldown-info">
        <p><strong>Your appeal was denied for:</strong></p>
        <div class="denial-reason-box">
          ${escapeHtml(cooldownInfo.denialReason)}
        </div>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid var(--border-color);">
        <p><strong>Cooldown Information:</strong></p>
        <p><strong>Time Remaining:</strong> ${cooldownInfo.daysRemaining} day${cooldownInfo.daysRemaining !== 1 ? 's' : ''}</p>
        <p><strong>Can Appeal After:</strong> ${cooldownInfo.canAppealAfter.toLocaleDateString()}</p>
        <p class="cooldown-note">You may submit a new appeal after the cooldown period expires.</p>
      </div>
      <a href="/logout" class="logout-link">Logout</a>
    </div>
  </div>
</body>
</html>
  `;
}

function generateAppealFormPage(user, appeal, appealId) {
  const banInfo = appeal.banInfo || {};
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Submit Ban Appeal - ${banInfo.guildName || 'Server'}</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body class="has-nav">
  ${generateNavBar('appeals')}
  <div class="container">
    <div class="appeal-card">
      <div class="header">
        ${banInfo.guildIcon ? `<img src="${banInfo.guildIcon}" alt="Server Icon" class="guild-icon">` : ''}
        <h1>Ban Appeal</h1>
        <p class="subtitle">${escapeHtml(banInfo.guildName || 'Server')}</p>
      </div>
      
      <div class="ban-details">
        <h2>Ban Information</h2>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">User:</span>
            <span class="detail-value">${escapeHtml(user.username)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">User ID:</span>
            <span class="detail-value">${appeal.userId}</span>
          </div>
          ${banInfo.reason ? `
          <div class="detail-item full-width">
            <span class="detail-label">Ban Reason:</span>
            <span class="detail-value">${escapeHtml(banInfo.reason)}</span>
          </div>
          ` : ''}
          ${banInfo.moderator ? `
          <div class="detail-item">
            <span class="detail-label">Moderator:</span>
            <span class="detail-value">${escapeHtml(banInfo.moderator)}</span>
          </div>
          ` : ''}
          ${banInfo.caseId ? `
          <div class="detail-item">
            <span class="detail-label">Case ID:</span>
            <span class="detail-value">#${banInfo.caseId}</span>
          </div>
          ` : ''}
          ${banInfo.timestamp ? `
          <div class="detail-item">
            <span class="detail-label">Banned At:</span>
            <span class="detail-value" id="banTimestamp" data-timestamp="${banInfo.timestamp}"></span>
          </div>
          ` : ''}
        </div>
      </div>
      
      <form id="appealForm" class="appeal-form">
        <div class="form-group">
          <label for="reason_for_ban">What actions led to your ban?</label>
          <textarea 
            id="reason_for_ban" 
            name="reason_for_ban" 
            required 
            placeholder="Describe what happened and what you were banned for..."
            rows="5"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label for="why_unban">Why should you be unbanned?</label>
          <textarea 
            id="why_unban" 
            name="why_unban" 
            required 
            placeholder="Explain why you believe you should be given another chance..."
            rows="5"
          ></textarea>
        </div>
        
        <button type="submit" class="submit-button" id="submitBtn">
          <span class="button-text">Submit Appeal</span>
          <span class="button-icon">📝</span>
        </button>
        
        <div class="form-note">
          Your appeal will be reviewed by our moderation team. Please be honest and respectful in your responses.
        </div>
      </form>
      
      <a href="/logout" class="logout-link">Logout</a>
    </div>
  </div>
  
  <div id="successModal" class="modal">
    <div class="modal-content success">
      <div class="modal-icon">✅</div>
      <h2>Appeal Submitted!</h2>
      <p>Your ban appeal has been successfully submitted to our moderation team.</p>
      <p class="modal-note">You will receive a DM with the decision once your appeal has been reviewed.</p>
      <p class="modal-note" style="margin-top: 12px; color: var(--text-muted);">
        If you don't receive a response within 24-48 hours, return to this page to check your appeal status.
      </p>
      <button onclick="window.location.reload()" class="modal-button">View Status</button>
    </div>
  </div>
  
  <div id="errorModal" class="modal">
    <div class="modal-content error">
      <div class="modal-icon">❌</div>
      <h2>Submission Failed</h2>
      <p id="errorMessage">An error occurred while submitting your appeal.</p>
      <button onclick="closeErrorModal()" class="modal-button">Try Again</button>
    </div>
  </div>
  
  <script>
    // Format timestamp to user's local time
    const timestampEl = document.getElementById('banTimestamp');
    if (timestampEl) {
      const timestamp = parseInt(timestampEl.getAttribute('data-timestamp'));
      const date = new Date(timestamp);
      timestampEl.textContent = date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    }
    
    const form = document.getElementById('appealForm');
    const submitBtn = document.getElementById('submitBtn');
    const successModal = document.getElementById('successModal');
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      submitBtn.querySelector('.button-text').textContent = 'Submitting...';
      
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      try {
        const response = await fetch('/appeal/${appealId}', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        
        const result = await response.json();
        
        if (result.success) {
          successModal.style.display = 'flex';
          form.style.display = 'none';
        } else {
          errorMessage.textContent = result.message || 'An error occurred while submitting your appeal.';
          errorModal.style.display = 'flex';
          submitBtn.disabled = false;
          submitBtn.classList.remove('loading');
          submitBtn.querySelector('.button-text').textContent = 'Submit Appeal';
        }
      } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'Network error. Please try again.';
        errorModal.style.display = 'flex';
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.querySelector('.button-text').textContent = 'Submit Appeal';
      }
    });
    
    function closeErrorModal() {
      errorModal.style.display = 'none';
    }
  </script>
</body>
</html>
  `;
}

function generateBanStatusPage(user, bans) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ban Status - Ban Appeals</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body class="has-nav">
  ${generateNavBar('appeals')}
  <div class="container">
    <div class="appeal-card">
      <div class="header">
        <h1>Ban Status</h1>
        <p class="subtitle">Welcome, ${escapeHtml(user.username)}</p>
      </div>
      
      <div class="ban-list">
        <p>You have ${bans.length} active ban${bans.length !== 1 ? 's' : ''}:</p>
        ${bans.map(ban => `
          <div class="ban-item">
            <p><strong>Server:</strong> Guild ID ${ban.guild_id}</p>
            <p><strong>Reason:</strong> ${escapeHtml(ban.reason)}</p>
            <p><strong>Date:</strong> ${new Date(ban.timestamp).toLocaleString()}</p>
          </div>
        `).join('')}
      </div>
      
      <p class="info-text">To submit a ban appeal, use the link provided in your ban notification DM.</p>
      <a href="/logout" class="logout-link">Logout</a>
    </div>
  </div>
</body>
</html>
  `;
}

// Helper function to generate navigation bar HTML
function generateNavBar(activePage = 'appeals') {
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
  
  return `
  <nav class="top-nav">
    <a href="/" class="nav-logo">
      <img src="${serverLogoUrl}" alt="King's Customs">
      <span class="nav-logo-text">King's Customs</span>
    </a>
    <div class="nav-links">
      <a href="/" class="nav-link home">
        <span class="nav-link-icon">🏠</span>
        <span class="nav-link-text">Home</span>
      </a>
      <a href="/appeal" class="nav-link appeals ${activePage === 'appeals' ? 'active' : ''}">
        <span class="nav-link-icon">⚖️</span>
        <span class="nav-link-text">Ban Appeals</span>
      </a>
      <a href="/applications" class="nav-link applications ${activePage === 'applications' ? 'active' : ''}">
        <span class="nav-link-icon">📝</span>
        <span class="nav-link-text">Applications</span>
      </a>
    </div>
  </nav>`;
}

function generateStyledNotBannedPage(user, logoUrl) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Banned - King's Customs</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/home.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body class="has-nav">
  ${generateNavBar('appeals')}
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

  <div class="home-container" style="max-width: 600px;">
    <div class="logo-section">
      <img src="${logoUrl}" alt="King's Customs" class="server-logo">
    </div>
    
    <div class="appeal-card" style="text-align: center; margin-top: 20px;">
      <div class="status-icon-wrapper" style="margin-bottom: 24px;">
        <div style="font-size: 5rem; animation: bounce 0.6s ease;">✅</div>
      </div>
      
      <h1 style="color: var(--success); font-size: 2rem; margin-bottom: 16px;">You're Not Banned!</h1>
      
      <p style="color: var(--text-secondary); font-size: 1.15rem; line-height: 1.7; margin-bottom: 24px;">
        Great news, <strong style="color: var(--text-primary);">${escapeHtml(user.username)}</strong>! 
        You are not currently banned from <strong style="color: var(--royal-blue);">King's Customs</strong>.
      </p>
      
      <div style="background: rgba(0, 255, 136, 0.1); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="color: var(--text-secondary); font-size: 1rem; margin: 0;">
          🎉 Your account is in good standing. Continue enjoying the community!
        </p>
      </div>
      
      <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-top: 32px;">
        <a href="/" class="submit-button" style="flex: 1; max-width: 200px; text-decoration: none; font-size: 1rem; padding: 14px 24px;">
          <span class="button-icon">🏠</span>
          <span class="button-text">Home</span>
        </a>
        <a href="/logout" class="logout-button" style="flex: 1; max-width: 200px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1rem; padding: 14px 24px; background: transparent; border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-muted); transition: all 0.3s ease;">
          <span>🚪</span>
          <span>Logout</span>
        </a>
      </div>
    </div>
    
    <div class="home-footer" style="margin-top: 40px;">
      <p>© ${new Date().getFullYear()} King's Customs. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = {
  createAppealUrl,
  initializeApp,
  startServer: (client, expressApp) => {
    if (!expressApp) {
      console.error('❌ No Express app provided to appeal server');
      return;
    }
    
    global.discordClient = client;
    
    // Initialize with the provided Express app
    initializeApp(expressApp);
    
    // Load appeal data on server start
    loadAppealData();
    
    console.log('✅ Ban Appeal System initialized');
    console.log(`🔗 Base URL: ${BASE_URL}`);
    console.log(`🔑 OAuth Redirect: ${REDIRECT_URI}`);
    
    // Register applications routes
    try {
      const { registerApplicationRoutes } = require('./applicationsServer');
      registerApplicationRoutes(app);
      console.log('✅ Applications system routes registered');
    } catch (err) {
      console.error('❌ Failed to register applications routes:', err);
    }
  }
};
