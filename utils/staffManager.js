// ============================================================================
// STAFF MANAGEMENT SYSTEM
// ============================================================================
// Comprehensive staff management with hierarchy, categories, and tracking
// ============================================================================

const db = require('../database/db');

// Target Guild ID for all operations
const TARGET_GUILD_ID = '1297697183503745066';

// Staff Announcement Channel
const STAFF_ANNOUNCEMENT_CHANNEL = '1411101237830615180';

// ============================================================================
// ROLE DEFINITIONS AND HIERARCHY
// ============================================================================

// General Staff Role (required for all staff)
const GENERAL_STAFF_ROLE = '1411100960394313869';

// Category Role Mappings (in descending priority order)
const STAFF_CATEGORIES = {
  EXECUTIVE: {
    name: 'Executive Team',
    priority: 1,
    color: '#FFD700',
    icon: '👑',
    roles: {
      required: [GENERAL_STAFF_ROLE],
      category: ['1419399437997834301'], // Exec Team Role
      positions: ['1411100889027969106'], // Executive Role
      special: ['1411100885513408594'], // + Role
      support: ['1457921599322722449', '1457922310043603005'] // General Support, HR Support
    }
  },
  MANAGEMENT: {
    name: 'Management Team',
    priority: 2,
    color: '#9B59B6',
    icon: '💼',
    roles: {
      required: [GENERAL_STAFF_ROLE],
      category: ['1411100904949682236'], // Management Team Role
      positions: [
        { id: '1457927113389903882', name: 'Senior Manager', level: 2 },
        { id: '1457930518808236162', name: 'Manager', level: 1 }
      ],
      support: ['1457921599322722449', '1457922310043603005'] // General Support, HR Support
    }
  },
  ADMINISTRATION: {
    name: 'Discord Administration Team',
    priority: 3,
    color: '#3498DB',
    icon: '🛡️',
    roles: {
      required: [GENERAL_STAFF_ROLE],
      category: ['1442230302037639299'], // Discord Admin Role
      support: ['1457921599322722449'] // General Support
    }
  },
  MODERATION: {
    name: 'Discord Moderation Team',
    priority: 4,
    color: '#2ECC71',
    icon: '⚔️',
    roles: {
      required: [GENERAL_STAFF_ROLE],
      category: ['1442230298644451510'], // Discord Moderator Role
      support: ['1457921599322722449'] // General Support
    }
  },
  DESIGN: {
    name: 'Design Team',
    priority: 5,
    color: '#E91E63',
    icon: '🎨',
    roles: {
      required: [GENERAL_STAFF_ROLE],
      category: ['1419090298730184776'], // Design Team Role
      positions: [
        { id: '1442230300611575829', name: 'Senior Designer', level: 4 },
        { id: '1457923525225480409', name: 'Designer', level: 3 },
        { id: '1442231526996574298', name: 'Junior Designer', level: 2 },
        { id: '1457926662946820190', name: 'Trial Designer', level: 1 }
      ],
      specialties: [
        { id: '1457931808384483460', name: 'Livery Designer', short: 'Livery' },
        { id: '1457931809202372799', name: 'ELS Designer', short: 'ELS' },
        { id: '1457931804928381034', name: 'Graphics Designer', short: 'Graphics' },
        { id: '1457932046063370504', name: 'Uniform Designer', short: 'Uniform' },
        { id: '1457927114354327662', name: 'Discord Server Designer', short: 'Server' },
        { id: '1457930518245937300', name: 'Discord Bot Designer', short: 'Bot' }
      ]
    }
  },
  QUALITY_CONTROL: {
    name: 'Quality Control',
    priority: 6,
    color: '#95A5A6',
    icon: '✅',
    roles: {
      required: [GENERAL_STAFF_ROLE],
      category: ['1457926662485442600'] // QC Role
    }
  }
};

