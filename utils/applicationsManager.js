// Applications Manager - Core Business Logic
const db = require('../database/applications');

/**
 * Get all active application forms (public view - only published)
 */
function getAllForms(includeUnpublished = false) {
  return new Promise((resolve, reject) => {
    let query;
    if (includeUnpublished) {
      // Admin view - show active and unpublished forms
      query = `SELECT * FROM application_forms WHERE status IN ('active', 'unpublished') ORDER BY created_at DESC`;
    } else {
      // Public view - only show active/published forms
      query = `SELECT * FROM application_forms WHERE status = 'active' ORDER BY created_at DESC`;
    }
    db.all(query, [], (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

/**
 * Toggle form publish status
 */
function toggleFormPublishStatus(formId, publish) {
  return new Promise((resolve, reject) => {
    const newStatus = publish ? 'active' : 'unpublished';
    const now = new Date().toISOString();
    db.run(
      `UPDATE application_forms SET status = ?, updated_at = ? WHERE id = ?`,
      [newStatus, now, formId],
      function(err) {
        err ? reject(err) : resolve({ success: true, newStatus });
      }
    );
  });
}

/**
 * Get form by ID
 */
function getFormById(formId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM application_forms WHERE id = ?`,
      [formId],
      (err, row) => err ? reject(err) : resolve(row)
    );
  });
}

/**
 * Create new application form
 */
function createForm(name, description, questions, requirements, createdBy, settings = {}) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO application_forms (name, description, questions, requirements, created_by, created_at, updated_at, settings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, JSON.stringify(questions), JSON.stringify(requirements), createdBy, now, now, JSON.stringify(settings)],
      function(err) {
        err ? reject(err) : resolve(this.lastID);
      }
    );
  });
}

/**
 * Get user's submission for a form
 */
function getUserSubmission(userId, formId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM application_submissions WHERE user_id = ? AND form_id = ? ORDER BY created_at DESC LIMIT 1`,
      [String(userId), formId],
      (err, row) => err ? reject(err) : resolve(row)
    );
  });
}

/**
 * Create or update submission
 */
function saveSubmission(formId, userId, username, discriminator, avatar, responses, isSubmitting = false) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    // Check if submission exists
    db.get(
      `SELECT id, status FROM application_submissions WHERE user_id = ? AND form_id = ?`,
      [String(userId), formId],
      (err, existing) => {
        if (err) return reject(err);
        
        if (existing) {
          // Don't allow updates if already submitted
          if (existing.status !== 'in_progress') {
            return reject(new Error('Application already submitted'));
          }
          
          // Update existing
          const status = isSubmitting ? 'submitted' : 'in_progress';
          const submitted_at = isSubmitting ? now : null;
          
          db.run(
            `UPDATE application_submissions 
             SET responses = ?, status = ?, submitted_at = ?, updated_at = ?
             WHERE id = ?`,
            [JSON.stringify(responses), status, submitted_at, now, existing.id],
            function(err) {
              err ? reject(err) : resolve(existing.id);
            }
          );
        } else {
          // Create new
          const status = isSubmitting ? 'submitted' : 'in_progress';
          const submitted_at = isSubmitting ? now : null;
          
          db.run(
            `INSERT INTO application_submissions 
             (form_id, user_id, username, discriminator, avatar, responses, status, submitted_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [formId, String(userId), username, discriminator, avatar, JSON.stringify(responses), status, submitted_at, now, now],
            function(err) {
              err ? reject(err) : resolve(this.lastID);
            }
          );
        }
      }
    );
  });
}

/**
 * Update submission with Roblox data
 */
function updateSubmissionRoblox(submissionId, robloxUsername, robloxId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE application_submissions SET roblox_username = ?, roblox_id = ? WHERE id = ?`,
      [robloxUsername, robloxId, submissionId],
      (err) => err ? reject(err) : resolve()
    );
  });
}

/**
 * Get all submissions for a form
 */
function getFormSubmissions(formId, statusFilter = null) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM application_submissions WHERE form_id = ?`;
    const params = [formId];
    
    if (statusFilter) {
      query += ` AND status = ?`;
      params.push(statusFilter);
    }
    
    query += ` ORDER BY submitted_at DESC, created_at DESC`;
    
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

/**
 * Review submission (accept/deny/custom)
 */
function reviewSubmission(submissionId, reviewerId, status, customStatus = null) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const autoDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    
    db.run(
      `UPDATE application_submissions 
       SET status = ?, custom_status = ?, reviewed_by = ?, reviewed_at = ?, auto_delete_at = ?
       WHERE id = ?`,
      [status, customStatus, String(reviewerId), now, autoDeleteAt, submissionId],
      (err) => err ? reject(err) : resolve()
    );
  });
}

/**
 * Get submission by ID
 */
function getSubmissionById(submissionId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM application_submissions WHERE id = ?`,
      [submissionId],
      (err, row) => err ? reject(err) : resolve(row)
    );
  });
}

/**
 * Check if user is eligible for form
 */
async function checkEligibility(userId, formId, guild) {
  const form = await getFormById(formId);
  if (!form || !form.requirements) return { eligible: true };
  
  try {
    const requirements = JSON.parse(form.requirements);
    const member = await guild.members.fetch(userId).catch(() => null);
    
    if (!member) return { eligible: false, reason: 'Not a server member' };
    
    // Check required roles
    if (requirements.requiredRoles && requirements.requiredRoles.length > 0) {
      const hasRole = requirements.requiredRoles.some(roleId => member.roles.cache.has(roleId));
      if (!hasRole) return { eligible: false, reason: 'Missing required role' };
    }
    
    // Check minimum server time
    if (requirements.minServerDays) {
      const joinedAt = member.joinedAt;
      const daysSinceJoin = (Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceJoin < requirements.minServerDays) {
        return { eligible: false, reason: `Must be in server for ${requirements.minServerDays} days` };
      }
    }
    
    // Check cooldown
    if (requirements.cooldownDays) {
      const lastSubmission = await getUserSubmission(userId, formId);
      if (lastSubmission && lastSubmission.submitted_at) {
        const daysSinceSubmit = (Date.now() - new Date(lastSubmission.submitted_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceSubmit < requirements.cooldownDays) {
          return { eligible: false, reason: `Cooldown active: ${Math.ceil(requirements.cooldownDays - daysSinceSubmit)} days remaining` };
        }
      }
    }
    
    return { eligible: true };
  } catch (error) {
    console.error('Error checking eligibility:', error);
    return { eligible: true }; // Fail open
  }
}

/**
 * Log access for rate limiting
 */
function logAccess(userId, action, formId = null, ipAddress = null) {
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO application_access_log (user_id, ip_address, action, form_id, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [String(userId), ipAddress, action, formId, now],
    (err) => {
      if (err) console.error('Error logging access:', err);
    }
  );
}

/**
 * Get application statistics
 */
function getStatistics() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'denied' THEN 1 END) as denied,
        COUNT(CASE WHEN status IN ('submitted', 'accepted', 'denied', 'custom') THEN 1 END) as total_submitted
       FROM application_submissions`,
      [],
      (err, rows) => err ? reject(err) : resolve(rows[0])
    );
  });
}

module.exports = {
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
  logAccess,
  getStatistics,
  toggleFormPublishStatus
};
