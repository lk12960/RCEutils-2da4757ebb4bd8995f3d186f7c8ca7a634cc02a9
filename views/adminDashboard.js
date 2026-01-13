// Comprehensive Admin Dashboard View
module.exports = function(user, forms) {
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
  
  const totalSubmissions = forms.reduce((sum, f) => sum + f.totalSubmissions, 0);
  const totalPending = forms.reduce((sum, f) => sum + f.pendingReview, 0);
  const totalAccepted = forms.reduce((sum, f) => sum + (f.acceptedCount || 0), 0);
  const totalDenied = forms.reduce((sum, f) => sum + (f.deniedCount || 0), 0);

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
      <div class="stat-card success">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${totalAccepted}</div>
        <div class="stat-label">Accepted</div>
      </div>
      <div class="stat-card denied">
        <div class="stat-icon">❌</div>
        <div class="stat-value">${totalDenied}</div>
        <div class="stat-label">Denied</div>
      </div>
    </div>

    <div class="admin-actions">
      <button onclick="window.location.href='/applications/admin/builder'" class="create-form-btn">
        ➕ Create New Form
      </button>
    </div>

    <div class="forms-list">
      <h2>📋 Application Forms Management</h2>
      ${forms.length === 0 ? `
        <div class="no-forms">
          <div class="empty-icon">📝</div>
          <h3>No Application Forms Yet</h3>
          <p>Create your first application form to get started</p>
          <button onclick="window.location.href='/applications/admin/builder'" class="create-button">
            ➕ Create First Form
          </button>
        </div>
      ` : `
        <div class="forms-grid-admin">
          ${forms.map(form => `
            <div class="form-card-admin" data-form-id="${form.id}">
              <div class="form-card-header">
                <h3>${escapeHtml(form.name)}</h3>
                <div class="form-status-badges">
                  ${!form.isPublished ? `<span class="badge unpublished">🔒 Unpublished</span>` : ''}
                  ${form.pendingReview > 0 ? `<span class="badge pending">⏳ ${form.pendingReview} Pending</span>` : ''}
                  ${form.acceptedCount > 0 ? `<span class="badge accepted">✅ ${form.acceptedCount}</span>` : ''}
                  ${form.deniedCount > 0 ? `<span class="badge denied">❌ ${form.deniedCount}</span>` : ''}
                </div>
              </div>
              
              <p class="form-card-description">${escapeHtml(form.description || 'No description provided')}</p>
              
              <div class="form-card-stats">
                <div class="stat-item">
                  <div class="stat-number">${form.totalSubmissions}</div>
                  <div class="stat-text">Total Submissions</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${form.pendingReview}</div>
                  <div class="stat-text">Awaiting Review</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number">${form.acceptedCount || 0}</div>
                  <div class="stat-text">Accepted</div>
                </div>
              </div>
              
              <div class="form-card-actions">
                <button onclick="reviewForm(${form.id})" class="btn-primary" ${form.pendingReview === 0 ? 'disabled' : ''}>
                  <span class="btn-icon">👁️</span>
                  Review Submissions
                  ${form.pendingReview > 0 ? `<span class="btn-badge">${form.pendingReview}</span>` : ''}
                </button>
                
                <div class="action-buttons-row">
                  <button onclick="viewAllSubmissions(${form.id})" class="btn-secondary">
                    📊 All Submissions (${form.totalSubmissions})
                  </button>
                  <button onclick="editForm(${form.id})" class="btn-secondary">
                    ✏️ Edit
                  </button>
                </div>
                
                <div class="action-buttons-row">
                  <button onclick="exportForm(${form.id}, 'json')" class="btn-tertiary">
                    💾 Export JSON
                  </button>
                  <button onclick="exportForm(${form.id}, 'csv')" class="btn-tertiary">
                    📊 Export CSV
                  </button>
                  ${form.isPublished ? `
                    <button onclick="togglePublish(${form.id}, false)" class="btn-tertiary btn-unpublish">
                      🔒 Unpublish
                    </button>
                  ` : `
                    <button onclick="togglePublish(${form.id}, true)" class="btn-tertiary btn-publish">
                      🌐 Publish
                    </button>
                  `}
                  <button onclick="deleteForm(${form.id}, '${escapeHtml(form.name)}')" class="btn-danger">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
    
    <script>
      function reviewForm(formId) {
        window.location.href = '/applications/admin/review?form=' + formId;
      }
      
      function viewAllSubmissions(formId) {
        window.location.href = '/applications/admin/submissions?form=' + formId;
      }
      
      function editForm(formId) {
        alert('Edit functionality coming soon! Form ID: ' + formId);
        // TODO: Implement edit
      }
      
      function exportForm(formId, format) {
        window.location.href = '/applications/admin/export/' + formId + '?format=' + format;
      }
      
      function deleteForm(formId, formName) {
        if (confirm('Are you sure you want to DELETE "' + formName + '"?\\n\\nThis will permanently remove:\\n• The application form\\n• All submissions\\n• All related data\\n\\nThis action CANNOT be undone!')) {
          fetch('/applications/admin/forms/' + formId, {
            method: 'DELETE'
          }).then(res => res.json()).then(data => {
            if (data.success) {
              alert('Form deleted successfully');
              window.location.reload();
            } else {
              alert('Error: ' + data.message);
            }
          }).catch(err => {
            alert('Error deleting form');
          });
        }
      }
      
      function togglePublish(formId, publish) {
        const action = publish ? 'publish' : 'unpublish';
        const message = publish 
          ? 'This will make the form visible to all users on the public dashboard.'
          : 'This will hide the form from the public dashboard. Existing submissions will be preserved.';
        
        if (confirm('Are you sure you want to ' + action + ' this form?\\n\\n' + message)) {
          fetch('/applications/admin/forms/' + formId + '/toggle-publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publish: publish })
          }).then(res => res.json()).then(data => {
            if (data.success) {
              alert('Form ' + (publish ? 'published' : 'unpublished') + ' successfully!');
              window.location.reload();
            } else {
              alert('Error: ' + data.message);
            }
          }).catch(err => {
            alert('Error toggling publish status');
          });
        }
      }
    </script>
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