// Promotion paths
const PROMOTION_PATHS = {
  MODERATION_TO_ADMIN: {
    from: { category: 'MODERATION' },
    to: { category: 'ADMINISTRATION' },
    addRoles: ['1442230302037639299'],
    removeRoles: ['1442230298644451510']
  },
  ADMIN_TO_MANAGEMENT: {
    from: { category: 'ADMINISTRATION' },
    to: { category: 'MANAGEMENT', position: '1457930518808236162' },
    addRoles: ['1411100904949682236', '1457930518808236162', '1457922310043603005'],
    removeRoles: ['1442230302037639299']
  },
  MANAGER_TO_SENIOR: {
    from: { category: 'MANAGEMENT', position: '1457930518808236162' },
    to: { category: 'MANAGEMENT', position: '1457927113389903882' },
    addRoles: ['1457927113389903882'],
    removeRoles: ['1457930518808236162']
  },
  // Design promotions
  TRIAL_TO_JUNIOR: {
    from: { category: 'DESIGN', position: '1457926662946820190' },
    to: { category: 'DESIGN', position: '1442231526996574298' },
    addRoles: ['1442231526996574298'],
    removeRoles: ['1457926662946820190']
  },
  JUNIOR_TO_DESIGNER: {
    from: { category: 'DESIGN', position: '1442231526996574298' },
    to: { category: 'DESIGN', position: '1457923525225480409' },
    addRoles: ['1457923525225480409'],
    removeRoles: ['1442231526996574298']
  },
  DESIGNER_TO_SENIOR: {
    from: { category: 'DESIGN', position: '1457923525225480409' },
    to: { category: 'DESIGN', position: '1442230300611575829' },
    addRoles: ['1442230300611575829'],
    removeRoles: ['1457923525225480409']
  }
};

// ============================================================================
// DATABASE SCHEMA
// ============================================================================

