// Ban Appeal Web Server
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { canUserAppeal, createBanAppeal, getBanAppeal } = require('./utils/banAppeals');

const app = express();
const PORT = process.env.APPEAL_SERVER_PORT || 3000;

// Store active appeal sessions (appealToken -> { userId, guildId, banInfo, expiresAt })
const appealSessions = new Map();

// Cleanup expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of appealSessions.entries()) {
    if (session.expiresAt < now) {
      appealSessions.delete(token);
    }
  }
}, 60 * 60 * 1000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

/**
 * Create a new appeal session and return the URL
 * Called by the ban appeal button handler
 */
function createAppealSession(userId, guildId, banInfo) {
  const token = uuidv4();
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  
  appealSessions.set(token, {
    userId,
    guildId,
    banInfo,
    expiresAt,
    createdAt: Date.now()
  });
  
  const baseUrl = process.env.APPEAL_BASE_URL || `http://localhost:${PORT}`;
  return `${baseUrl}/appeal/${token}`;
}

/**
 * GET /appeal/:token - Show the ban appeal form
 */
app.get('/appeal/:token', async (req, res) => {
  const { token } = req.params;
  const session = appealSessions.get(token);
  
  if (!session) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appeal Not Found - King's Customs</title>
        <link rel="stylesheet" href="/css/appeal.css">
      </head>
      <body>
        <div class="container">
          <div class="error-card">
            <h1>❌ Appeal Not Found</h1>
            <p>This appeal link has expired or is invalid.</p>
          </div>
        </div>
      </body>
      </html>
    `);
  }
  
  // Check if already expired
  if (session.expiresAt < Date.now()) {
    appealSessions.delete(token);
    return res.status(410).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appeal Expired - King's Customs</title>
        <link rel="stylesheet" href="/css/appeal.css">
      </head>
      <body>
        <div class="container">
          <div class="error-card">
            <h1>⏰ Appeal Link Expired</h1>
            <p>This appeal link has expired. Please request a new one.</p>
          </div>
        </div>
      </body>
      </html>
    `);
  }
  
  // Check cooldown
  try {
    const canAppeal = await canUserAppeal(session.userId, session.guildId);
    if (!canAppeal) {
      // Get the cooldown end date
      const db = require('./database/db');
      const row = await new Promise((resolve, reject) => {
        db.get(
          `SELECT can_appeal_after FROM ban_appeals 
           WHERE user_id = ? AND guild_id = ? AND status = 'denied' 
           ORDER BY created_at DESC LIMIT 1`,
          [String(session.userId), String(session.guildId)],
          (err, row) => err ? reject(err) : resolve(row)
        );
      });
      
      const cooldownEnd = row?.can_appeal_after ? new Date(row.can_appeal_after) : null;
      const now = new Date();
      const timeLeft = cooldownEnd ? Math.ceil((cooldownEnd - now) / (1000 * 60 * 60 * 24)) : 0;
      
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Appeal Cooldown - King's Customs</title>
          <link rel="stylesheet" href="/css/appeal.css">
        </head>
        <body>
          <div class="container">
            <div class="cooldown-card">
              <img src="${session.banInfo.guildIcon || ''}" alt="Server Icon" class="guild-icon">
              <h1>⏳ Appeal Cooldown Active</h1>
              <p>You cannot submit another appeal at this time.</p>
              <div class="cooldown-info">
                <p><strong>Time Remaining:</strong> ${timeLeft} day${timeLeft !== 1 ? 's' : ''}</p>
                <p class="cooldown-note">You may submit a new appeal after your previous denial cooldown expires.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error checking appeal cooldown:', error);
  }
  
  // Render the appeal form
  res.send(generateAppealFormHTML(token, session));
});

/**
 * POST /appeal/:token - Submit the ban appeal
 */
