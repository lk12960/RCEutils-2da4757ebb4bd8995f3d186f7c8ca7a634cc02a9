// Applications System Routes
const { 
  getAllForms, 
  getFormById, 
  createForm, 
  getUserSubmission, 
  saveSubmission, 
  updateSubmissionRoblox,
  getFormSubmissions,
  reviewSubmission,
  getSubmissionById,
  checkEligibility,
  logAccess
} = require('./utils/applicationsManager');

function registerApplicationRoutes(app) {
  console.log('🔧 Registering application routes on app:', !!app);
  
  if (!app) {
    console.error('❌ No app provided to registerApplicationRoutes!');
    return;
  }
  
  const { rateLimit, applicationSubmitLimit } = require('./utils/rateLimiter');
  
  const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }
    next();
  };

  const requireAdmin = async (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(403).send('Unauthorized');
    }
    
    // Check if user has management roles
    try {
      const userId = req.session.user.id;
      const guild = global.discordClient.guilds.cache.first();
      
      console.log(`🔍 Admin check for user ${userId}`);
      console.log(`   Guild found: ${!!guild}`);
      
      if (!guild) return res.status(500).send('Guild not found');
      
      const member = await guild.members.fetch({ user: userId, force: true }).catch((err) => {
        console.error(`   Failed to fetch member: ${err.message}`);
        return null;
      });
      
      console.log(`   Member found: ${!!member}`);
      
      if (!member) return res.status(403).send('Not a server member');
      
      // Check for management roles (hardcoded)
      const mgmt1 = '1411100904949682236'; // Management role 1
      const mgmt2 = '1419399437997834301'; // Management role 2
      
      const hasMgmt1 = member.roles.cache.has(mgmt1);
      const hasMgmt2 = member.roles.cache.has(mgmt2);
      
      console.log(`   Has management role 1: ${hasMgmt1}`);
      console.log(`   Has management role 2: ${hasMgmt2}`);
      console.log(`   User roles:`, Array.from(member.roles.cache.keys()));
      
      const hasPermission = hasMgmt1 || hasMgmt2;
      
      if (!hasPermission) {
        console.log(`   ❌ Permission denied`);
        return res.status(403).send(`
<!DOCTYPE html>
<html><head><title>Access Denied</title><link rel="stylesheet" href="/css/appeal.css"></head>
<body><div class="container"><div class="error-card">
<h1>🔒 Access Denied</h1>
<p>You do not have permission to access the admin dashboard.</p>
<a href="/applications">Back to Applications</a>
</div></div></body></html>
        `);
      }
      
      next();
    } catch (error) {
      console.error('Error checking admin permissions:', error);
      res.status(500).send('Permission check failed');
    }
  };

  // Public applications homepage
  app.get('/applications', requireAuth, async (req, res) => {
    try {
      const forms = await getAllForms();
      const userId = req.session.user.id;
      
      // Get user's status for each form
      const formsWithStatus = await Promise.all(forms.map(async (form) => {
        const submission = await getUserSubmission(userId, form.id).catch(() => null);
        let status = 'not_started';
        let customStatus = null;
        
        if (submission) {
          status = submission.status;
          customStatus = submission.custom_status;
        }
        
        return {
          ...form,
          userStatus: status,
          customStatus: customStatus
        };
      }));
      
      res.send(generateApplicationsHomepage(req.session.user, formsWithStatus));
    } catch (error) {
      console.error('Error loading applications:', error);
      res.status(500).send('Failed to load applications');
    }
  });

  // ============================================================================
  // ADMIN ROUTES - Must be registered BEFORE /:formId route
  // ============================================================================
  
  // Admin dashboard
  app.get('/applications/admin', requireAdmin, async (req, res) => {
    try {
      const forms = await getAllForms();
      const formsWithCounts = await Promise.all(forms.map(async (form) => {
        const submissions = await getFormSubmissions(form.id);
        const pending = submissions.filter(s => s.status === 'submitted').length;
        const accepted = submissions.filter(s => s.status === 'accepted').length;
        const denied = submissions.filter(s => s.status === 'denied').length;
        return {
          ...form,
          totalSubmissions: submissions.length,
          pendingReview: pending,
          acceptedCount: accepted,
          deniedCount: denied
        };
      }));
      
      res.send(generateAdminDashboard(req.session.user, formsWithCounts));
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      res.status(500).send('Failed to load dashboard');
    }
  });

  // View all submissions for a form
  app.get('/applications/admin/submissions', requireAdmin, async (req, res) => {
    try {
      const formId = parseInt(req.query.form);
      if (!formId) return res.redirect('/applications/admin');
      
      const form = await getFormById(formId);
      const submissions = await getFormSubmissions(formId);
      
      res.send(generateSubmissionsListPage(req.session.user, form, submissions));
    } catch (error) {
      console.error('Error loading submissions:', error);
      res.status(500).send('Failed to load submissions');
    }
  });

  // List submissions for review
  app.get('/applications/admin/review', requireAdmin, async (req, res) => {
    try {
      const formId = parseInt(req.query.form);
      if (!formId) {
        return res.redirect('/applications/admin');
      }
      
      const submissions = await getFormSubmissions(formId, 'submitted');
      if (submissions.length === 0) {
        return res.send(`
<!DOCTYPE html>
<html><head><title>No Submissions</title><link rel="stylesheet" href="/css/appeal.css"></head>
<body><div class="container"><div class="appeal-card">
<h1>No Pending Submissions</h1>
<p>There are no pending submissions to review.</p>
<a href="/applications/admin">← Back to Dashboard</a>
</div></div></body></html>
        `);
      }
      
      res.redirect(`/applications/admin/review/${submissions[0].id}`);
    } catch (error) {
      console.error('Error listing submissions:', error);
      res.status(500).send('Failed to load submissions');
    }
  });

  // Review application
  app.get('/applications/admin/review/:submissionId', requireAdmin, async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const submission = await getSubmissionById(submissionId);
      
      if (!submission) {
        return res.status(404).send('Submission not found');
      }
      
      const form = await getFormById(submission.form_id);
      const questions = JSON.parse(form.questions);
      const responses = JSON.parse(submission.responses);
      
      const allSubmissions = await getFormSubmissions(submission.form_id, 'submitted');
      
      res.send(generateReviewPage(req.session.user, form, submission, questions, responses, allSubmissions));
    } catch (error) {
      console.error('Error loading review page:', error);
      res.status(500).send('Failed to load submission');
    }
  });

  // Submit review decision
  app.post('/applications/admin/review/:submissionId', requireAdmin, async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      const { action, customStatus } = req.body;
      const reviewerId = req.session.user.id;
      
      let status = action;
      
      await reviewSubmission(submissionId, reviewerId, status, customStatus);
      
      try {
        await sendReviewNotification(submissionId, status, customStatus, reviewerId);
      } catch (err) {
        console.error('Failed to send review notification:', err);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error submitting review:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Form builder
  app.get('/applications/admin/builder', requireAdmin, (req, res) => {
    res.send(generateFormBuilder(req.session.user));
  });

  // Create new form
  app.post('/applications/admin/builder', requireAdmin, rateLimit(10, 60000), async (req, res) => {
    try {
      const { name, description, questions, requirements, settings } = req.body;
      const createdBy = req.session.user.id;
      
      const { validateFormData, validateQuestion, sanitizeText } = require('./utils/validator');
      
      const validation = validateFormData({ name, description, questions });
      if (!validation.valid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed', 
          errors: validation.errors 
        });
      }
      
      for (const q of questions) {
        if (!validateQuestion(q)) {
          return res.status(400).json({ 
            success: false, 
            message: `Invalid question: ${q.question || 'Unknown'}` 
          });
        }
      }
      
      const sanitizedName = sanitizeText(name);
      const sanitizedDescription = sanitizeText(description);
      
      const formId = await createForm(sanitizedName, sanitizedDescription, questions, requirements || {}, createdBy, settings || {});
      
      res.json({ success: true, formId });
    } catch (error) {
      console.error('Error creating form:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Export submissions
  app.get('/applications/admin/export/:formId', requireAdmin, async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      const format = req.query.format || 'json';
      
      const form = await getFormById(formId);
      const submissions = await getFormSubmissions(formId);
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${form.name}_submissions.json"`);
        res.send(JSON.stringify(submissions, null, 2));
      } else if (format === 'csv') {
        const csv = generateCSV(form, submissions);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${form.name}_submissions.csv"`);
        res.send(csv);
      }
    } catch (error) {
      console.error('Error exporting submissions:', error);
      res.status(500).send('Export failed');
    }
  });

  // Delete form
  app.delete('/applications/admin/forms/:formId', requireAdmin, async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      const db = require('./database/applications');
      
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM application_submissions WHERE form_id = ?', [formId], (err) => {
          err ? reject(err) : resolve();
        });
      });
      
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM application_forms WHERE id = ?', [formId], (err) => {
          err ? reject(err) : resolve();
        });
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting form:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ============================================================================
  // PUBLIC ROUTES
  // ============================================================================
  
  // View/submit specific application
  app.get('/applications/:formId', requireAuth, async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      const form = await getFormById(formId);
      
      if (!form || form.status !== 'active') {
        return res.status(404).send('Application not found');
      }
      
      const userId = req.session.user.id;
      const submission = await getUserSubmission(userId, formId).catch(() => null);
      
      // If already submitted, show status
      if (submission && submission.status !== 'in_progress') {
        return res.send(generateStatusPage(req.session.user, form, submission));
      }
      
      // Show application form
      const questions = JSON.parse(form.questions);
      const savedResponses = submission ? JSON.parse(submission.responses) : {};
      
      logAccess(userId, submission ? 'continue' : 'start', formId);
      
      res.send(generateApplicationForm(req.session.user, form, questions, savedResponses));
    } catch (error) {
      console.error('Error loading application:', error);
      res.status(500).send('Failed to load application');
    }
  });

  // Save or submit application
  app.post('/applications/:formId', requireAuth, rateLimit(5, 60000), applicationSubmitLimit, async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      let { responses, submit } = req.body;
      const userId = req.session.user.id;
      const user = req.session.user;
      
      // Validate and sanitize input
      const { validateResponses, sanitizeResponses } = require('./utils/validator');
      const form = await getFormById(formId);
      if (!form) {
        return res.status(404).json({ success: false, message: 'Form not found' });
      }
      
      const questions = JSON.parse(form.questions);
      
      // Sanitize responses
      responses = sanitizeResponses(responses);
      
      const isSubmitting = submit === true || submit === 'true';
      
      // Only validate if submitting (not for saving drafts)
      if (isSubmitting) {
        const validation = validateResponses(questions, responses);
        if (!validation.valid) {
          return res.status(400).json({ 
            success: false, 
            message: 'Validation failed', 
            errors: validation.errors 
          });
        }
      }
      
      // Check if already submitted
      const existing = await getUserSubmission(userId, formId).catch(() => null);
      if (existing && existing.status !== 'in_progress') {
        return res.json({ success: false, message: 'Application already submitted' });
      }
      
      // Save submission
      const submissionId = await saveSubmission(
        formId,
        userId,
        user.username,
        user.discriminator,
        user.avatar,
        responses,
        isSubmitting
      );
      
      logAccess(userId, isSubmitting ? 'submit' : 'save', formId);
      
      // If submitting, fetch Roblox data and send Discord notification
      if (isSubmitting) {
        // Fetch Roblox data
        try {
          const { getBloxlinkData } = require('./utils/bloxlinkApi');
          const guild = global.discordClient.guilds.cache.first();
          const robloxData = await getBloxlinkData(userId, guild.id).catch(() => null);
          
          if (robloxData && robloxData.robloxID) {
            await updateSubmissionRoblox(submissionId, robloxData.robloxUsername, robloxData.robloxID);
          }
        } catch (err) {
          console.error('Failed to fetch Roblox data:', err);
        }
        
        // Send Discord notification
        try {
          await sendApplicationNotification(formId, submissionId, userId, user.username);
        } catch (err) {
          console.error('Failed to send Discord notification:', err);
        }
      }
      
      res.json({ success: true, submissionId });
    } catch (error) {
      console.error('Error saving application:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  console.log('   - /applications (public)');
  console.log('   - /applications/admin (admin dashboard)');
  console.log('   - /applications/admin/builder (form builder)');
}

// Helper functions for Discord notifications
async function sendApplicationNotification(formId, submissionId, userId, username) {
  if (!global.discordClient) return;
  
  const { EmbedBuilder } = require('discord.js');
  const form = await getFormById(formId);
  const guild = global.discordClient.guilds.cache.first();
  const APPLICATIONS_CHANNEL_ID = '1460375837462237427';
  const channel = guild.channels.cache.get(APPLICATIONS_CHANNEL_ID);
  
  if (!channel) return;
  
  const submission = await getSubmissionById(submissionId);
  
  const embed = new EmbedBuilder()
    .setTitle('📋 New Application Submitted')
    .setColor(0x2E7EFE)
    .addFields([
      { name: 'Application', value: form.name, inline: true },
      { name: 'Applicant', value: `${username} (<@${userId}>)`, inline: true },
      { name: 'User ID', value: userId, inline: true }
    ])
    .setTimestamp();
  
  if (submission.roblox_username) {
    embed.addFields({ name: 'Roblox Username', value: submission.roblox_username, inline: true });
  }
  
  embed.setFooter({ text: `Submission ID: ${submissionId}` });
  
  const mgmtRole = '1411100904949682236';
  await channel.send({ content: `<@&${mgmtRole}>`, embeds: [embed] });
}

async function sendReviewNotification(submissionId, status, customStatus, reviewerId) {
  const { EmbedBuilder } = require('discord.js');
  const submission = await getSubmissionById(submissionId);
  const form = await getFormById(submission.form_id);
  const guild = global.discordClient.guilds.cache.first();
  const APPLICATIONS_CHANNEL_ID = '1460375837462237427';
  const channel = guild.channels.cache.get(APPLICATIONS_CHANNEL_ID);
  
  if (channel) {
    const statusText = status === 'custom' ? customStatus : status.toUpperCase();
    const color = status === 'accepted' ? 0x00FF88 : status === 'denied' ? 0xFF4757 : 0xFFA500;
    
    const embed = new EmbedBuilder()
      .setTitle(`📋 Application ${statusText}`)
      .setColor(color)
      .addFields([
        { name: 'Application', value: form.name, inline: true },
        { name: 'Applicant', value: `<@${submission.user_id}>`, inline: true },
        { name: 'Status', value: statusText, inline: true },
        { name: 'Reviewed By', value: `<@${reviewerId}>`, inline: true }
      ])
      .setTimestamp();
    
    await channel.send({ embeds: [embed] });
  }
  
  // DM user
  try {
    const user = await global.discordClient.users.fetch(submission.user_id);
    const statusText = status === 'custom' ? customStatus : status.toUpperCase();
    const color = status === 'accepted' ? 0x00FF88 : status === 'denied' ? 0xFF4757 : 0xFFA500;
    
    const dmEmbed = new EmbedBuilder()
      .setTitle(`Application ${statusText}`)
      .setDescription(`Your application for **${form.name}** has been ${statusText.toLowerCase()}.`)
      .setColor(color)
      .setTimestamp();
    
    await user.send({ embeds: [dmEmbed] });
  } catch (err) {
    console.error('Failed to DM user:', err);
  }
}

function generateCSV(form, submissions) {
  const questions = JSON.parse(form.questions);
  const headers = ['ID', 'Username', 'User ID', 'Status', 'Submitted At'];
  questions.forEach(q => headers.push(q.question));
  
  let csv = headers.join(',') + '\n';
  
  submissions.forEach(sub => {
    const responses = JSON.parse(sub.responses);
    const row = [
      sub.id,
      sub.username,
      sub.user_id,
      sub.status,
      sub.submitted_at || ''
    ];
    
    questions.forEach(q => {
      const answer = responses[q.id] || '';
      row.push(`"${String(answer).replace(/"/g, '""')}"`);
    });
    
    csv += row.join(',') + '\n';
  });
  
  return csv;
}

// HTML generation functions will be added in next file
function generateApplicationsHomepage(user, forms) {
  return require('./views/applicationsHome')(user, forms);
}

function generateApplicationForm(user, form, questions, savedResponses) {
  return require('./views/applicationForm')(user, form, questions, savedResponses);
}

function generateStatusPage(user, form, submission) {
  return require('./views/applicationStatus')(user, form, submission);
}

function generateAdminDashboard(user, forms) {
  return require('./views/adminDashboard')(user, forms);
}

function generateReviewPage(user, form, submission, questions, responses, allSubmissions) {
  return require('./views/reviewPage')(user, form, submission, questions, responses, allSubmissions);
}

function generateFormBuilder(user) {
  return require('./views/formBuilder')(user);
}

function generateSubmissionsListPage(user, form, submissions) {
  return require('./views/submissionsList')(user, form, submissions);
}

module.exports = { registerApplicationRoutes };
