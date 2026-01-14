// Ban Appeal Web Server with Discord OAuth
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getBanAppeal, getBanCaseDetails, getCooldownInfo, createBanAppeal, getAllBanAppeals, getAppealStats, markAppealAsRead, updateAppealActivity, getPendingAppealsForNav, deleteBanAppeal, approveBanAppeal, denyBanAppeal, TARGET_GUILD_ID } = require('./utils/banAppeals');

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
          You must log in with your Discord account to view or submit ban appeals and applications.
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
  // ADMIN ROUTES
  // ============================================================================
  
  // Admin middleware - checks for admin roles in target guild
  const requireAdminRole = async (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }
    
    const adminRoles = ['1419399437997834301', '1411100904949682236'];
    const userId = req.session.user.id;
    
    let hasAdminRole = false;
    if (global.discordClient) {
      try {
        const guild = global.discordClient.guilds.cache.get(TARGET_GUILD_ID);
        if (guild) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            for (const roleId of adminRoles) {
              if (member.roles.cache.has(roleId)) {
                hasAdminRole = true;
                break;
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error checking admin role:`, err.message);
      }
    }
    
    if (!hasAdminRole) {
      return res.status(403).send(generateErrorPage('Access Denied', 'You do not have permission to access the admin dashboard.'));
    }
    
    next();
  };
  
  /**
   * GET /admin - Unified admin dashboard
   */
  app.get('/admin', requireAdminRole, async (req, res) => {
    try {
      const generateUnifiedDashboard = require('./views/unifiedAdminDashboard');
      const { getFormSubmissions, getAllForms } = require('./utils/applicationsManager');
      
      // Get appeal stats
      const appealStats = await getAppealStats(TARGET_GUILD_ID);
      const recentAppeals = await getAllBanAppeals({ guildId: TARGET_GUILD_ID });
      
      // Get application stats
      const forms = await getAllForms(true);
      let applicationStats = { total: 0, pending: 0, accepted: 0, denied: 0 };
      let recentApplications = [];
      
      for (const form of forms) {
        const submissions = await getFormSubmissions(form.id);
        applicationStats.total += submissions.length;
        applicationStats.pending += submissions.filter(s => s.status === 'submitted').length;
        applicationStats.accepted += submissions.filter(s => s.status === 'accepted').length;
        applicationStats.denied += submissions.filter(s => s.status === 'denied').length;
        
        // Add form name to submissions for display
        submissions.forEach(s => s.form_name = form.name);
        recentApplications = recentApplications.concat(submissions);
      }
      
      // Sort recent applications by date
      recentApplications.sort((a, b) => new Date(b.submitted_at || b.created_at) - new Date(a.submitted_at || a.created_at));
      
      res.send(generateUnifiedDashboard(req.session.user, {
        appealStats,
        applicationStats,
        recentAppeals: recentAppeals.slice(0, 10),
        recentApplications: recentApplications.slice(0, 10)
      }));
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      res.status(500).send(generateErrorPage('Error', 'Failed to load admin dashboard.'));
    }
  });
  
  /**
   * GET /admin/appeals - Ban appeals list
   */
  app.get('/admin/appeals', requireAdminRole, async (req, res) => {
    try {
      const generateAppealsList = require('./views/appealsAdminList');
      const filter = req.query.filter || 'all';
      
      let filters = { guildId: TARGET_GUILD_ID };
      if (filter === 'unread') {
        filters.isRead = false;
        filters.status = 'pending';
      } else if (filter === 'pending') {
        filters.status = 'pending';
      } else if (filter === 'approved') {
        filters.status = 'approved';
      } else if (filter === 'denied') {
        filters.status = 'denied';
      }
      
      const appeals = await getAllBanAppeals(filter === 'all' ? { guildId: TARGET_GUILD_ID } : filters);
      res.send(generateAppealsList(req.session.user, appeals, filter));
    } catch (error) {
      console.error('Error loading appeals list:', error);
      res.status(500).send(generateErrorPage('Error', 'Failed to load appeals list.'));
    }
  });
  
  /**
   * GET /admin/appeals/review/:id - Review individual appeal
   */
  app.get('/admin/appeals/review/:id', requireAdminRole, async (req, res) => {
    try {
      const generateReviewPage = require('./views/appealReviewPage');
      const appealId = parseInt(req.params.id);
      
      const appeal = await getBanAppeal(appealId);
      if (!appeal) {
        return res.status(404).send(generateErrorPage('Not Found', 'Appeal not found.'));
      }
      
      // Mark as read
      await markAppealAsRead(appealId);
      
      // Get ban case details
      const banCase = await getBanCaseDetails(appeal.user_id, appeal.guild_id).catch(() => null);
      
      // Get all pending appeals for navigation
      const allAppeals = await getPendingAppealsForNav(TARGET_GUILD_ID);
      
      // If current appeal is not pending, add it to the list for navigation
      if (appeal.status !== 'pending' && !allAppeals.find(a => a.id === appeal.id)) {
        allAppeals.unshift(appeal);
      }
      
      res.send(generateReviewPage(req.session.user, appeal, banCase, allAppeals));
    } catch (error) {
      console.error('Error loading appeal review:', error);
      res.status(500).send(generateErrorPage('Error', 'Failed to load appeal.'));
    }
  });
  
  /**
   * POST /admin/appeals/:id/approve - Approve appeal
   */
  app.post('/admin/appeals/:id/approve', requireAdminRole, async (req, res) => {
    try {
      const appealId = parseInt(req.params.id);
      const appeal = await getBanAppeal(appealId);
      
      if (!appeal) {
        return res.status(404).json({ success: false, message: 'Appeal not found' });
      }
      
      if (appeal.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Appeal already reviewed' });
      }
      
      // Approve the appeal
      await approveBanAppeal(appealId, req.session.user.id);
      
      // Try to unban the user
      if (global.discordClient) {
        try {
          const guild = global.discordClient.guilds.cache.get(appeal.guild_id);
          if (guild) {
            await guild.members.unban(appeal.user_id, `Ban appeal approved by ${req.session.user.username}`);
            console.log(`✅ Unbanned user ${appeal.user_id} from guild ${appeal.guild_id}`);
          }
        } catch (unbanErr) {
          console.error('Error unbanning user:', unbanErr.message);
        }
        
        // DM user about approval
        try {
          const { EmbedBuilder } = require('discord.js');
          const discordUser = await global.discordClient.users.fetch(appeal.user_id).catch(() => null);
          if (discordUser) {
            const dmEmbed = new EmbedBuilder()
              .setTitle('✅ Ban Appeal Approved!')
              .setDescription(`Your ban appeal for **King's Customs** has been approved! You have been unbanned.`)
              .setColor(0x00FF88)
              .setFooter({ text: 'Welcome back! Please follow the rules.' })
              .setTimestamp();
            
            await discordUser.send({ embeds: [dmEmbed] });
          }
        } catch (dmErr) {
          console.error('Failed to DM user about approval:', dmErr.message);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error approving appeal:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * POST /admin/appeals/:id/deny - Deny appeal
   */
  app.post('/admin/appeals/:id/deny', requireAdminRole, async (req, res) => {
    try {
      const appealId = parseInt(req.params.id);
      const { reason } = req.body;
      
      const appeal = await getBanAppeal(appealId);
      
      if (!appeal) {
        return res.status(404).json({ success: false, message: 'Appeal not found' });
      }
      
      if (appeal.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Appeal already reviewed' });
      }
      
      // Deny the appeal with 14 day cooldown
      await denyBanAppeal(appealId, req.session.user.id, reason || 'No reason provided');
      
      // DM user about denial
      if (global.discordClient) {
        try {
          const { EmbedBuilder } = require('discord.js');
          const discordUser = await global.discordClient.users.fetch(appeal.user_id).catch(() => null);
          if (discordUser) {
            const cooldownEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            const dmEmbed = new EmbedBuilder()
              .setTitle('❌ Ban Appeal Denied')
              .setDescription(`Your ban appeal for **King's Customs** has been denied.`)
              .setColor(0xFF4757)
              .addFields([
                { name: 'Reason', value: reason || 'No reason provided', inline: false },
                { name: 'Cooldown', value: `You may submit another appeal after ${cooldownEnd.toLocaleDateString()}`, inline: false }
              ])
              .setTimestamp();
            
            await discordUser.send({ embeds: [dmEmbed] });
          }
        } catch (dmErr) {
          console.error('Failed to DM user about denial:', dmErr.message);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error denying appeal:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ============================================================================
  // STAFF MANAGEMENT ROUTES
  // ============================================================================
  
  const staffManager = require('./utils/staffManager');
  const { getInfractionsByUserId, createInfraction, revokeInfraction, unrevokeInfraction, revokeAllInfractionsForUser } = require('./utils/infractionManager');
  const { getUserNotes, addNote, removeNote } = require('./utils/noteManager');
  const { getActiveLOA, endLOA: endLOARecord, createLOARequest, approveLOA, parseDuration } = require('./utils/loaManager');
  
  /**
   * GET /admin/staff - Staff management dashboard
   * Optimized with parallel LOA fetching and caching
   */
  app.get('/admin/staff', requireAdminRole, async (req, res) => {
    try {
      const generateStaffDashboard = require('./views/staffDashboard');
      
      const staffMembers = await staffManager.getAllStaffMembers(global.discordClient);
      
      // Calculate initial stats
      const stats = {
        total: staffMembers.length,
        active: staffMembers.filter(s => s.status === 'active').length,
        suspended: staffMembers.filter(s => s.status === 'suspended').length,
        onLOA: 0
      };
      
      // Fetch all LOA statuses in PARALLEL instead of one by one (major speedup)
      const loaPromises = staffMembers.map(member => 
        getActiveLOA(member.id).catch(() => null)
      );
      const loaResults = await Promise.all(loaPromises);
      
      // Apply LOA statuses
      loaResults.forEach((loa, index) => {
        if (loa) {
          stats.onLOA++;
          staffMembers[index].status = 'loa';
        }
      });
      
      // Adjust active count after LOA check
      stats.active = staffMembers.filter(s => s.status === 'active').length;
      
      res.send(generateStaffDashboard(req.session.user, {
        staffMembers,
        categories: staffManager.STAFF_CATEGORIES,
        stats
      }));
    } catch (error) {
      console.error('Error loading staff dashboard:', error);
      res.status(500).send(generateErrorPage('Error', 'Failed to load staff dashboard.'));
    }
  });
  
  /**
   * GET /admin/staff/:id - Staff profile page
   * Optimized with parallel data fetching
   */
  app.get('/admin/staff/:id', requireAdminRole, async (req, res) => {
    try {
      const { renderStaffProfile } = require('./views/staffProfile');
      const userId = req.params.id;
      
      // Fetch staff member and all additional data in PARALLEL
      const [staffMember, infractions, notes, loa, allStaff] = await Promise.all([
        staffManager.getStaffMember(global.discordClient, userId),
        getInfractionsByUserId(userId).catch(() => []),
        getUserNotes(userId).catch(() => []),
        getActiveLOA(userId).catch(() => null),
        staffManager.getAllStaffMembers(global.discordClient)
      ]);
      
      if (!staffMember) {
        return res.status(404).send(generateErrorPage('Not Found', 'Staff member not found.'));
      }
      
      res.send(renderStaffProfile(req.session.user, staffMember, {
        infractions,
        notes,
        loa,
        allStaff
      }));
    } catch (error) {
      console.error('Error loading staff profile:', error);
      res.status(500).send(generateErrorPage('Error', 'Failed to load staff profile.'));
    }
  });
  
  /**
   * POST /admin/staff/:id/promote - Promote staff member
   */
  app.post('/admin/staff/:id/promote', requireAdminRole, async (req, res) => {
    try {
      const { reason } = req.body;
      const result = await staffManager.promoteStaffMember(
        global.discordClient,
        req.params.id,
        req.session.user.id,
        reason
      );
      
      // Send announcement
      if (result.success && global.discordClient) {
        try {
          const { EmbedBuilder } = require('discord.js');
          const channel = await global.discordClient.channels.fetch(staffManager.STAFF_ANNOUNCEMENT_CHANNEL).catch(() => null);
          if (channel) {
            const embed = new EmbedBuilder()
              .setTitle('🎉 Staff Promotion!')
              .setDescription(`Congratulations to <@${req.params.id}> on their promotion!`)
              .setColor(0x00FF88)
              .addFields([
                { name: 'New Position', value: result.to.category + (result.to.position ? ` - ${result.to.position}` : ''), inline: true }
              ])
              .setTimestamp();
            await channel.send({ content: `<@${req.params.id}>`, embeds: [embed] });
          }
        } catch (e) {
          console.error('Failed to send promotion announcement:', e.message);
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error promoting staff:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * POST /admin/staff/:id/demote - Demote staff member
   */
  app.post('/admin/staff/:id/demote', requireAdminRole, async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ success: false, message: 'Reason is required for demotion' });
      }
      
      const result = await staffManager.demoteStaffMember(
        global.discordClient,
        req.params.id,
        req.session.user.id,
        reason
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error demoting staff:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * POST /admin/staff/:id/infract - Issue infraction
   * Matches the /infraction-issue slash command behavior exactly
   */
  app.post('/admin/staff/:id/infract', requireAdminRole, async (req, res) => {
    try {
      const { type, reason, notes } = req.body;
      if (!reason) {
        return res.status(400).json({ success: false, message: 'Reason is required' });
      }
      
      const { updateInfractionMessageId } = require('./utils/infractionManager');
      const caseId = await createInfraction(req.params.id, req.session.user.id, type, reason, notes || 'None');
      
      // Log action to staff audit
      await staffManager.logStaffAction(req.params.id, 'INFRACTION_ISSUED', {
        caseId,
        type,
        reason,
        notes
      }, req.session.user.id);
      
      // Log to infractions channel and DM user - EXACTLY like /infraction-issue command
      if (global.discordClient) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
        
        try {
          const user = await global.discordClient.users.fetch(req.params.id).catch(() => null);
          const issuer = await global.discordClient.users.fetch(req.session.user.id).catch(() => null);
          const timestamp = new Date();
          const dot = '•';
          const formattedDate = `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`;
          
          // Create embed matching the slash command EXACTLY
          const embed = new EmbedBuilder()
            .setColor('#FF4757')
            .setAuthor({ name: user ? user.tag : req.params.id, iconURL: user?.displayAvatarURL() })
            .setTitle('Staff Punishment')
            .addFields(
              { name: 'Case', value: `#${caseId}`, inline: true },
              { name: 'Punishment', value: type, inline: true },
              { name: 'Date', value: formattedDate, inline: true },
              { name: 'Reason', value: reason, inline: true },
              { name: 'Notes', value: notes || 'None', inline: true }
            )
            .setFooter({
              text: `Issued by: ${issuer ? issuer.tag : req.session.user.username} ${dot} ${timestamp.toUTCString()}`,
              iconURL: issuer?.displayAvatarURL()
            });
          
          // Send embed WITHOUT button to infractions log channel
          let logMessage;
          if (INFRACTIONS_CHANNEL_ID) {
            const guild = global.discordClient.guilds.cache.get(staffManager.TARGET_GUILD_ID);
            const infractionsChannel = guild?.channels.cache.get(INFRACTIONS_CHANNEL_ID);
            if (infractionsChannel?.isTextBased()) {
              logMessage = await infractionsChannel.send({ embeds: [embed] });
            }
          }
          
          // Update DB with message ID if message was sent
          if (logMessage) {
            await updateInfractionMessageId(caseId, logMessage.id);
          }
          
          // Send embed WITH button ONLY to user DM (matching slash command)
          if (user) {
            const footerButton = new ButtonBuilder()
              .setLabel("Sent from: King's Customs")
              .setStyle(ButtonStyle.Secondary)
              .setCustomId('source_disabled')
              .setDisabled(true);
            
            const row = new ActionRowBuilder().addComponents(footerButton);
            
            try {
              await user.send({ embeds: [embed], components: [row] });
            } catch (dmErr) {
              console.warn(`⚠️ Could not DM ${user.tag} — they might have DMs disabled.`);
            }
          }
        } catch (e) {
          console.error('Failed to log/DM infraction:', e.message);
        }
      }
      
      res.json({ success: true, caseId });
    } catch (error) {
      console.error('Error issuing infraction:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * POST /admin/staff/:id/suspend - Suspend staff member
   */
  app.post('/admin/staff/:id/suspend', requireAdminRole, async (req, res) => {
    try {
      const { duration, reason } = req.body;
      if (!duration || !reason) {
        return res.status(400).json({ success: false, message: 'Duration and reason are required' });
      }
      
      const durationMs = parseDuration(duration);
      if (!durationMs) {
        return res.status(400).json({ success: false, message: 'Invalid duration format' });
      }
      
      const result = await staffManager.suspendStaffMember(
        global.discordClient,
        req.params.id,
        req.session.user.id,
        reason,
        durationMs
      );
      
      // Log to infractions channel and DM user (like infraction system)
      if (global.discordClient) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
        
        try {
          const user = await global.discordClient.users.fetch(req.params.id).catch(() => null);
          const issuer = await global.discordClient.users.fetch(req.session.user.id).catch(() => null);
          const timestamp = new Date();
          const dot = '•';
          const formattedDate = `<t:${Math.floor(timestamp.getTime() / 1000)}:F>`;
          const endsDate = `<t:${Math.floor(result.endTime.getTime() / 1000)}:F>`;
          
          // Create embed matching infraction style
          const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setAuthor({ name: user ? user.tag : req.params.id, iconURL: user?.displayAvatarURL() })
            .setTitle('Staff Suspension')
            .addFields(
              { name: 'Case', value: `#S${result.suspensionId}`, inline: true },
              { name: 'Punishment', value: 'Suspension', inline: true },
              { name: 'Duration', value: duration, inline: true },
              { name: 'Date', value: formattedDate, inline: true },
              { name: 'Ends', value: endsDate, inline: true },
              { name: 'Reason', value: reason, inline: false }
            )
            .setFooter({
              text: `Issued by: ${issuer ? issuer.tag : req.session.user.username} ${dot} ${timestamp.toUTCString()}`,
              iconURL: issuer?.displayAvatarURL()
            });
          
          // Log to infractions channel (without button, like infraction system)
          if (INFRACTIONS_CHANNEL_ID) {
            const guild = global.discordClient.guilds.cache.get(staffManager.TARGET_GUILD_ID);
            const infractionsChannel = guild?.channels.cache.get(INFRACTIONS_CHANNEL_ID);
            if (infractionsChannel?.isTextBased()) {
              await infractionsChannel.send({ embeds: [embed] });
            }
          }
          
          // DM user with button (like infraction system)
          if (user) {
            const footerButton = new ButtonBuilder()
              .setLabel("Sent from: King's Customs")
              .setStyle(ButtonStyle.Secondary)
              .setCustomId('source_disabled')
              .setDisabled(true);
            
            const row = new ActionRowBuilder().addComponents(footerButton);
            
            try {
              await user.send({ embeds: [embed], components: [row] });
            } catch (dmErr) {
              console.warn(`⚠️ Could not DM ${user.tag} about suspension — they might have DMs disabled.`);
            }
          }
        } catch (e) {
          console.error('Failed to log/DM suspension:', e.message);
        }
      }
      
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error suspending staff:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * POST /admin/staff/:id/unsuspend - End suspension early and restore roles
   */
  app.post('/admin/staff/:id/unsuspend', requireAdminRole, async (req, res) => {
    try {
      const userId = req.params.id;
      
      // Get active suspension
      const suspension = await staffManager.getActiveSuspension(userId);
      if (!suspension) {
        return res.status(400).json({ success: false, message: 'No active suspension found for this user' });
      }
      
      // End the suspension
      const result = await staffManager.endSuspension(
        global.discordClient,
        suspension.id,
        req.session.user.id
      );
      
      // Log to infractions channel and DM user
      if (global.discordClient) {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
        
        try {
          const user = await global.discordClient.users.fetch(userId).catch(() => null);
          const issuer = await global.discordClient.users.fetch(req.session.user.id).catch(() => null);
          const timestamp = new Date();
          const dot = '•';
          
          // Create embed for unsuspension
          const embed = new EmbedBuilder()
            .setColor('#00FF88')
            .setAuthor({ name: user ? user.tag : userId, iconURL: user?.displayAvatarURL() })
            .setTitle('Staff Suspension Lifted')
            .addFields(
              { name: 'Case', value: `#S${suspension.id}`, inline: true },
              { name: 'Action', value: 'Unsuspended', inline: true },
              { name: 'Original Reason', value: suspension.reason || 'No reason', inline: false }
            )
            .setFooter({
              text: `Lifted by: ${issuer ? issuer.tag : req.session.user.username} ${dot} ${timestamp.toUTCString()}`,
              iconURL: issuer?.displayAvatarURL()
            });
          
          // Log to infractions channel
          if (INFRACTIONS_CHANNEL_ID) {
            const guild = global.discordClient.guilds.cache.get(staffManager.TARGET_GUILD_ID);
            const infractionsChannel = guild?.channels.cache.get(INFRACTIONS_CHANNEL_ID);
            if (infractionsChannel?.isTextBased()) {
              await infractionsChannel.send({ embeds: [embed] });
            }
          }
          
          // DM user
          if (user) {
            const footerButton = new ButtonBuilder()
              .setLabel("Sent from: King's Customs")
              .setStyle(ButtonStyle.Secondary)
              .setCustomId('source_disabled')
              .setDisabled(true);
            
            const row = new ActionRowBuilder().addComponents(footerButton);
            
            const dmEmbed = new EmbedBuilder()
              .setColor('#00FF88')
              .setTitle('✅ Staff Suspension Lifted')
              .setDescription('Your suspension has been lifted early. Your staff roles have been restored.')
              .addFields(
                { name: 'Original Suspension Reason', value: suspension.reason || 'No reason', inline: false }
              )
              .setTimestamp();
            
            try {
              await user.send({ embeds: [dmEmbed], components: [row] });
            } catch (dmErr) {
              console.warn(`⚠️ Could not DM ${user.tag} about unsuspension — they might have DMs disabled.`);
            }
          }
        } catch (e) {
          console.error('Failed to log/DM unsuspension:', e.message);
        }
      }
      
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error unsuspending staff:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /**
   * POST /admin/staff/:id/wipe-infractions - Wipe all infractions
   */
  app.post('/admin/staff/:id/wipe-infractions', requireAdminRole, async (req, res) => {
    try {
      await revokeAllInfractionsForUser(req.params.id);
      
      await staffManager.logStaffAction(req.params.id, 'INFRACTIONS_WIPED', {}, req.session.user.id);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error wiping infractions:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * POST /admin/staff/:id/notes - Add note
   */
  app.post('/admin/staff/:id/notes', requireAdminRole, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ success: false, message: 'Note content is required' });
      }
      
      const noteId = await addNote(req.params.id, req.session.user.id, content);
      res.json({ success: true, noteId });
    } catch (error) {
      console.error('Error adding note:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * DELETE /admin/notes/:id - Delete note
   */
  app.delete('/admin/notes/:id', requireAdminRole, async (req, res) => {
    try {
      await removeNote(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting note:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * POST /admin/infractions/:id/revoke - Revoke infraction
   * Matches the /infraction-revoke slash command behavior exactly
   */
  app.post('/admin/infractions/:id/revoke', requireAdminRole, async (req, res) => {
    try {
      const { getInfractionById } = require('./utils/infractionManager');
      const caseId = parseInt(req.params.id);
      
      // Get infraction details first
      const infraction = await getInfractionById(caseId);
      if (!infraction) {
        return res.status(404).json({ success: false, message: `Infraction case #${caseId} not found.` });
      }
      
      if (infraction.revoked) {
        return res.status(400).json({ success: false, message: `Infraction case #${caseId} is already revoked.` });
      }
      
      // Revoke the infraction
      await revokeInfraction(caseId);
      
      // Update original infraction embed in log channel and DM user - EXACTLY like /infraction-revoke command
      if (global.discordClient) {
        const { EmbedBuilder } = require('discord.js');
        const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
        const DOT_EMOJI = '•';
        const GUILD_TAG = "King's Customs";
        
        try {
          const issuer = await global.discordClient.users.fetch(req.session.user.id).catch(() => null);
          
          // Update original infraction embed in log channel with revoked status
          if (infraction.message_id && INFRACTIONS_CHANNEL_ID) {
            const channel = await global.discordClient.channels.fetch(INFRACTIONS_CHANNEL_ID).catch(() => null);
            if (channel?.isTextBased()) {
              const message = await channel.messages.fetch(infraction.message_id).catch(() => null);
              if (message && message.embeds[0]) {
                const embed = message.embeds[0];
                // Clone original embed, keep all fields and data, just add status field and update title/footer
                const revokedEmbed = EmbedBuilder.from(embed)
                  .setColor(0x808080)
                  .setTitle(embed.data.title ? `~ Revoked ${embed.data.title} ~` : `~ Revoked Infraction Case #${infraction.id} ~`)
                  .addFields({ name: 'Status', value: 'Revoked', inline: true })
                  .setFooter({
                    text: `Revoked by: ${issuer ? issuer.tag : req.session.user.username} ${DOT_EMOJI} ${new Date().toUTCString()}`,
                    iconURL: issuer?.displayAvatarURL()
                  });
                
                await message.edit({ embeds: [revokedEmbed], components: [] });
                
                // Send a small message under original embed mentioning revocation
                await channel.send({ content: `Revoked by ${issuer ? issuer.tag : req.session.user.username}`, reply: { messageReference: message.id } });
              }
            }
          }
          
          // DM the user with a simple text message (no embed) - matching slash command
          try {
            const user = await global.discordClient.users.fetch(infraction.user_id).catch(() => null);
            if (user) {
              await user.send(`Your ${infraction.type.toLowerCase()} for \`${infraction.reason}\` in ${GUILD_TAG} was revoked by ${issuer ? issuer.tag : req.session.user.username}.`);
            }
          } catch {
            // User DMs off or blocked, silently ignore
          }
        } catch (e) {
          console.error('Failed to update infraction log/DM for revoke:', e.message);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error revoking infraction:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * POST /admin/infractions/:id/unrevoke - Unrevoke infraction
   * Matches the /infraction-unrevoke slash command behavior exactly
   */
  app.post('/admin/infractions/:id/unrevoke', requireAdminRole, async (req, res) => {
    try {
      const { getInfractionById } = require('./utils/infractionManager');
      const caseId = parseInt(req.params.id);
      
      // Get infraction details first
      const infraction = await getInfractionById(caseId);
      if (!infraction) {
        return res.status(404).json({ success: false, message: `Infraction case #${caseId} not found.` });
      }
      
      if (!infraction.revoked) {
        return res.status(400).json({ success: false, message: `Infraction case #${caseId} is not revoked.` });
      }
      
      // Unrevoke the infraction
      await unrevokeInfraction(caseId);
      
      // Update original infraction message embed (restore original info) and DM user - EXACTLY like /infraction-unrevoke command
      if (global.discordClient) {
        const { EmbedBuilder } = require('discord.js');
        const INFRACTIONS_CHANNEL_ID = process.env.INFRACTIONS_CHANNEL_ID || process.env.INFRACTION_CHANNEL_IDS;
        const DOT_EMOJI = '•';
        const GUILD_TAG = "King's Customs";
        
        try {
          const issuer = await global.discordClient.users.fetch(req.session.user.id).catch(() => null);
          
          // Update original infraction message embed (restore original info)
          if (infraction.message_id && INFRACTIONS_CHANNEL_ID) {
            const channel = await global.discordClient.channels.fetch(INFRACTIONS_CHANNEL_ID).catch(() => null);
            if (channel?.isTextBased()) {
              const originalMessage = await channel.messages.fetch(infraction.message_id).catch(() => null);
              if (originalMessage && originalMessage.embeds[0]) {
                const embed = originalMessage.embeds[0];
                const restoredEmbed = EmbedBuilder.from(embed)
                  .setColor(0x3a5ae4)
                  .setTitle(`Staff Punishment • Case #${infraction.id}`)
                  .spliceFields(0, embed.data.fields?.length || 0)
                  .addFields(
                    { name: 'Case', value: `#${infraction.id}`, inline: true },
                    { name: 'Punishment', value: infraction.type, inline: true },
                    { name: 'Date', value: `<t:${Math.floor(new Date(infraction.timestamp).getTime() / 1000)}:F>`, inline: true },
                    { name: 'Reason', value: infraction.reason || 'No reason provided', inline: true },
                    { name: 'Notes', value: infraction.notes || 'None', inline: true }
                  )
                  .setFooter({
                    text: `Issued by: Unknown ${DOT_EMOJI} ${new Date(infraction.timestamp).toUTCString()}`,
                    iconURL: null
                  });
                
                await originalMessage.edit({ embeds: [restoredEmbed] });
                
                // Edit the revocation message ("Revoked by ...") to "Unrevoked by ..."
                const messagesAfter = await channel.messages.fetch({ after: originalMessage.id, limit: 5 });
                const revocationMessage = messagesAfter.find(msg =>
                  msg.author.id === global.discordClient.user.id &&
                  msg.reference?.messageId === originalMessage.id &&
                  msg.content?.startsWith('Revoked by')
                );
                
                if (revocationMessage) {
                  await revocationMessage.edit({ content: `Unrevoked by ${issuer ? issuer.tag : req.session.user.username}` });
                }
              }
            }
          }
          
          // DM the user a simple plain text message (no embed) - matching slash command
          try {
            const user = await global.discordClient.users.fetch(infraction.user_id).catch(() => null);
            if (user) {
              await user.send(`Your ${infraction.type.toLowerCase()} for \`${infraction.reason}\` in ${GUILD_TAG} has been **unrevoked** by ${issuer ? issuer.tag : req.session.user.username}.`);
            }
          } catch {
            // silently fail if DMs are closed
          }
        } catch (e) {
          console.error('Failed to update infraction log/DM for unrevoke:', e.message);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error unrevoking infraction:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * POST /admin/loa/:id/end - End LOA early
   */
  app.post('/admin/loa/:id/end', requireAdminRole, async (req, res) => {
    try {
      await endLOARecord(parseInt(req.params.id), true);
      res.json({ success: true });
    } catch (error) {
      console.error('Error ending LOA:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  /**
   * GET /admin/staff/mass-infract - Mass infraction page
   */
  app.get('/admin/staff/mass-infract', requireAdminRole, async (req, res) => {
    try {
      const ids = (req.query.ids || '').split(',').filter(Boolean);
      const staffMembers = [];
      
      for (const id of ids) {
        const member = await staffManager.getStaffMember(global.discordClient, id);
        if (member) staffMembers.push(member);
      }
      
      const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
      
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mass Infract - Staff Management</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
  <style>
    .mass-container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .page-header { margin-bottom: 30px; }
    .page-header h1 { font-size: 2rem; margin-bottom: 8px; }
    .back-link { color: var(--text-secondary); text-decoration: none; }
    .back-link:hover { color: var(--royal-blue); }
    .selected-staff { background: var(--bg-card); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid var(--border-color); }
    .selected-staff h3 { margin-bottom: 16px; }
    .staff-list { display: flex; flex-wrap: wrap; gap: 12px; }
    .staff-chip { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-dark); border-radius: 8px; }
    .staff-chip img { width: 24px; height: 24px; border-radius: 50%; }
    .staff-chip .remove { cursor: pointer; color: var(--text-muted); }
    .staff-chip .remove:hover { color: #ff4757; }
    .form-card { background: var(--bg-card); border-radius: 12px; padding: 24px; border: 1px solid var(--border-color); }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
    .form-group select, .form-group textarea { width: 100%; padding: 12px; background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 1rem; }
    .form-group textarea { min-height: 120px; resize: vertical; }
    .form-actions { display: flex; gap: 12px; margin-top: 24px; }
    .btn { padding: 14px 28px; border-radius: 10px; border: none; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.3s ease; }
    .btn-primary { background: linear-gradient(135deg, #ff4757, #ff2f3f); color: white; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(255, 71, 87, 0.4); }
    .btn-secondary { background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); }
  </style>
</head>
<body class="has-nav">
  <nav class="top-nav">
    <a href="/" class="nav-logo">
      <img src="${serverLogoUrl}" alt="King's Customs">
      <span class="nav-logo-text">King's Customs</span>
    </a>
    <div class="nav-links">
      <a href="/" class="nav-link home"><span class="nav-link-icon">🏠</span><span class="nav-link-text">Home</span></a>
      <a href="/admin" class="nav-link"><span class="nav-link-icon">⚙️</span><span class="nav-link-text">Admin</span></a>
    </div>
  </nav>
  
  <div class="mass-container">
    <div class="page-header">
      <a href="/admin/staff" class="back-link">← Back to Staff List</a>
      <h1>⚠️ Mass Infract</h1>
      <p style="color: var(--text-secondary);">Issue the same infraction to multiple staff members at once.</p>
    </div>
    
    <div class="selected-staff">
      <h3>Selected Staff (${staffMembers.length})</h3>
      <div class="staff-list">
        ${staffMembers.length === 0 ? '<p style="color: var(--text-muted);">No staff selected. Go back and select staff members.</p>' :
          staffMembers.map(m => `
            <div class="staff-chip" data-id="${m.id}">
              <img src="${m.avatar}" alt="">
              <span>${escapeHtml(m.username)}</span>
              <span class="remove" onclick="removeStaff('${m.id}')">×</span>
            </div>
          `).join('')}
      </div>
    </div>
    
    ${staffMembers.length > 0 ? `
      <div class="form-card">
        <div class="form-group">
          <label>Infraction Type</label>
          <select id="infractType">
            <option value="Notice">Notice</option>
            <option value="Warning">Warning</option>
            <option value="Strike">Strike</option>
            <option value="Termination">Termination</option>
            <option value="Blacklist">Blacklist</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Reason (required)</label>
          <textarea id="infractReason" placeholder="Enter the reason for this infraction..."></textarea>
        </div>
        
        <div class="form-group">
          <label>Notes (optional)</label>
          <textarea id="infractNotes" placeholder="Additional notes..."></textarea>
        </div>
        
        <div class="form-actions">
          <button class="btn btn-secondary" onclick="window.location.href='/admin/staff'">Cancel</button>
          <button class="btn btn-primary" onclick="submitMassInfract()">⚠️ Issue ${staffMembers.length} Infractions</button>
        </div>
      </div>
    ` : ''}
  </div>
  
  <script>
    const selectedIds = ${JSON.stringify(ids)};
    
    function removeStaff(id) {
      const index = selectedIds.indexOf(id);
      if (index > -1) selectedIds.splice(index, 1);
      window.location.href = '/admin/staff/mass-infract?ids=' + selectedIds.join(',');
    }
    
    async function submitMassInfract() {
      const type = document.getElementById('infractType').value;
      const reason = document.getElementById('infractReason').value;
      const notes = document.getElementById('infractNotes').value;
      
      if (!reason) { alert('Reason is required'); return; }
      if (!confirm('Are you sure you want to issue ' + selectedIds.length + ' infractions?')) return;
      
      let success = 0, failed = 0;
      for (const id of selectedIds) {
        try {
          const res = await fetch('/admin/staff/' + id + '/infract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, reason, notes })
          });
          const data = await res.json();
          if (data.success) success++;
          else failed++;
        } catch (e) {
          failed++;
        }
      }
      
      alert('Infractions issued: ' + success + ' successful, ' + failed + ' failed');
      window.location.href = '/admin/staff';
    }
  </script>
</body>
</html>
      `);
    } catch (error) {
      console.error('Error loading mass infract page:', error);
      res.status(500).send(generateErrorPage('Error', 'Failed to load page.'));
    }
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
    
    // Create appeal with user info
    const user = req.session.user;
    const appealDbId = await createBanAppeal(
      appeal.userId, 
      appeal.guildId, 
      reason_for_ban, 
      why_unban,
      user.username,
      user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
    );
    console.log(`📝 Created appeal in database: ID ${appealDbId} for user ${appeal.userId}`);
    
    // Send simplified notification to appeals channel (like applications)
    let channelSent = false;
    if (global.discordClient) {
      const { EmbedBuilder } = require('discord.js');
      
      // Find channel across all guilds
      const APPEALS_CHANNEL_ID = '1459306472004649032';
      let appealsChannel = null;
      
      for (const guild of global.discordClient.guilds.cache.values()) {
        appealsChannel = guild.channels.cache.get(APPEALS_CHANNEL_ID);
        if (appealsChannel) break;
        try {
          appealsChannel = await guild.channels.fetch(APPEALS_CHANNEL_ID);
          if (appealsChannel) break;
        } catch (err) {
          // Channel not in this guild
        }
      }
      
      // Try direct fetch as fallback
      if (!appealsChannel) {
        try {
          appealsChannel = await global.discordClient.channels.fetch(APPEALS_CHANNEL_ID);
        } catch (err) {
          console.error(`❌ Appeals channel ${APPEALS_CHANNEL_ID} not found:`, err.message);
        }
      }
      
      if (appealsChannel) {
        try {
          const discordUser = await global.discordClient.users.fetch(appeal.userId).catch(() => null);
          
          // Simplified embed - just shows submission notification (like applications)
          const appealEmbed = new EmbedBuilder()
            .setTitle('⚖️ New Ban Appeal Submitted')
            .setColor(0xFF4757)
            .setDescription(`A new ban appeal has been submitted and is awaiting review.`)
            .addFields([
              { name: '👤 Applicant', value: discordUser ? `${discordUser.tag}` : user.username, inline: true },
              { name: '🆔 User ID', value: `<@${appeal.userId}>`, inline: true },
              { name: '📅 Submitted', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            ])
            .setFooter({ text: `Appeal ID: ${appealDbId} | Review on admin dashboard` })
            .setTimestamp();
          
          if (discordUser && discordUser.avatarURL()) {
            appealEmbed.setThumbnail(discordUser.avatarURL());
          }
          
          const mgmtRole = '1411100904949682236';
          await appealsChannel.send({ content: `<@&${mgmtRole}>`, embeds: [appealEmbed] });
          channelSent = true;
          console.log(`📨 Sent appeal notification to Discord channel`);
        } catch (channelError) {
          console.error('Error sending to appeals channel:', channelError);
        }
      }
      
      // DM user about submission
      try {
        const discordUser = await global.discordClient.users.fetch(appeal.userId).catch(() => null);
        if (discordUser) {
          const dmEmbed = new EmbedBuilder()
            .setTitle('⚖️ Ban Appeal Submitted!')
            .setDescription(`Your ban appeal for **King's Customs** has been successfully submitted.`)
            .setColor(0xFF4757)
            .addFields([
              { name: '📊 Status', value: 'Pending Review', inline: true },
              { name: '📅 Submitted', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            ])
            .setFooter({ text: 'You will receive another DM when your appeal has been reviewed.' })
            .setTimestamp();
          
          await discordUser.send({ embeds: [dmEmbed] });
          console.log(`✅ Sent appeal submission DM to user ${discordUser.tag}`);
        }
      } catch (dmErr) {
        console.error(`Failed to DM user about appeal submission:`, dmErr.message);
      }
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
        <a href="/admin" style="flex: 1; max-width: 200px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1rem; padding: 14px 24px; background: linear-gradient(135deg, var(--royal-blue), var(--royal-blue-dark)); border: none; border-radius: 8px; color: white; transition: all 0.3s ease;">
          <span>⚙️</span>
          <span>Admin Panel</span>
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
