// Ban Appeals Admin List View
module.exports = function(user, appeals, filter = 'all') {
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
  
  const statusConfig = {
    pending: { icon: '⏳', text: 'Pending', color: '#FFA500' },
    approved: { icon: '✅', text: 'Approved', color: '#00FF88' },
    denied: { icon: '❌', text: 'Denied', color: '#FF4757' }
  };
  
  const counts = {
    all: appeals.length,
    unread: appeals.filter(a => !a.is_read && a.status === 'pending').length,
    pending: appeals.filter(a => a.status === 'pending').length,
    approved: appeals.filter(a => a.status === 'approved').length,
    denied: appeals.filter(a => a.status === 'denied').length
  };
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ban Appeals - Admin</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
  <style>
    .appeals-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .page-header h1 {
      font-size: 2rem;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .back-link {
      color: var(--text-secondary);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: color 0.3s ease;
    }
    
    .back-link:hover {
      color: var(--royal-blue);
    }
    
    /* Filter Tabs */
    .filter-tabs {
      display: flex;
      gap: 8px;
      background: var(--bg-card);
      padding: 8px;
      border-radius: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      border: 1px solid var(--border-color);
    }
    
    .filter-tab {
      padding: 10px 20px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-size: 0.95rem;
      font-weight: 500;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .filter-tab:hover {
      color: var(--text-primary);
      background: rgba(46, 126, 254, 0.1);
    }
    
    .filter-tab.active {
      background: var(--royal-blue);
      color: white;
    }
    
    .filter-count {
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8rem;
    }
    
    .filter-tab.active .filter-count {
      background: rgba(255, 255, 255, 0.3);
    }
    
    /* Appeals List */
    .appeals-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .appeal-row {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 20px;
      transition: all 0.3s ease;
      text-decoration: none;
      color: var(--text-primary);
    }
    
    .appeal-row:hover {
      transform: translateX(4px);
      border-color: var(--royal-blue);
      box-shadow: 0 4px 16px rgba(46, 126, 254, 0.15);
    }
    
    .appeal-row.unread {
      border-left: 4px solid var(--royal-blue);
      background: rgba(46, 126, 254, 0.05);
    }
    
    .appeal-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      flex-shrink: 0;
      overflow: hidden;
    }
    
    .appeal-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .appeal-info {
      flex: 1;
      min-width: 0;
    }
    
    .appeal-info h3 {
      font-size: 1.1rem;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .appeal-info h3 .unread-badge {
      background: var(--royal-blue);
      color: white;
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }
    
    .appeal-meta {
      color: var(--text-muted);
      font-size: 0.9rem;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    
    .appeal-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .appeal-status {
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      flex-shrink: 0;
    }
    
    .appeal-status.pending {
      background: rgba(255, 165, 0, 0.15);
      color: #FFA500;
    }
    
    .appeal-status.approved {
      background: rgba(0, 255, 136, 0.15);
      color: #00FF88;
    }
    
    .appeal-status.denied {
      background: rgba(255, 71, 87, 0.15);
      color: #FF4757;
    }
    
    .appeal-arrow {
      color: var(--text-muted);
      font-size: 1.2rem;
      transition: transform 0.3s ease;
    }
    
    .appeal-row:hover .appeal-arrow {
      transform: translateX(4px);
      color: var(--royal-blue);
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: var(--bg-card);
      border-radius: 16px;
      border: 1px solid var(--border-color);
    }
    
    .empty-state .empty-icon {
      font-size: 4rem;
      margin-bottom: 20px;
      opacity: 0.5;
    }
    
    .empty-state h3 {
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    
    .empty-state p {
      color: var(--text-secondary);
    }
    
    @media (max-width: 768px) {
      .appeal-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
      
      .appeal-status {
        align-self: flex-start;
      }
      
      .appeal-arrow {
        display: none;
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
      <a href="/appeal" class="nav-link appeals active">
        <span class="nav-link-icon">⚖️</span>
        <span class="nav-link-text">Ban Appeals</span>
      </a>
      <a href="/applications" class="nav-link applications">
        <span class="nav-link-icon">📝</span>
        <span class="nav-link-text">Applications</span>
      </a>
    </div>
  </nav>

  <div class="appeals-container">
    <div class="page-header">
      <h1>⚖️ Ban Appeals</h1>
      <a href="/admin" class="back-link">← Back to Dashboard</a>
    </div>
    
    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button class="filter-tab ${filter === 'all' ? 'active' : ''}" onclick="filterAppeals('all')">
        All <span class="filter-count">${counts.all}</span>
      </button>
      <button class="filter-tab ${filter === 'unread' ? 'active' : ''}" onclick="filterAppeals('unread')">
        📬 Unread <span class="filter-count">${counts.unread}</span>
      </button>
      <button class="filter-tab ${filter === 'pending' ? 'active' : ''}" onclick="filterAppeals('pending')">
        ⏳ Pending <span class="filter-count">${counts.pending}</span>
      </button>
      <button class="filter-tab ${filter === 'approved' ? 'active' : ''}" onclick="filterAppeals('approved')">
        ✅ Approved <span class="filter-count">${counts.approved}</span>
      </button>
      <button class="filter-tab ${filter === 'denied' ? 'active' : ''}" onclick="filterAppeals('denied')">
        ❌ Denied <span class="filter-count">${counts.denied}</span>
      </button>
    </div>
    
    <!-- Appeals List -->
    <div class="appeals-list">
      ${appeals.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No Appeals Found</h3>
          <p>There are no ban appeals matching this filter.</p>
        </div>
      ` : appeals.map(appeal => {
        const status = statusConfig[appeal.status] || statusConfig.pending;
        const isUnread = !appeal.is_read && appeal.status === 'pending';
        
        return `
          <a href="/admin/appeals/review/${appeal.id}" class="appeal-row ${isUnread ? 'unread' : ''}" data-status="${appeal.status}" data-unread="${isUnread}">
            <div class="appeal-avatar">
              ${appeal.avatar ? `<img src="${appeal.avatar}" alt="">` : '👤'}
            </div>
            <div class="appeal-info">
              <h3>
                ${escapeHtml(appeal.username || `User ${appeal.user_id}`)}
                ${isUnread ? '<span class="unread-badge">NEW</span>' : ''}
              </h3>
              <div class="appeal-meta">
                <span>🆔 ${appeal.user_id}</span>
                <span>📅 ${formatDate(appeal.created_at)}</span>
                ${appeal.reviewed_at ? `<span>✓ Reviewed ${formatDate(appeal.reviewed_at)}</span>` : ''}
              </div>
            </div>
            <div class="appeal-status ${appeal.status}">
              ${status.icon} ${status.text}
            </div>
            <div class="appeal-arrow">→</div>
          </a>
        `;
      }).join('')}
    </div>
  </div>
  
  <script>
    function filterAppeals(filter) {
      window.location.href = '/admin/appeals' + (filter !== 'all' ? '?filter=' + filter : '');
    }
    
    // Client-side filtering for quick filtering without page reload
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const filter = tab.textContent.toLowerCase().trim().split(' ')[0];
        
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        document.querySelectorAll('.appeal-row').forEach(row => {
          const status = row.dataset.status;
          const isUnread = row.dataset.unread === 'true';
          
          let show = false;
          if (filter === 'all') show = true;
          else if (filter === '📬') show = isUnread;
          else if (filter === '⏳') show = status === 'pending';
          else if (filter === '✅') show = status === 'approved';
          else if (filter === '❌') show = status === 'denied';
          
          row.style.display = show ? 'flex' : 'none';
        });
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

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