app.post('/appeal/:token', async (req, res) => {
  const { token } = req.params;
  const session = appealSessions.get(token);
  
  if (!session || session.expiresAt < Date.now()) {
    return res.status(404).json({ success: false, message: 'Appeal session expired or invalid' });
  }
  
  const { reason_for_ban, why_unban } = req.body;
  
  if (!reason_for_ban || !why_unban) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  
  try {
    // Check cooldown again
    const canAppeal = await canUserAppeal(session.userId, session.guildId);
    if (!canAppeal) {
      return res.status(403).json({ success: false, message: 'You are currently on cooldown' });
    }
    
    // Create the appeal in database
    const appealId = await createBanAppeal(
      session.userId,
      session.guildId,
      reason_for_ban,
      why_unban
    );
    
    // Send to appeals channel (will be handled by client reference)
    if (global.discordClient) {
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const guild = global.discordClient.guilds.cache.get(session.guildId);
      
      if (guild) {
        const APPEALS_CHANNEL_ID = '1459306472004649032';
        const appealsChannel = guild.channels.cache.get(APPEALS_CHANNEL_ID);
        
        if (appealsChannel) {
          const user = await global.discordClient.users.fetch(session.userId).catch(() => null);
          
          const appealEmbed = new EmbedBuilder()
            .setTitle('📝 New Ban Appeal')
            .setColor(0x2E7EFE) // Royal blue
            .addFields([
              { name: '👤 User', value: user ? `${user.tag} (<@${session.userId}>)` : `<@${session.userId}>`, inline: true },
              { name: '🆔 User ID', value: session.userId, inline: true },
              { name: '📅 Submitted', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
              { name: '📋 What led to your ban?', value: reason_for_ban, inline: false },
              { name: '❓ Why should you be unbanned?', value: why_unban, inline: false }
            ])
            .setFooter({ text: `Appeal ID: ${appealId}` })
            .setTimestamp();
          
          if (user && user.avatarURL()) {
            appealEmbed.setThumbnail(user.avatarURL());
          }
          
          // Ban details from session
          if (session.banInfo) {
            if (session.banInfo.reason) {
              appealEmbed.addFields({ name: '⚖️ Ban Reason', value: session.banInfo.reason, inline: false });
            }
            if (session.banInfo.moderator) {
              appealEmbed.addFields({ name: '👮 Banned By', value: session.banInfo.moderator, inline: true });
            }
            if (session.banInfo.caseId) {
              appealEmbed.addFields({ name: '🔢 Case ID', value: `#${session.banInfo.caseId}`, inline: true });
            }
          }
          
          const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`ban_appeal_approve:${appealId}`)
              .setLabel('Approve')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅'),
            new ButtonBuilder()
              .setCustomId(`ban_appeal_deny:${appealId}`)
              .setLabel('Deny')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('❌')
          );
          
          await appealsChannel.send({ embeds: [appealEmbed], components: [buttons] });
        }
      }
    }
    
    // Delete the session token so it can't be used again
    appealSessions.delete(token);
    
    res.json({ success: true, message: 'Appeal submitted successfully' });
  } catch (error) {
    console.error('Error submitting appeal:', error);
    res.status(500).json({ success: false, message: 'Failed to submit appeal' });
  }
});

function generateAppealFormHTML(token, session) {
  const banInfo = session.banInfo || {};
  const guildIcon = banInfo.guildIcon || '';
  const guildName = banInfo.guildName || "King's Customs";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ban Appeal - ${guildName}</title>
  <link rel="stylesheet" href="/css/appeal.css">
</head>
<body>
  <div class="container">
    <div class="appeal-card">
      <div class="header">
        ${guildIcon ? `<img src="${guildIcon}" alt="Server Icon" class="guild-icon">` : ''}
        <h1>Ban Appeal</h1>
        <p class="subtitle">${guildName}</p>
      </div>
      
      <div class="ban-details">
        <h2>Ban Information</h2>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">User ID:</span>
            <span class="detail-value">${session.userId}</span>
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
            <span class="detail-value">${new Date(banInfo.timestamp).toLocaleString()}</span>
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
    </div>
  </div>
  
  <div id="successModal" class="modal">
    <div class="modal-content success">
      <div class="modal-icon">✅</div>
      <h2>Appeal Submitted!</h2>
      <p>Your ban appeal has been successfully submitted to our moderation team.</p>
      <p class="modal-note">You will receive a DM with the decision once your appeal has been reviewed.</p>
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
    const form = document.getElementById('appealForm');
    const submitBtn = document.getElementById('submitBtn');
    const successModal = document.getElementById('successModal');
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Disable submit button
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      submitBtn.querySelector('.button-text').textContent = 'Submitting...';
      
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      try {
        const response = await fetch('/appeal/${token}', {
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

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Export functions for use by Discord bot
module.exports = {
  app,
  createAppealSession,
  startServer: (client) => {
    global.discordClient = client;
    app.listen(PORT, () => {
      console.log(`📝 Ban Appeal Server running on port ${PORT}`);
    });
  }
};