// Initialize staff management tables
db.serialize(() => {
  // Staff records table - tracks staff metadata
  db.run(`
    CREATE TABLE IF NOT EXISTS staff_records (
      user_id TEXT PRIMARY KEY,
      staff_since TEXT NOT NULL,
      last_promotion_date TEXT,
      current_category TEXT,
      current_position TEXT,
      status TEXT DEFAULT 'active',
      suspended_until TEXT,
      suspended_roles TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  
  // Staff promotion history
  db.run(`
    CREATE TABLE IF NOT EXISTS staff_promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      from_category TEXT,
      from_position TEXT,
      to_category TEXT NOT NULL,
      to_position TEXT,
      promoted_by TEXT NOT NULL,
      reason TEXT,
      timestamp TEXT NOT NULL
    )
  `);
  
  // Staff suspensions
  db.run(`
    CREATE TABLE IF NOT EXISTS staff_suspensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      suspended_by TEXT NOT NULL,
      reason TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      stored_roles TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      ended_early INTEGER DEFAULT 0,
      ended_by TEXT,
      ended_at TEXT
    )
  `);
  
  // Staff audit log
  db.run(`
    CREATE TABLE IF NOT EXISTS staff_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      performed_by TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      ip_address TEXT
    )
  `);
  
  // Add columns if they don't exist (migrations)
  db.run(`ALTER TABLE staff_records ADD COLUMN status TEXT DEFAULT 'active'`, () => {});
  db.run(`ALTER TABLE staff_records ADD COLUMN suspended_until TEXT`, () => {});
  db.run(`ALTER TABLE staff_records ADD COLUMN suspended_roles TEXT`, () => {});
});

// ============================================================================
// STAFF DATA FUNCTIONS
// ============================================================================

/**
 * Determine staff member's highest category based on roles
 * Returns the highest priority category as primary, plus all other categories they belong to
 */
function determineStaffCategory(memberRoles) {
  const roleIds = Array.isArray(memberRoles) ? memberRoles : Array.from(memberRoles.cache.keys());
  
  // Check if they have the general staff role
  if (!roleIds.includes(GENERAL_STAFF_ROLE)) {
    return null;
  }
  
  // Find ALL categories the member belongs to
  const allCategories = [];
  
  for (const [key, category] of Object.entries(STAFF_CATEGORIES)) {
    const categoryRoles = category.roles.category || [];
    const hasCategory = categoryRoles.some(r => {
      const roleId = typeof r === 'object' ? r.id : r;
      return roleIds.includes(roleId);
    });
    
    if (hasCategory) {
      allCategories.push({
        key,
        ...category,
        position: getPositionInCategory(key, roleIds),
        specialties: getSpecialties(key, roleIds)
      });
    }
  }
  
  if (allCategories.length === 0) {
    return null;
  }
  
  // Sort by priority (lowest number = highest priority)
  allCategories.sort((a, b) => a.priority - b.priority);
  
  // Return the highest priority category as the primary, but include all categories
  const primary = allCategories[0];
  primary.allCategories = allCategories;
  primary.additionalCategories = allCategories.slice(1);
  
  return primary;
}

/**
 * Get position within a category
 */
function getPositionInCategory(categoryKey, roleIds) {
  const category = STAFF_CATEGORIES[categoryKey];
  if (!category || !category.roles.positions) return null;
  
  // Sort positions by level descending and find highest
  const positions = [...category.roles.positions].sort((a, b) => b.level - a.level);
  for (const pos of positions) {
    if (roleIds.includes(pos.id)) {
      return pos;
    }
  }
  return null;
}

/**
 * Get design specialties
 */
function getSpecialties(categoryKey, roleIds) {
  if (categoryKey !== 'DESIGN') return [];
  
  const specialties = STAFF_CATEGORIES.DESIGN.roles.specialties || [];
  return specialties.filter(s => roleIds.includes(s.id));
}

/**
 * Format specialties for display
 */
function formatSpecialties(specialties) {
  if (!specialties || specialties.length === 0) return null;
  
  const primary = specialties[0];
  if (specialties.length === 1) {
    return { text: primary.short, full: primary.name, count: 1 };
  }
  
  return {
    text: `${primary.short} (+${specialties.length - 1} Others)`,
    full: specialties.map(s => s.name).join(', '),
    count: specialties.length
  };
}

/**
 * Get or create staff record
 */
function getOrCreateStaffRecord(userId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM staff_records WHERE user_id = ?`, [userId], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row);
      
      // Create new record
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO staff_records (user_id, staff_since, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        [userId, now, now, now],
        function(err2) {
          if (err2) return reject(err2);
          resolve({
            user_id: userId,
            staff_since: now,
            created_at: now,
            updated_at: now,
            status: 'active'
          });
        }
      );
    });
  });
}

/**
 * Update staff record
 */
