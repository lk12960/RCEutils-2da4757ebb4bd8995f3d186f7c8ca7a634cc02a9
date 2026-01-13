// Unified Admin Dashboard View - Ban Appeals & Applications
module.exports = function(user, data) {
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
  
  const { appealStats, applicationStats, recentAppeals, recentApplications } = data;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - King's Customs</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
  <style>
    /* Unified Dashboard Styles */
    .dashboard-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .dashboard-header {
      text-align: center;
      margin-bottom: 40px;
    }
    
    .dashboard-header h1 {
      font-size: 2.5rem;
      margin-bottom: 8px;
      background: linear-gradient(135deg, var(--royal-blue-light), var(--royal-blue));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .dashboard-header p {
      color: var(--text-secondary);
      font-size: 1.1rem;
    }
    
    /* Tab Navigation */
    .tab-nav {
      display: flex;
      gap: 8px;
      background: var(--bg-card);
      padding: 8px;
      border-radius: 16px;
      margin-bottom: 30px;
      border: 1px solid var(--border-color);
    }
    
    .tab-btn {
      flex: 1;
      padding: 16px 24px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 1rem;
      font-weight: 600;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    
    .tab-btn:hover {
      color: var(--text-primary);
      background: rgba(46, 126, 254, 0.1);
    }
    
    .tab-btn.active {
      background: linear-gradient(135deg, var(--royal-blue), var(--royal-blue-dark));
      color: white;
      box-shadow: 0 4px 16px rgba(46, 126, 254, 0.3);
    }
    
    .tab-btn.appeals.active {
      background: linear-gradient(135deg, #ff4757, #ff2f3f);
      box-shadow: 0 4px 16px rgba(255, 71, 87, 0.3);
    }
    
    .tab-btn.applications.active {
      background: linear-gradient(135deg, #00ff88, #00cc6a);
      color: var(--bg-dark);
      box-shadow: 0 4px 16px rgba(0, 255, 136, 0.3);
    }
    
    .tab-badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 10px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 700;
    }
    
    .tab-btn.active .tab-badge {
      background: rgba(255, 255, 255, 0.3);
    }
    
    /* Tab Content */
    .tab-content {
      display: none;
      animation: fadeIn 0.3s ease;
    }
    
    .tab-content.active {
      display: block;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid var(--border-color);
      text-align: center;
      transition: all 0.3s ease;
    }
    
    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
    }
    
    .stat-card.pending {
      border-left: 4px solid #FFA500;
    }
    
    .stat-card.unread {
      border-left: 4px solid var(--royal-blue);
    }
    
    .stat-card.approved, .stat-card.accepted {
      border-left: 4px solid var(--success);
    }
    
    .stat-card.denied {
      border-left: 4px solid var(--error);
    }
    
    .stat-icon {
      font-size: 2.5rem;
      margin-bottom: 12px;
    }
    
    .stat-value {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    
    .stat-label {
      color: var(--text-secondary);
      font-size: 0.95rem;
    }
    
    /* Action Buttons */
    .action-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .action-card {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid var(--border-color);
      text-decoration: none;
      color: var(--text-primary);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .action-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
      border-color: var(--royal-blue);
    }
    
    .action-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      flex-shrink: 0;
    }
    
    .action-card.view-all .action-icon {
      background: rgba(46, 126, 254, 0.1);
      border: 1px solid rgba(46, 126, 254, 0.3);
    }
    
    .action-card.view-unread .action-icon {
      background: rgba(255, 165, 0, 0.1);
      border: 1px solid rgba(255, 165, 0, 0.3);
    }
    
    .action-card.create .action-icon {
      background: rgba(0, 255, 136, 0.1);
      border: 1px solid rgba(0, 255, 136, 0.3);
    }
    
    .action-info h3 {
      font-size: 1.1rem;
      margin-bottom: 4px;
    }
    
    .action-info p {
      color: var(--text-secondary);
      font-size: 0.9rem;
      margin: 0;
    }
    
    /* Recent Items List */
    .recent-section {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid var(--border-color);
    }
    
    .recent-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .recent-header h3 {
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .view-all-link {
      color: var(--royal-blue);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.3s ease;
    }
    
    .view-all-link:hover {
      color: var(--royal-blue-light);
    }
    
    .recent-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .recent-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: var(--bg-dark);
      border-radius: 12px;
      transition: all 0.3s ease;
      text-decoration: none;
      color: var(--text-primary);
    }
    
    .recent-item:hover {
      background: rgba(46, 126, 254, 0.1);
    }
    
    .recent-item.unread {
      border-left: 3px solid var(--royal-blue);
    }
    
    .recent-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      flex-shrink: 0;
      overflow: hidden;
    }
    
    .recent-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .recent-info {
      flex: 1;
      min-width: 0;
    }
    
    .recent-info h4 {
      font-size: 1rem;
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .recent-info p {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin: 0;
    }
    
    .recent-status {
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      flex-shrink: 0;
    }
    
    .recent-status.pending {
      background: rgba(255, 165, 0, 0.1);
      color: #FFA500;
    }
    
    .recent-status.approved, .recent-status.accepted {
      background: rgba(0, 255, 136, 0.1);
      color: #00FF88;
    }
    
    .recent-status.denied {
      background: rgba(255, 71, 87, 0.1);
      color: #FF4757;
    }
    
    .recent-status.submitted {
      background: rgba(46, 126, 254, 0.1);
      color: var(--royal-blue);
    }
    
    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--text-muted);
    }
    
    .empty-state .empty-icon {
      font-size: 3rem;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .tab-nav {
        flex-direction: column;
      }
      
      .tab-btn {
        padding: 14px 20px;
      }
      
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .action-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
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
      <a href="/applications" class="nav-link applications">
        <span class="nav-link-icon">📝</span>
        <span class="nav-link-text">Applications</span>
      </a>
    </div>
  </nav>

  <div class="dashboard-container">
    <div class="dashboard-header">
      <h1>⚙️ Admin Dashboard</h1>
      <p>Welcome back, <strong>${escapeHtml(user.username)}</strong></p>
    </div>
    
    <!-- Tab Navigation -->
    <div class="tab-nav">
      <button class="tab-btn appeals active" data-tab="appeals">
        <span>⚖️ Ban Appeals</span>
        ${appealStats.unread > 0 ? `<span class="tab-badge">${appealStats.unread} new</span>` : ''}
      </button>
      <button class="tab-btn applications" data-tab="applications">
        <span>📝 Applications</span>
        ${applicationStats.pending > 0 ? `<span class="tab-badge">${applicationStats.pending} pending</span>` : ''}
      </button>
    </div>
    
    <!-- Ban Appeals Tab -->
    <div class="tab-content active" id="appeals-tab">
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card unread">
          <div class="stat-icon">📬</div>
          <div class="stat-value">${appealStats.unread || 0}</div>
          <div class="stat-label">Unread Appeals</div>
        </div>
        <div class="stat-card pending">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${appealStats.pending || 0}</div>
          <div class="stat-label">Pending Review</div>
        </div>
        <div class="stat-card approved">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${appealStats.approved || 0}</div>
          <div class="stat-label">Approved</div>
        </div>
        <div class="stat-card denied">
          <div class="stat-icon">❌</div>
          <div class="stat-value">${appealStats.denied || 0}</div>
          <div class="stat-label">Denied</div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="action-grid">
        <a href="/admin/appeals" class="action-card view-all">
          <div class="action-icon">📋</div>
          <div class="action-info">
            <h3>View All Appeals</h3>
            <p>Browse and manage all ban appeals</p>
          </div>
        </a>
        <a href="/admin/appeals?filter=unread" class="action-card view-unread">
          <div class="action-icon">📬</div>
          <div class="action-info">
            <h3>View Unread</h3>
            <p>${appealStats.unread || 0} appeals awaiting review</p>
          </div>
        </a>
      </div>
      
      <!-- Recent Appeals -->
      <div class="recent-section">
        <div class="recent-header">
          <h3>📋 Recent Appeals</h3>
          <a href="/admin/appeals" class="view-all-link">View All →</a>
        </div>
        <div class="recent-list">
          ${recentAppeals.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📭</div>
              <p>No appeals yet</p>
            </div>
          ` : recentAppeals.slice(0, 5).map(appeal => `
            <a href="/admin/appeals/review/${appeal.id}" class="recent-item ${appeal.is_read ? '' : 'unread'}">
              <div class="recent-avatar">
                ${appeal.avatar ? `<img src="${appeal.avatar}" alt="">` : '👤'}
              </div>
              <div class="recent-info">
                <h4>${escapeHtml(appeal.username || `User ${appeal.user_id}`)}</h4>
                <p>Submitted ${formatTimeAgo(appeal.created_at)}</p>
              </div>
              <span class="recent-status ${appeal.status}">${appeal.status}</span>
            </a>
          `).join('')}
        </div>
      </div>
    </div>
    
    <!-- Applications Tab -->
    <div class="tab-content" id="applications-tab">
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card pending">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${applicationStats.pending || 0}</div>
          <div class="stat-label">Pending Review</div>
        </div>
        <div class="stat-card accepted">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${applicationStats.accepted || 0}</div>
          <div class="stat-label">Accepted</div>
        </div>
        <div class="stat-card denied">
          <div class="stat-icon">❌</div>
          <div class="stat-value">${applicationStats.denied || 0}</div>
          <div class="stat-label">Denied</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-value">${applicationStats.total || 0}</div>
          <div class="stat-label">Total Applications</div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="action-grid">
        <a href="/applications/admin" class="action-card view-all">
          <div class="action-icon">📋</div>
          <div class="action-info">
            <h3>Applications Dashboard</h3>
            <p>Manage application forms and submissions</p>
          </div>
        </a>
        <a href="/applications/admin/builder" class="action-card create">
          <div class="action-icon">➕</div>
          <div class="action-info">
            <h3>Create New Form</h3>
            <p>Build a new application form</p>
          </div>
        </a>
      </div>
      
      <!-- Recent Applications -->
      <div class="recent-section">
        <div class="recent-header">
          <h3>📝 Recent Submissions</h3>
          <a href="/applications/admin" class="view-all-link">View All →</a>
        </div>
        <div class="recent-list">
          ${recentApplications.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📭</div>
              <p>No applications yet</p>
            </div>
          ` : recentApplications.slice(0, 5).map(app => `
            <a href="/applications/admin/review/${app.id}" class="recent-item">
              <div class="recent-avatar">
                ${app.avatar ? `<img src="${app.avatar}" alt="">` : '👤'}
              </div>
              <div class="recent-info">
                <h4>${escapeHtml(app.username || `User ${app.user_id}`)}</h4>
                <p>${escapeHtml(app.form_name || 'Application')} • ${formatTimeAgo(app.submitted_at || app.created_at)}</p>
              </div>
              <span class="recent-status ${app.status}">${app.status}</span>
            </a>
          `).join('')}
        </div>
      </div>
    </div>
  </div>
  
  <script>
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tab + '-tab').classList.add('active');
      });
    });
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

function formatTimeAgo(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
