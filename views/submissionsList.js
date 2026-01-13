// All Submissions List View
module.exports = function(user, form, submissions) {
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
  
  const statusConfig = {
    in_progress: { icon: '⏳', text: 'In Progress', color: '#FFA500' },
    submitted: { icon: '📋', text: 'Pending', color: '#2E7EFE' },
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
  <title>All Submissions - ${escapeHtml(form.name)}</title>
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

  <div class="container">
    <div class="submissions-header">
      <h1>📊 All Submissions</h1>
      <p class="subtitle">${escapeHtml(form.name)}</p>
      <a href="/applications/admin" class="back-link">← Back to Dashboard</a>
    </div>

    ${submissions.length === 0 ? `
      <div class="no-submissions">
        <div class="empty-icon">📭</div>
        <h3>No Submissions Yet</h3>
        <p>No one has submitted this application yet.</p>
      </div>
    ` : `
      <div class="submissions-filters">
        <button onclick="filterSubmissions('all')" class="filter-btn active" data-filter="all">
          All (${submissions.length})
        </button>
        <button onclick="filterSubmissions('submitted')" class="filter-btn" data-filter="submitted">
          Pending (${submissions.filter(s => s.status === 'submitted').length})
        </button>
        <button onclick="filterSubmissions('accepted')" class="filter-btn" data-filter="accepted">
          Accepted (${submissions.filter(s => s.status === 'accepted').length})
        </button>
        <button onclick="filterSubmissions('denied')" class="filter-btn" data-filter="denied">
          Denied (${submissions.filter(s => s.status === 'denied').length})
        </button>
      </div>

      <div class="submissions-table">
        ${submissions.map(sub => {
          const config = statusConfig[sub.status] || statusConfig.submitted;
          const displayStatus = sub.custom_status || config.text;
          
          return `
            <div class="submission-row" data-status="${sub.status}">
              <div class="submission-info">
                <div class="submission-user">
                  <strong>${escapeHtml(sub.username)}</strong>
                  <span class="user-id">${sub.user_id}</span>
                </div>
                ${sub.roblox_username ? `
                  <div class="roblox-info">
                    🎮 ${escapeHtml(sub.roblox_username)}
                  </div>
                ` : ''}
                <div class="submission-dates">
                  <span>Submitted: ${new Date(sub.submitted_at).toLocaleDateString()}</span>
                  ${sub.reviewed_at ? `<span>Reviewed: ${new Date(sub.reviewed_at).toLocaleDateString()}</span>` : ''}
                </div>
              </div>
              
              <div class="submission-status">
                <span class="status-badge" style="background: ${config.color}">
                  ${config.icon} ${escapeHtml(displayStatus)}
                </span>
              </div>
              
              <div class="submission-actions">
                ${sub.status === 'submitted' ? `
                  <button onclick="window.location.href='/applications/admin/review/${sub.id}'" class="btn-review">
                    👁️ Review
                  </button>
                ` : `
                  <button onclick="window.location.href='/applications/admin/review/${sub.id}'" class="btn-view">
                    📄 View
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  </div>

  <script>
    function filterSubmissions(status) {
      const rows = document.querySelectorAll('.submission-row');
      const buttons = document.querySelectorAll('.filter-btn');
      
      buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === status) {
          btn.classList.add('active');
        }
      });
      
      rows.forEach(row => {
        if (status === 'all' || row.dataset.status === status) {
          row.style.display = 'flex';
        } else {
          row.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>
  `;
};

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
