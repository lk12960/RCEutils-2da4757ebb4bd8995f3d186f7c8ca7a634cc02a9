// Ban Appeal Review Page View
module.exports = function(user, appeal, banCase, allAppeals) {
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
  
  // Find current index and prev/next appeals
  const currentIndex = allAppeals.findIndex(a => a.id === appeal.id);
  const prevAppeal = currentIndex > 0 ? allAppeals[currentIndex - 1] : null;
  const nextAppeal = currentIndex < allAppeals.length - 1 ? allAppeals[currentIndex + 1] : null;
  
  const statusConfig = {
    pending: { icon: '⏳', text: 'Pending Review', color: '#FFA500', bg: 'rgba(255, 165, 0, 0.15)' },
    approved: { icon: '✅', text: 'Approved', color: '#00FF88', bg: 'rgba(0, 255, 136, 0.15)' },
    denied: { icon: '❌', text: 'Denied', color: '#FF4757', bg: 'rgba(255, 71, 87, 0.15)' }
  };
  
  const status = statusConfig[appeal.status] || statusConfig.pending;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Appeal - ${escapeHtml(appeal.username || appeal.user_id)}</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
  <style>
    .review-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    
    /* Navigation Header */
    .review-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .back-link {
      color: var(--text-secondary);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      transition: color 0.3s ease;
    }
    
    .back-link:hover {
      color: var(--royal-blue);
    }
    
    .nav-arrows {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .nav-arrow {
      padding: 10px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.9rem;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .nav-arrow:hover:not(.disabled) {
      border-color: var(--royal-blue);
      color: var(--royal-blue);
      background: rgba(46, 126, 254, 0.1);
    }
    
    .nav-arrow.disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }
    
    .nav-position {
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    
    /* Appeal selector dropdown */
    .appeal-selector {
      position: relative;
    }
    
    .appeal-selector-btn {
      padding: 10px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 0.9rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
    }
    
    .appeal-selector-btn:hover {
      border-color: var(--royal-blue);
    }
    
    .appeal-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      min-width: 280px;
      max-height: 300px;
      overflow-y: auto;
      box-shadow: var(--shadow-lg);
      z-index: 100;
      display: none;
    }
    
    .appeal-dropdown.open {
      display: block;
      animation: fadeIn 0.2s ease;
    }
    
    .appeal-dropdown-item {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text-primary);
      transition: background 0.2s ease;
      border-bottom: 1px solid var(--border-color);
    }
    
    .appeal-dropdown-item:last-child {
      border-bottom: none;
    }
    
    .appeal-dropdown-item:hover {
      background: rgba(46, 126, 254, 0.1);
    }
    
    .appeal-dropdown-item.current {
      background: rgba(46, 126, 254, 0.15);
    }
    
    .dropdown-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      overflow: hidden;
    }
    
    .dropdown-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .dropdown-info {
      flex: 1;
      min-width: 0;
    }
    
    .dropdown-info .name {
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .dropdown-info .status {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    /* User Card */
    .user-card {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid var(--border-color);
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    
    .user-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      overflow: hidden;
      flex-shrink: 0;
    }
    
    .user-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .user-info {
      flex: 1;
      min-width: 200px;
    }
    
    .user-info h2 {
      font-size: 1.5rem;
      margin-bottom: 4px;
    }
    
    .user-id {
      color: var(--text-muted);
      font-size: 0.9rem;
      font-family: monospace;
    }
    
    .user-info .submitted-date {
      color: var(--text-secondary);
      font-size: 0.9rem;
      margin-top: 8px;
    }
    
    .current-status {
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      background: ${status.bg};
      color: ${status.color};
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    /* Ban Info Card */
    .ban-info-card {
      background: rgba(255, 71, 87, 0.1);
      border: 1px solid rgba(255, 71, 87, 0.3);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    
    .ban-info-card h3 {
      color: #FF4757;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .ban-details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    
    .ban-detail {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    
    .ban-detail .label {
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    
    .ban-detail .value {
      color: var(--text-primary);
      font-size: 1rem;
    }
    
    /* Appeal Content */
    .appeal-content {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid var(--border-color);
      margin-bottom: 24px;
    }
    
    .appeal-section {
      margin-bottom: 24px;
    }
    
    .appeal-section:last-child {
      margin-bottom: 0;
    }
    
    .appeal-section h3 {
      color: var(--text-secondary);
      font-size: 0.95rem;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .appeal-section .response {
      background: var(--bg-dark);
      border-radius: 12px;
      padding: 16px;
      color: var(--text-primary);
      line-height: 1.7;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    /* Action Buttons */
    .action-card {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid var(--border-color);
    }
    
    .action-card h3 {
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .action-buttons {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    
    .action-btn {
      flex: 1;
      min-width: 150px;
      padding: 16px 24px;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .action-btn.approve {
      background: linear-gradient(135deg, #00FF88, #00cc6a);
      color: var(--bg-dark);
    }
    
    .action-btn.approve:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 255, 136, 0.4);
    }
    
    .action-btn.deny {
      background: linear-gradient(135deg, #ff4757, #ff2f3f);
      color: white;
    }
    
    .action-btn.deny:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(255, 71, 87, 0.4);
    }
    
    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }
    
    /* Denial Reason Input */
    .denial-reason-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
      display: none;
    }
    
    .denial-reason-section.show {
      display: block;
      animation: fadeIn 0.3s ease;
    }
    
    .denial-reason-section label {
      display: block;
      margin-bottom: 8px;
      color: var(--text-secondary);
    }
    
    .denial-reason-section textarea {
      width: 100%;
      padding: 12px 16px;
      background: var(--bg-dark);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 1rem;
      resize: vertical;
      min-height: 100px;
    }
    
    .denial-reason-section textarea:focus {
      outline: none;
      border-color: var(--royal-blue);
    }
    
    .confirm-deny-btn {
      margin-top: 16px;
      padding: 12px 24px;
      background: #ff4757;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .confirm-deny-btn:hover {
      background: #ff2f3f;
    }
    
    /* Already Reviewed Notice */
    .reviewed-notice {
      background: rgba(46, 126, 254, 0.1);
      border: 1px solid rgba(46, 126, 254, 0.3);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .reviewed-notice .icon {
      font-size: 1.5rem;
    }
    
    .reviewed-notice .info {
      flex: 1;
    }
    
    .reviewed-notice .info strong {
      display: block;
      margin-bottom: 2px;
    }
    
    .reviewed-notice .info span {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @media (max-width: 768px) {
      .user-card {
        flex-direction: column;
        text-align: center;
      }
      
      .action-buttons {
        flex-direction: column;
      }
      
      .nav-arrows {
        width: 100%;
        justify-content: space-between;
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

  <div class="review-container">
    <!-- Navigation -->
    <div class="review-nav">
      <a href="/admin/appeals" class="back-link">← Back to Appeals</a>
      
      <div class="nav-arrows">
        <a href="${prevAppeal ? `/admin/appeals/review/${prevAppeal.id}` : '#'}" class="nav-arrow ${!prevAppeal ? 'disabled' : ''}">
          ← Previous
        </a>
        
        <span class="nav-position">${currentIndex + 1} of ${allAppeals.length}</span>
        
        <!-- Dropdown Selector -->
        <div class="appeal-selector">
          <button class="appeal-selector-btn" onclick="toggleDropdown()">
            Jump to... ▼
          </button>
          <div class="appeal-dropdown" id="appealDropdown">
            ${allAppeals.map((a, i) => `
              <a href="/admin/appeals/review/${a.id}" class="appeal-dropdown-item ${a.id === appeal.id ? 'current' : ''}">
                <div class="dropdown-avatar">
                  ${a.avatar ? `<img src="${a.avatar}" alt="">` : '👤'}
                </div>
                <div class="dropdown-info">
                  <div class="name">${escapeHtml(a.username || `User ${a.user_id}`)}</div>
                  <div class="status">${a.status} • #${i + 1}</div>
                </div>
              </a>
            `).join('')}
          </div>
        </div>
        
        <a href="${nextAppeal ? `/admin/appeals/review/${nextAppeal.id}` : '#'}" class="nav-arrow ${!nextAppeal ? 'disabled' : ''}">
          Next →
        </a>
      </div>
    </div>
    
    <!-- User Card -->
    <div class="user-card">
      <div class="user-avatar">
        ${appeal.avatar ? `<img src="${appeal.avatar}" alt="">` : '👤'}
      </div>
      <div class="user-info">
        <h2>${escapeHtml(appeal.username || 'Unknown User')}</h2>
        <div class="user-id">${appeal.user_id}</div>
        <div class="submitted-date">📅 Submitted ${formatDate(appeal.created_at)}</div>
      </div>
      <div class="current-status">
        ${status.icon} ${status.text}
      </div>
    </div>
    
    <!-- Ban Info -->
    ${banCase ? `
      <div class="ban-info-card">
        <h3>⚖️ Ban Information</h3>
        <div class="ban-details-grid">
          <div class="ban-detail">
            <span class="label">Ban Reason</span>
            <span class="value">${escapeHtml(banCase.reason || 'No reason provided')}</span>
          </div>
          <div class="ban-detail">
            <span class="label">Banned By</span>
            <span class="value">${escapeHtml(banCase.mod_username || 'Unknown')}</span>
          </div>
          <div class="ban-detail">
            <span class="label">Case ID</span>
            <span class="value">#${banCase.id}</span>
          </div>
          <div class="ban-detail">
            <span class="label">Ban Date</span>
            <span class="value">${formatDate(banCase.timestamp)}</span>
          </div>
        </div>
      </div>
    ` : ''}
    
    <!-- Appeal Content -->
    <div class="appeal-content">
      <div class="appeal-section">
        <h3>📋 What actions led to your ban?</h3>
        <div class="response">${escapeHtml(appeal.reason_for_ban || 'No response provided')}</div>
      </div>
      
      <div class="appeal-section">
        <h3>❓ Why should you be unbanned?</h3>
        <div class="response">${escapeHtml(appeal.why_unban || 'No response provided')}</div>
      </div>
    </div>
    
    <!-- Action Card -->
    <div class="action-card">
      <h3>⚡ Actions</h3>
      
      ${appeal.status !== 'pending' ? `
        <div class="reviewed-notice">
          <div class="icon">${status.icon}</div>
          <div class="info">
            <strong>This appeal has been ${appeal.status}</strong>
            <span>Reviewed ${appeal.reviewed_at ? formatDate(appeal.reviewed_at) : 'at some point'}</span>
            ${appeal.denial_reason ? `<p style="margin-top: 8px; color: var(--text-secondary);">Denial reason: ${escapeHtml(appeal.denial_reason)}</p>` : ''}
          </div>
        </div>
      ` : ''}
      
      <div class="action-buttons">
        <button class="action-btn approve" onclick="approveAppeal(${appeal.id})" ${appeal.status !== 'pending' ? 'disabled' : ''}>
          ✅ Approve & Unban
        </button>
        <button class="action-btn deny" onclick="showDenyForm()" ${appeal.status !== 'pending' ? 'disabled' : ''}>
          ❌ Deny Appeal
        </button>
      </div>
      
      <div class="denial-reason-section" id="denialSection">
        <label for="denialReason">Denial Reason (optional):</label>
        <textarea id="denialReason" placeholder="Explain why this appeal is being denied..."></textarea>
        <button class="confirm-deny-btn" onclick="denyAppeal(${appeal.id})">
          Confirm Denial
        </button>
      </div>
    </div>
  </div>
  
  <script>
    function toggleDropdown() {
      document.getElementById('appealDropdown').classList.toggle('open');
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.appeal-selector')) {
        document.getElementById('appealDropdown').classList.remove('open');
      }
    });
    
    function showDenyForm() {
      document.getElementById('denialSection').classList.add('show');
    }
    
    async function approveAppeal(appealId) {
      if (!confirm('Are you sure you want to APPROVE this appeal and unban the user?')) return;
      
      try {
        const response = await fetch('/admin/appeals/' + appealId + '/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
          alert('Appeal approved! User has been unbanned.');
          window.location.reload();
        } else {
          alert('Error: ' + (data.message || 'Failed to approve appeal'));
        }
      } catch (err) {
        alert('Error approving appeal');
        console.error(err);
      }
    }
    
    async function denyAppeal(appealId) {
      const reason = document.getElementById('denialReason').value;
      
      if (!confirm('Are you sure you want to DENY this appeal?')) return;
      
      try {
        const response = await fetch('/admin/appeals/' + appealId + '/deny', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        });
        
        const data = await response.json();
        
        if (data.success) {
          alert('Appeal denied.');
          window.location.reload();
        } else {
          alert('Error: ' + (data.message || 'Failed to deny appeal'));
        }
      } catch (err) {
        alert('Error denying appeal');
        console.error(err);
      }
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
