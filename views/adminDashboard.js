// Admin Dashboard View
module.exports = function(user, forms) {
  const totalSubmissions = forms.reduce((sum, f) => sum + f.totalSubmissions, 0);
  const totalPending = forms.reduce((sum, f) => sum + f.pendingReview, 0);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - Applications</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body>
  <div class="container admin-container">
    <div class="admin-header">
      <h1>🛠️ Applications Admin Dashboard</h1>
      <p class="subtitle">Logged in as: ${escapeHtml(user.username)}</p>
      <div class="admin-nav">
        <a href="/applications" class="nav-link">Public View</a>
        <a href="/applications/admin/builder" class="nav-link">Form Builder</a>
        <a href="/logout" class="nav-link">Logout</a>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${forms.length}</div>
        <div class="stat-label">Active Forms</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📤</div>
        <div class="stat-value">${totalSubmissions}</div>
        <div class="stat-label">Total Submissions</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-icon">⏳</div>
        <div class="stat-value">${totalPending}</div>
        <div class="stat-label">Pending Review</div>
      </div>
    </div>

    <div class="forms-list">
      <h2>Application Forms</h2>
      ${forms.length === 0 ? `
        <div class="no-forms">
          <p>No application forms yet.</p>
          <a href="/applications/admin/builder" class="create-button">Create First Form</a>
        </div>
      ` : `
        <div class="forms-table">
          ${forms.map(form => `
            <div class="form-row">
              <div class="form-info">
                <h3>${escapeHtml(form.name)}</h3>
                <p>${escapeHtml(form.description || 'No description')}</p>
                <div class="form-meta">
                  <span>📊 ${form.totalSubmissions} submissions</span>
                  ${form.pendingReview > 0 ? `<span class="pending-badge">⏳ ${form.pendingReview} pending</span>` : ''}
                </div>
              </div>
              <div class="form-actions">
                <a href="/applications/admin/review?form=${form.id}" class="action-button review">
                  📋 Review (${form.pendingReview})
                </a>
                <a href="/applications/admin/export/${form.id}?format=json" class="action-button export">
                  💾 Export JSON
                </a>
                <a href="/applications/admin/export/${form.id}?format=csv" class="action-button export">
                  📊 Export CSV
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      `}
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