function updateStaffRecord(userId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);
    
    db.run(
      `UPDATE staff_records SET ${fields.join(', ')} WHERE user_id = ?`,
      values,
      function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Get all staff members from Discord guild
 */
async function getAllStaffMembers(client) {
  const guild = client.guilds.cache.get(TARGET_GUILD_ID);
  if (!guild) throw new Error('Target guild not found');
  
  // Use the role to fetch members instead of fetching all
  const staffRole = guild.roles.cache.get(GENERAL_STAFF_ROLE);
  if (!staffRole) throw new Error('General staff role not found');
  
  const staffMembers = [];
  const processedIds = new Set();
  
  // Helper to process a member
  const processMember = async (member) => {
    if (processedIds.has(member.id)) return;
    if (!member.roles.cache.has(GENERAL_STAFF_ROLE)) return;
    
    processedIds.add(member.id);
    
    const roleIds = Array.from(member.roles.cache.keys());
    const category = determineStaffCategory(roleIds);
    
    if (!category) return;
    
    const record = await getOrCreateStaffRecord(member.id).catch(() => null);
    const stats = await getStaffStats(member.id).catch(() => ({}));
    
    staffMembers.push({
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
      avatar: member.user.displayAvatarURL({ size: 128 }),
      roles: roleIds,
      category,
      record,
      stats,
      joinedAt: member.joinedAt,
      status: record?.status || 'active'
    });
  };
  
  try {
    // Method 1: Always try to fetch members with the staff role first for accuracy
    console.log(`[Staff] Fetching all members with staff role...`);
    try {
      // Fetch all guild members to ensure we have the latest data
      const fetched = await guild.members.fetch();
      console.log(`[Staff] Fetched ${fetched.size} total guild members`);
      
      // Process all fetched members
      for (const [memberId, member] of fetched) {
        await processMember(member);
      }
      console.log(`[Staff] Found ${staffMembers.length} staff members after full fetch`);
    } catch (fetchErr) {
      console.error('[Staff] Full fetch failed, falling back to cache:', fetchErr.message);
      
      // Fallback: Method 2 - Get from role.members (cached)
      console.log(`[Staff] Checking role.members for ${staffRole.name}...`);
      for (const [memberId, member] of staffRole.members) {
        await processMember(member);
      }
      console.log(`[Staff] Found ${staffMembers.length} from role.members`);
      
      // Method 3: Also check guild.members.cache
      console.log(`[Staff] Checking guild.members.cache...`);
      for (const [memberId, member] of guild.members.cache) {
        await processMember(member);
      }
      console.log(`[Staff] Total after cache: ${staffMembers.length}`);
    }
    
  } catch (err) {
    console.error('Error fetching staff members:', err.message);
  }
  
  // Sort by category priority, then by position level, then by name
  staffMembers.sort((a, b) => {
    if (a.category.priority !== b.category.priority) {
      return a.category.priority - b.category.priority;
    }
    const aLevel = a.category.position?.level || 0;
    const bLevel = b.category.position?.level || 0;
    if (aLevel !== bLevel) return bLevel - aLevel;
    return a.username.localeCompare(b.username);
  });
  
  console.log(`[Staff] Returning ${staffMembers.length} staff members`);
  return staffMembers;
}

/**
 * Get staff member by ID
 */
async function getStaffMember(client, userId) {
  const guild = client.guilds.cache.get(TARGET_GUILD_ID);
  if (!guild) throw new Error('Target guild not found');
  
  let member;
  
  // Try to get from cache first
  member = guild.members.cache.get(userId);
  
  // If not in cache, try fetching with a timeout
  if (!member) {
    try {
      member = await Promise.race([
        guild.members.fetch({ user: userId, force: false }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 5000))
      ]);
    } catch (err) {
      console.error(`Failed to fetch member ${userId}:`, err.message);
      return null;
    }
  }
  
  if (!member || !member.roles.cache.has(GENERAL_STAFF_ROLE)) {
    return null;
  }
  
  const roleIds = Array.from(member.roles.cache.keys());
  const category = determineStaffCategory(roleIds);
  const record = await getOrCreateStaffRecord(userId).catch(() => null);
  const stats = await getStaffStats(userId).catch(() => ({}));
  const promotionHistory = await getPromotionHistory(userId).catch(() => []);
  
  return {
    id: userId,
    username: member.user.username,
    displayName: member.displayName,
    discriminator: member.user.discriminator,
    avatar: member.user.displayAvatarURL({ size: 256 }),
    banner: member.user.bannerURL?.({ size: 512 }),
    roles: roleIds,
    roleObjects: Array.from(member.roles.cache.values()).map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position
    })),
    category,
    record,
    stats,
    promotionHistory,
    joinedAt: member.joinedAt,
    createdAt: member.user.createdAt,
    status: record?.status || 'active'
  };
}

/**
 * Get staff statistics
 */
