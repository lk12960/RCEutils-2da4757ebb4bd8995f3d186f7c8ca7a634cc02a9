// Applications Homepage View
module.exports = function(user, forms) {
  const statusConfig = {
    not_started: { icon: '📝', text: 'Not Started', color: '#7889b5' },
    in_progress: { icon: '⏳', text: 'In Progress', color: '#FFA500' },
    submitted: { icon: '📋', text: 'Pending Review', color: '#2E7EFE' },
    accepted: { icon: '✅', text: 'Accepted', color: '#00FF88' },
    denied: { icon: '❌', text: 'Denied', color: '#FF4757' },
    custom: { icon: '📌', text: 'Custom', color: '#FFA500' }
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Applications - King's Customs</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body>
  <div class="container">
    <div class="applications-header">
      <h1>📋 Applications</h1>
      <p class="subtitle">Welcome, ${user.username}</p>
      <div class="header-actions">
        ${checkIfAdmin(user.id) ? `
          <a href="/applications/admin" class="admin-link">⚙️ Admin Dashboard</a>
          <a href="/applications/admin/builder" class="create-form-link">➕ Create New Form</a>
        ` : ''}
        <a href="/logout" class="logout-link">Logout</a>
      </div>
    </div>

    <div class="applications-grid">
      ${forms.length === 0 ? `
        <div class="no-applications">
          <p>No applications are currently available.</p>
        </div>
      ` : forms.map(form => {
        const status = statusConfig[form.userStatus] || statusConfig.not_started;
        const displayStatus = form.customStatus || status.text;
        const canApply = form.userStatus === 'not_started' || form.userStatus === 'in_progress';
        
        return `
          <div class="application-card">
            <div class="card-header">
              <h2>${escapeHtml(form.name)}</h2>
              <div class="status-badge" style="background: ${status.color}">
                ${status.icon} ${escapeHtml(displayStatus)}
              </div>
            </div>
            
            ${form.description ? `
              <p class="card-description">${escapeHtml(form.description)}</p>
            ` : ''}
            
            ${form.requirements ? renderRequirements(JSON.parse(form.requirements)) : ''}
            
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

function checkIfAdmin(userId) {
  const adminUsers = ['698200964917624936', '943969479984033833'];
  return adminUsers.includes(userId);
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
