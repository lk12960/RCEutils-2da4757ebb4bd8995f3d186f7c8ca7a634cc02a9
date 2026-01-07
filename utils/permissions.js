require('dotenv').config();
const { getTierRole } = require('./rolesManager');

// Fallback ENV roles if DB not yet configured
const FALLBACK = {
  management1: process.env.MANAGEMENT_ROLE_1_ID,
  management2: process.env.MANAGEMENT_ROLE_2_ID,
  moderator: process.env.MODERATOR_ROLE_ID,
  staff: process.env.STAFF_ROLE_ID,
  verified: process.env.VERIFIED_ROLE_ID,
};

function hasRole(member, roleId) {
  return !!roleId && member.roles.cache.has(roleId);
}

function hasAnyRole(member, ...roleIds) {
  const ids = roleIds.filter(Boolean);
  return ids.length > 0 && member.roles.cache.some(role => ids.includes(role.id));
}

function tierRole(member, tier) {
  const guildId = member.guild.id;
  const dbRole = getTierRole(guildId, tier);
  return dbRole;
}

// MANAGEMENT includes only Management roles
function isManagement(member) {
  const r1 = tierRole(member, 'management1') || FALLBACK.management1;
  const r2 = tierRole(member, 'management2') || FALLBACK.management2;
  return hasAnyRole(member, r1, r2);
}

// MODERATOR includes Management + Moderator roles
function isModerator(member) {
  const mod = tierRole(member, 'moderator') || FALLBACK.moderator;
  return isManagement(member) || hasRole(member, mod);
}

// STAFF includes Moderator + Staff roles
function isStaff(member) {
  const staff = tierRole(member, 'staff') || FALLBACK.staff;
  return isModerator(member) || hasRole(member, staff);
}

// VERIFIED includes Staff + Verified roles
function isVerified(member) {
  const verified = tierRole(member, 'verified') || FALLBACK.verified;
  return isStaff(member) || hasRole(member, verified);
}

function requireTier(member, tier) {
  switch (tier) {
    case 'management1':
    case 'management2':
    case 'management':
      return isManagement(member);
    case 'moderator':
      return isModerator(member);
    case 'staff':
      return isStaff(member);
    case 'verified':
      return isVerified(member);
    default:
      return false;
  }
}

module.exports = {
  hasRole,
  isVerified,
  isStaff,
  isModerator,
  isManagement,
  tierRole,
  requireTier,
};
