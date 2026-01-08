// Hardcoded category to role mapping
const CATEGORY_ROLES = {
  'Livery': '1457931808384483460',
  'Uniform': '1457932046063370504',
  'ELS': '1457931809202372799',
  'Graphics': '1457931804928381034',
  'Discord Server': '1457927114354327662',
  'Discord Bot': '1457930518245937300'
};

// Support ticket roles
const SUPPORT_ROLES = {
  'General Support': '1457921599322722449',
  'HR Support': '1457922310043603005'
};

/**
 * Get role ID for a category
 */
function getCategoryRole(category) {
  return CATEGORY_ROLES[category] || null;
}

/**
 * Get all category roles
 */
function getAllCategoryRoles() {
  return CATEGORY_ROLES;
}

/**
 * Get support roles
 */
function getSupportRoles() {
  return SUPPORT_ROLES;
}

/**
 * Legacy function - no longer creates roles
 */
async function ensureCategoryRoles() {
  return {}; // Does nothing - roles are hardcoded
}

/**
 * Legacy function - no longer sets roles
 */
async function setCategoryRole() {
  return false; // Does nothing - roles are hardcoded
}

module.exports = {
  getCategoryRole,
  getAllCategoryRoles,
  getSupportRoles,
  ensureCategoryRoles,
  setCategoryRole,
  CATEGORY_ROLES,
  SUPPORT_ROLES
};