async function getStaffStats(userId) {
  return new Promise((resolve, reject) => {
    const stats = {
      ticketsHandled: 0,
      infractionsReceived: 0,
      infractionsIssued: 0,
      moderationsIssued: 0,
      casesHandled: 0
    };
    
    // Get infractions received
    db.get(
      `SELECT COUNT(*) as count FROM infractions WHERE user_id = ? AND revoked = 0`,
      [userId],
      (err, row) => {
        if (!err && row) stats.infractionsReceived = row.count;
        
        // Get infractions issued
        db.get(
          `SELECT COUNT(*) as count FROM infractions WHERE moderator_id = ?`,
          [userId],
          (err2, row2) => {
            if (!err2 && row2) stats.infractionsIssued = row2.count;
            
            // Get moderation cases
            db.get(
              `SELECT COUNT(*) as count FROM cases WHERE moderator_id = ?`,
              [userId],
              (err3, row3) => {
                if (!err3 && row3) {
                  stats.moderationsIssued = row3.count;
                  stats.casesHandled = row3.count;
                }
                
                // Get tickets (from stats_events if tracked)
                db.get(
                  `SELECT SUM(amount) as count FROM stats_events WHERE type = 'ticket_closed' AND meta LIKE ?`,
                  [`%"userId":"${userId}"%`],
                  (err4, row4) => {
                    if (!err4 && row4 && row4.count) stats.ticketsHandled = row4.count;
                    resolve(stats);
                  }
                );
              }
            );
          }
        );
      }
    );
  });
}

/**
 * Get promotion history
 */
