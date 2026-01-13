// Applications Homepage View
module.exports = function(user, forms, guildIcon, guildName) {
  const statusConfig = {
    not_started: { icon: '📝', text: 'Not Started', color: '#7889b5' },
    in_progress: { icon: '⏳', text: 'In Progress', color: '#FFA500' },
    submitted: { icon: '📋', text: 'Pending Review', color: '#2E7EFE' },
    accepted: { icon: '✅', text: 'Accepted', color: '#00FF88' },
    denied: { icon: '❌', text: 'Denied', color: '#FF4757' },
    custom: { icon: '📌', text: 'Custom', color: '#FFA500' }
  };

  // Use custom logo URL
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Applications - ${escapeHtml(guildName)}</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body class="has-nav">
  <!-- Top Navigation Bar -->
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
      <a href="/appeal" class="nav-link appeals">
        <span class="nav-link-icon">⚖️</span>
        <span class="nav-link-text">Ban Appeals</span>
      </a>
      <a href="/applications" class="nav-link applications active">
        <span class="nav-link-icon">📝</span>
        <span class="nav-link-text">Applications</span>
      </a>
    </div>
  </nav>

  <div class="container applications-hub">
    <div class="server-logo-container">
      <img src="${serverLogoUrl}" alt="${escapeHtml(guildName)}" class="server-logo">
    </div>
    
    <div class="hub-header">
      <h1 class="hub-title">Applications</h1>
      <p class="hub-welcome">Welcome, <strong>${escapeHtml(user.username)}</strong></p>
    </div>
    
    <div class="hub-actions">
      <a href="/admin" class="hub-btn admin-btn">
        <span class="btn-icon">⚙️</span>
        Admin Panel
      </a>
      <a href="/logout" class="hub-btn logout-btn">
        <span class="btn-icon">🚪</span>
        Logout
      </a>
    </div>

    <div class="applications-grid" data-count="${forms.length}">
      ${forms.length === 0 ? `
        <div class="no-applications-wrapper">
          <div class="no-applications">
            <div class="empty-icon">📭</div>
            <h3>No Applications Available</h3>
            <p>There are no application forms at this time.</p>
          </div>
        </div>
      ` : forms.map(form => {
        const status = statusConfig[form.userStatus] || statusConfig.not_started;
        const displayStatus = form.customStatus || status.text;
        const canApply = form.userStatus === 'not_started' || form.userStatus === 'in_progress';
        
        return `
          <div class="application-card">
            <div class="status-badge-top" style="background: ${status.color}">
              ${status.icon} ${escapeHtml(displayStatus)}
            </div>
            <div class="card-content">
              <h2 class="card-title">${escapeHtml(form.name)}</h2>
              
              ${form.description ? `
                <p class="card-description">${escapeHtml(form.description)}</p>
              ` : ''}
              
              ${form.requirements ? renderRequirements(JSON.parse(form.requirements)) : ''}
            </div>
            
            <div class="card-actions">
              ${canApply ? `
                <a href="/applications/${form.id}" class="apply-button">
                  ${form.userStatus === 'in_progress' ? 'Continue Application' : 'Apply Now'}
                </a>
              ` : `
                <a href="/applications/${form.id}" class="view-button">
                  View Status
                </a>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </div>
</body>
</html>
  `;
};

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function checkIfAdmin(userId, userRoles = []) {
  // Admin role IDs - users with any of these roles can access admin panel
  const adminRoles = ['1419399437997834301', '1411100904949682236'];
  
  // Check if user has any admin roles
  for (const roleId of adminRoles) {
    if (userRoles.includes(roleId)) return true;
  }
  
  return false;
}

function renderRequirements(requirements) {
  const reqs = [];
  if (requirements.requiredRoles && requirements.requiredRoles.length > 0) {
    reqs.push(`Required Role`);
  }
  if (requirements.minServerDays) {
    reqs.push(`${requirements.minServerDays} days in server`);
  }
  if (requirements.cooldownDays) {
    reqs.push(`${requirements.cooldownDays} day cooldown`);
  }
  
  if (reqs.length === 0) return '';
  
  return `
    <div class="card-requirements">
      <strong>Requirements:</strong> ${reqs.join(', ')}
    </div>
  `;
}