function getPromotionHistory(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM staff_promotions WHERE user_id = ? ORDER BY timestamp DESC`,
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

/**
 * Log staff action
 */
function logStaffAction(userId, action, details, performedBy, ipAddress = null) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    db.run(
      `INSERT INTO staff_audit_log (user_id, action, details, performed_by, timestamp, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, JSON.stringify(details), performedBy, timestamp, ipAddress],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

/**
 * Get staff audit log
 */
function getStaffAuditLog(userId = null, limit = 50) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM staff_audit_log`;
    const params = [];
    
    if (userId) {
      query += ` WHERE user_id = ?`;
      params.push(userId);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);
    
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

// ============================================================================
// PROMOTION/DEMOTION FUNCTIONS
// ============================================================================

/**
 * Promote staff member
 */
async function promoteStaffMember(client, userId, promotedBy, reason = null) {
  const guild = client.guilds.cache.get(TARGET_GUILD_ID);
  if (!guild) throw new Error('Target guild not found');
  
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) throw new Error('Member not found');
  
  const roleIds = Array.from(member.roles.cache.keys());
  const currentCategory = determineStaffCategory(roleIds);
  
  if (!currentCategory) throw new Error('User is not a staff member');
  
  // Find applicable promotion path
  let promotionPath = null;
  for (const [key, path] of Object.entries(PROMOTION_PATHS)) {
    if (path.from.category === currentCategory.key) {
      if (!path.from.position || (currentCategory.position && path.from.position === currentCategory.position.id)) {
        promotionPath = { key, ...path };
        break;
      }
    }
  }
  
  if (!promotionPath) {
    throw new Error('No promotion path available for current position');
  }
  
  // Apply role changes
  const addRoles = promotionPath.addRoles || [];
  const removeRoles = promotionPath.removeRoles || [];
  
  for (const roleId of addRoles) {
    await member.roles.add(roleId).catch(console.error);
  }
  for (const roleId of removeRoles) {
    await member.roles.remove(roleId).catch(console.error);
  }
  
  // Record promotion
  const timestamp = new Date().toISOString();
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO staff_promotions (user_id, from_category, from_position, to_category, to_position, promoted_by, reason, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, currentCategory.key, currentCategory.position?.id, promotionPath.to.category, promotionPath.to.position, promotedBy, reason, timestamp],
      (err) => err ? reject(err) : resolve()
    );
  });
  
  // Update staff record
  await updateStaffRecord(userId, {
    last_promotion_date: timestamp,
    current_category: promotionPath.to.category,
    current_position: promotionPath.to.position
  });
  
  // Log action
  await logStaffAction(userId, 'PROMOTION', {
    from: { category: currentCategory.key, position: currentCategory.position?.id },
    to: { category: promotionPath.to.category, position: promotionPath.to.position },
    reason
  }, promotedBy);
  
  return {
    success: true,
    from: currentCategory,
    to: promotionPath.to,
    path: promotionPath.key
  };
}

/**
 * Demote staff member
 */
async function demoteStaffMember(client, userId, demotedBy, reason) {
  const guild = client.guilds.cache.get(TARGET_GUILD_ID);
  if (!guild) throw new Error('Target guild not found');
  
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) throw new Error('Member not found');
  
  const roleIds = Array.from(member.roles.cache.keys());
  const currentCategory = determineStaffCategory(roleIds);
  
  if (!currentCategory) throw new Error('User is not a staff member');
  
  // Find demotion path (reverse of promotion)
  let demotionPath = null;
  for (const [key, path] of Object.entries(PROMOTION_PATHS)) {
    if (path.to.category === currentCategory.key) {
      if (!path.to.position || (currentCategory.position && path.to.position === currentCategory.position.id)) {
        demotionPath = {
          key,
          from: path.to,
          to: path.from,
          addRoles: path.removeRoles,
          removeRoles: path.addRoles
        };
        break;
      }
    }
  }
  
  if (!demotionPath) {
    throw new Error('No demotion path available for current position');
  }
  
  // Apply role changes
  for (const roleId of demotionPath.addRoles || []) {
    await member.roles.add(roleId).catch(console.error);
  }
  for (const roleId of demotionPath.removeRoles || []) {
    await member.roles.remove(roleId).catch(console.error);
  }
  
  // Record demotion
  const timestamp = new Date().toISOString();
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO staff_promotions (user_id, from_category, from_position, to_category, to_position, promoted_by, reason, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, currentCategory.key, currentCategory.position?.id, demotionPath.to.category, demotionPath.to.position, demotedBy, `[DEMOTION] ${reason}`, timestamp],
      (err) => err ? reject(err) : resolve()
    );
  });
  
  // Update staff record
  await updateStaffRecord(userId, {
    last_promotion_date: timestamp,
    current_category: demotionPath.to.category,
    current_position: demotionPath.to.position
  });
  
  // Log action
  await logStaffAction(userId, 'DEMOTION', {
    from: { category: currentCategory.key, position: currentCategory.position?.id },
    to: { category: demotionPath.to.category, position: demotionPath.to.position },
    reason
  }, demotedBy);
  
  // Auto-issue demotion infraction
  const { createInfraction } = require('./infractionManager');
  await createInfraction(userId, demotedBy, 'Notice', `Demotion: ${reason}`, 'Auto-issued on demotion');
  
  return {
    success: true,
    from: currentCategory,
    to: demotionPath.to,
    path: demotionPath.key
  };
}

// ============================================================================
// SUSPENSION FUNCTIONS
// ============================================================================

/**
 * Suspend staff member
 * NOTE: Keeps the general staff role so the user remains visible in staff management
 */
async function suspendStaffMember(client, userId, suspendedBy, reason, durationMs) {
  const guild = client.guilds.cache.get(TARGET_GUILD_ID);
  if (!guild) throw new Error('Target guild not found');
  
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) throw new Error('Member not found');
  
  // Store current staff roles (excluding general staff role - we keep that)
  const staffRoleIds = [];
  for (const [key, category] of Object.entries(STAFF_CATEGORIES)) {
    const allRoles = [
      ...(category.roles.category || []),
      ...(category.roles.positions || []).map(p => typeof p === 'object' ? p.id : p),
      ...(category.roles.support || []),
      ...(category.roles.specialties || []).map(s => s.id)
    ];
    for (const roleId of allRoles) {
      if (member.roles.cache.has(roleId)) {
        staffRoleIds.push(roleId);
      }
    }
  }
  
  // NOTE: We do NOT remove GENERAL_STAFF_ROLE so user stays visible in staff management
  // But we still store it so we know what category they were in
  const hasGeneralStaffRole = member.roles.cache.has(GENERAL_STAFF_ROLE);
  
  // Remove category/position roles (but keep general staff role)
  for (const roleId of staffRoleIds) {
    await member.roles.remove(roleId).catch(console.error);
  }
  
  const now = new Date();
  const endTime = new Date(now.getTime() + durationMs);
  
  // Record suspension - store ALL roles including general staff for restoration reference
  const allStoredRoles = hasGeneralStaffRole ? [...staffRoleIds, GENERAL_STAFF_ROLE] : staffRoleIds;
  
  const suspensionId = await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO staff_suspensions (user_id, suspended_by, reason, duration_ms, start_time, end_time, stored_roles)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, suspendedBy, reason, durationMs, now.toISOString(), endTime.toISOString(), JSON.stringify(allStoredRoles)],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
  
  // Update staff record
  await updateStaffRecord(userId, {
    status: 'suspended',
    suspended_until: endTime.toISOString(),
    suspended_roles: JSON.stringify(allStoredRoles)
  });
  
  // Log action
  await logStaffAction(userId, 'SUSPENSION', {
    suspensionId,
    reason,
    duration: durationMs,
    endTime: endTime.toISOString(),
    storedRoles: staffRoleIds // Roles that were removed
  }, suspendedBy);
  
  return {
    success: true,
    suspensionId,
    endTime,
    storedRoles: staffRoleIds,
    userId,
    reason
  };
}

/**
 * End suspension (restore roles)
 */
async function endSuspension(client, suspensionId, endedBy = null) {
  const suspension = await new Promise((resolve, reject) => {
    db.get(`SELECT * FROM staff_suspensions WHERE id = ? AND status = 'active'`, [suspensionId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
  
  if (!suspension) throw new Error('Active suspension not found');
  
  const guild = client.guilds.cache.get(TARGET_GUILD_ID);
  if (!guild) throw new Error('Target guild not found');
  
  const member = await guild.members.fetch(suspension.user_id).catch(() => null);
  if (!member) throw new Error('Member not found');
  
  // Restore roles
  const storedRoles = JSON.parse(suspension.stored_roles);
  for (const roleId of storedRoles) {
    await member.roles.add(roleId).catch(console.error);
  }
  
  const now = new Date().toISOString();
  const endedEarly = new Date(suspension.end_time) > new Date();
  
  // Update suspension record
  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE staff_suspensions SET status = 'ended', ended_early = ?, ended_by = ?, ended_at = ? WHERE id = ?`,
      [endedEarly ? 1 : 0, endedBy, now, suspensionId],
      (err) => err ? reject(err) : resolve()
    );
  });
  
  // Update staff record
  await updateStaffRecord(suspension.user_id, {
    status: 'active',
    suspended_until: null,
    suspended_roles: null
  });
  
  // Log action
  await logStaffAction(suspension.user_id, 'SUSPENSION_ENDED', {
    suspensionId,
    endedEarly,
    endedBy
  }, endedBy || 'SYSTEM');
  
  return { success: true, endedEarly };
}

/**
 * Get active suspensions that need to be ended
 */
function getExpiredSuspensions() {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.all(
      `SELECT * FROM staff_suspensions WHERE status = 'active' AND end_time <= ?`,
      [now],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

/**
 * Get active suspension for a user
 */
function getActiveSuspension(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM staff_suspensions WHERE user_id = ? AND status = 'active' ORDER BY start_time DESC LIMIT 1`,
      [userId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Constants
  TARGET_GUILD_ID,
  STAFF_ANNOUNCEMENT_CHANNEL,
  GENERAL_STAFF_ROLE,
  STAFF_CATEGORIES,
  PROMOTION_PATHS,
  
  // Category functions
  determineStaffCategory,
  getPositionInCategory,
  getSpecialties,
  formatSpecialties,
  
  // Staff data functions
  getOrCreateStaffRecord,
  updateStaffRecord,
  getAllStaffMembers,
  getStaffMember,
  getStaffStats,
  getPromotionHistory,
  
  // Audit functions
  logStaffAction,
  getStaffAuditLog,
  
  // Promotion/Demotion
  promoteStaffMember,
  demoteStaffMember,
  
  // Suspension
  suspendStaffMember,
  endSuspension,
  getExpiredSuspensions,
  getActiveSuspension
};
