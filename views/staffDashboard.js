// Staff Management Dashboard View
module.exports = function(user, staffData, filters = {}) {
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
  
  const { staffMembers, categories, stats } = staffData;
  
  // Group staff by category
  const groupedStaff = {};
  for (const category of Object.values(categories)) {
    groupedStaff[category.name] = staffMembers.filter(s => s.category.name === category.name);
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Staff Management - Admin Dashboard</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
  <style>
    /* Staff Dashboard Specific Styles */
    .staff-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .staff-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      flex-wrap: wrap;
      gap: 20px;
    }
    
    .staff-header h1 {
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
    
    /* Search and Filters */
    .search-filters {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
      border: 1px solid var(--border-color);
    }
    
    .search-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .search-input {
      flex: 1;
      padding: 12px 16px;
      background: var(--bg-dark);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      color: var(--text-primary);
      font-size: 1rem;
    }
    
    .search-input:focus {
      outline: none;
      border-color: var(--royal-blue);
    }
    
    .search-btn {
      padding: 12px 24px;
      background: var(--royal-blue);
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    
    .search-btn:hover {
      background: var(--royal-blue-light);
    }
    
    /* Advanced Filters */
    .advanced-filters {
      display: none;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
      margin-top: 16px;
    }
    
    .advanced-filters.show {
      display: block;
      animation: fadeIn 0.3s ease;
    }
    
    .filter-toggle {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.3s ease;
    }
    
    .filter-toggle:hover {
      border-color: var(--royal-blue);
      color: var(--text-primary);
    }
    
    .filter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .filter-group label {
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    
    .filter-group select {
      padding: 10px 12px;
      background: var(--bg-dark);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 0.95rem;
    }
    
    /* Stats Overview */
    .stats-overview {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .stat-box {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid var(--border-color);
      transition: all 0.3s ease;
    }
    
    .stat-box:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    
    .stat-box .icon {
      font-size: 2rem;
      margin-bottom: 8px;
    }
    
    .stat-box .value {
      font-size: 2rem;
      font-weight: 800;
      color: var(--text-primary);
    }
    
    .stat-box .label {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-top: 4px;
    }
    
    /* Category Sections */
    .category-section {
      margin-bottom: 32px;
    }
    
    .category-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--border-color);
    }
    
    .category-icon {
      font-size: 1.5rem;
    }
    
    .category-title {
      font-size: 1.4rem;
      font-weight: 700;
    }
    
    .category-count {
      background: var(--bg-card);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    
    /* Staff Grid */
    .staff-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    
    /* Staff Card */
    .staff-card {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 16px;
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 16px;
      transition: all 0.3s ease;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
    }
    
    .staff-card:hover {
      transform: translateX(4px);
      border-color: var(--royal-blue);
      box-shadow: 0 4px 16px rgba(46, 126, 254, 0.15);
    }
    
    .staff-card.suspended {
      border-left: 4px solid #ff4757;
      opacity: 0.7;
    }
    
    .staff-card.loa {
      border-left: 4px solid #ffa502;
    }
    
    .staff-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 2px solid var(--border-color);
    }
    
    .staff-info {
      flex: 1;
      min-width: 0;
    }
    
    .staff-name {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .staff-name .status-badge {
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }
    
    .status-badge.active {
      background: rgba(0, 255, 136, 0.15);
      color: #00ff88;
    }
    
    .status-badge.suspended {
      background: rgba(255, 71, 87, 0.15);
      color: #ff4757;
    }
    
    .status-badge.loa {
      background: rgba(255, 165, 2, 0.15);
      color: #ffa502;
    }
    
    .staff-category {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }
    
    .staff-category .specialty {
      color: var(--royal-blue);
      cursor: help;
    }
    
    .staff-meta {
      display: flex;
      gap: 12px;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    
    .staff-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .staff-arrow {
      color: var(--text-muted);
      font-size: 1.2rem;
      transition: transform 0.3s ease;
    }
    
    .staff-card:hover .staff-arrow {
      transform: translateX(4px);
      color: var(--royal-blue);
    }
    
    /* Mass Actions */
    .mass-actions {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid var(--border-color);
      display: none;
    }
    
    .mass-actions.show {
      display: flex;
      align-items: center;
      gap: 16px;
      animation: fadeIn 0.3s ease;
    }
    
    .mass-actions .selected-count {
      font-weight: 600;
      color: var(--royal-blue);
    }
    
    .mass-actions .action-btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
    }
    
    .mass-actions .action-btn.infract {
      background: linear-gradient(135deg, #ff4757, #ff2f3f);
      color: white;
    }
    
    .mass-actions .action-btn.clear {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }
    
    /* Tooltip */
    .tooltip {
      position: relative;
    }
    
    .tooltip::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-dark);
      color: var(--text-primary);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 0.85rem;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease;
      z-index: 100;
      border: 1px solid var(--border-color);
    }
    
    .tooltip:hover::after {
      opacity: 1;
      visibility: visible;
    }
    
    /* Empty State */
    .empty-category {
      padding: 40px;
      text-align: center;
      color: var(--text-muted);
      background: var(--bg-card);
      border-radius: 12px;
      border: 1px dashed var(--border-color);
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @media (max-width: 768px) {
      .staff-grid {
        grid-template-columns: 1fr;
      }
      
      .stats-overview {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .filter-grid {
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

  <div class="staff-container">
    <!-- Header -->
    <div class="staff-header">
      <h1>👥 Staff Management</h1>
      <a href="/admin" class="back-link">← Back to Dashboard</a>
    </div>
    
    <!-- Stats Overview -->
    <div class="stats-overview">
      <div class="stat-box">
        <div class="icon">👥</div>
        <div class="value">${stats.total}</div>
        <div class="label">Total Staff</div>
      </div>
      <div class="stat-box">
        <div class="icon">✅</div>
        <div class="value">${stats.active}</div>
        <div class="label">Active</div>
      </div>
      <div class="stat-box">
        <div class="icon">🏖️</div>
        <div class="value">${stats.onLOA}</div>
        <div class="label">On LOA</div>
      </div>
      <div class="stat-box">
        <div class="icon">⏸️</div>
        <div class="value">${stats.suspended}</div>
        <div class="label">Suspended</div>
      </div>
    </div>
    
    <!-- Search and Filters -->
    <div class="search-filters">
      <div class="search-bar">
        <input type="text" class="search-input" id="staffSearch" placeholder="Search by username, nickname, or ID...">
        <button class="filter-toggle" onclick="toggleFilters()">⚙️ Filters</button>
      </div>
      
      <div class="advanced-filters" id="advancedFilters">
        <div class="filter-grid">
          <div class="filter-group">
            <label>Sort By</label>
            <select id="sortBy" onchange="applyFilters()">
              <option value="category">Category (Default)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="infractions-asc">Infractions (Low to High)</option>
              <option value="infractions-desc">Infractions (High to Low)</option>
              <option value="tenure">Staff Tenure</option>
              <option value="promotion">Last Promotion</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Category</label>
            <select id="filterCategory" onchange="applyFilters()">
              <option value="all">All Categories</option>
              ${Object.values(categories).map(c => `
                <option value="${c.name}">${c.icon} ${c.name}</option>
              `).join('')}
            </select>
          </div>
          
          <div class="filter-group">
            <label>Status</label>
            <select id="filterStatus" onchange="applyFilters()">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="loa">On LOA</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Infractions</label>
            <select id="filterInfractions" onchange="applyFilters()">
              <option value="all">Any</option>
              <option value="none">No Infractions</option>
              <option value="1+">1+ Infractions</option>
              <option value="3+">3+ Infractions</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Mass Actions (hidden until selections) -->
    <div class="mass-actions" id="massActions">
      <span><span class="selected-count" id="selectedCount">0</span> staff selected</span>
      <button class="action-btn infract" onclick="massInfract()">⚠️ Mass Infract</button>
      <button class="action-btn clear" onclick="clearSelection()">✕ Clear Selection</button>
    </div>
    
    <!-- Staff by Category -->
    ${Object.entries(groupedStaff).map(([categoryName, members]) => {
      const categoryData = Object.values(categories).find(c => c.name === categoryName);
      if (!categoryData) return '';
      
      return `
        <div class="category-section" data-category="${categoryName}">
          <div class="category-header" style="border-color: ${categoryData.color}40;">
            <span class="category-icon">${categoryData.icon}</span>
            <span class="category-title" style="color: ${categoryData.color}">${categoryName}</span>
            <span class="category-count">${members.length} members</span>
          </div>
          
          <div class="staff-grid">
            ${members.length === 0 ? `
              <div class="empty-category">No staff members in this category</div>
            ` : members.map(member => {
              const specialtyDisplay = member.category.specialties && member.category.specialties.length > 0
                ? formatSpecialtiesHTML(member.category.specialties)
                : '';
              
              return `
                <a href="/admin/staff/${member.id}" class="staff-card ${member.status}" data-id="${member.id}" data-name="${member.username.toLowerCase()}" data-category="${categoryName}" data-status="${member.status}" data-infractions="${member.stats.infractionsReceived}">
                  <img src="${member.avatar}" alt="${escapeHtml(member.username)}" class="staff-avatar">
                  <div class="staff-info">
                    <div class="staff-name">
                      ${escapeHtml(member.displayName || member.username)}
                      ${member.status !== 'active' ? `<span class="status-badge ${member.status}">${member.status.toUpperCase()}</span>` : ''}
                    </div>
                    <div class="staff-category">
                      ${categoryName}${member.category.position ? ` • ${member.category.position.name}` : ''}
                      ${specialtyDisplay}
                      ${member.category.additionalCategories && member.category.additionalCategories.length > 0 ? 
                        `<span class="tooltip" data-tooltip="${member.category.additionalCategories.map(c => c.name).join(', ')}" style="color: var(--text-muted); font-size: 0.8rem;"> (+${member.category.additionalCategories.length} more)</span>` : ''}
                    </div>
                    <div class="staff-meta">
                      <span title="Infractions Received">⚠️ ${member.stats.infractionsReceived}</span>
                      ${categoryData.priority <= 4 ? `<span title="Moderations Issued">🛡️ ${member.stats.moderationsIssued}</span>` : ''}
                      <span title="Staff Since">📅 ${formatDate(member.record?.staff_since)}</span>
                    </div>
                  </div>
                  <span class="staff-arrow">→</span>
                </a>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('')}
  </div>

  <script>
    // Search functionality
    const searchInput = document.getElementById('staffSearch');
    searchInput.addEventListener('input', debounce(applyFilters, 300));
    
    function debounce(func, wait) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
    
    function toggleFilters() {
      document.getElementById('advancedFilters').classList.toggle('show');
    }
    
    function applyFilters() {
      const search = searchInput.value.toLowerCase();
      const sortBy = document.getElementById('sortBy').value;
      const filterCategory = document.getElementById('filterCategory').value;
      const filterStatus = document.getElementById('filterStatus').value;
      const filterInfractions = document.getElementById('filterInfractions').value;
      
      const cards = document.querySelectorAll('.staff-card');
      
      cards.forEach(card => {
        const name = card.dataset.name;
        const id = card.dataset.id;
        const category = card.dataset.category;
        const status = card.dataset.status;
        const infractions = parseInt(card.dataset.infractions) || 0;
        
        let show = true;
        
        // Search filter
        if (search && !name.includes(search) && !id.includes(search)) {
          show = false;
        }
        
        // Category filter
        if (filterCategory !== 'all' && category !== filterCategory) {
          show = false;
        }
        
        // Status filter
        if (filterStatus !== 'all' && status !== filterStatus) {
          show = false;
        }
        
        // Infractions filter
        if (filterInfractions === 'none' && infractions > 0) show = false;
        if (filterInfractions === '1+' && infractions < 1) show = false;
        if (filterInfractions === '3+' && infractions < 3) show = false;
        
        card.style.display = show ? 'flex' : 'none';
      });
      
      // Hide empty categories
      document.querySelectorAll('.category-section').forEach(section => {
        const visibleCards = section.querySelectorAll('.staff-card[style="display: flex;"], .staff-card:not([style*="display"])');
        const hasVisible = Array.from(section.querySelectorAll('.staff-card')).some(c => c.style.display !== 'none');
        section.style.display = (filterCategory === 'all' || section.dataset.category === filterCategory) && hasVisible ? 'block' : 'none';
      });
    }
    
    // Selection for mass actions
    let selectedStaff = new Set();
    
    function toggleSelection(e, id) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (selectedStaff.has(id)) {
          selectedStaff.delete(id);
          e.currentTarget.classList.remove('selected');
        } else {
          selectedStaff.add(id);
          e.currentTarget.classList.add('selected');
        }
        updateMassActions();
      }
    }
    
    function updateMassActions() {
      const container = document.getElementById('massActions');
      const countEl = document.getElementById('selectedCount');
      
      if (selectedStaff.size > 0) {
        container.classList.add('show');
        countEl.textContent = selectedStaff.size;
      } else {
        container.classList.remove('show');
      }
    }
    
    function clearSelection() {
      selectedStaff.clear();
      document.querySelectorAll('.staff-card.selected').forEach(c => c.classList.remove('selected'));
      updateMassActions();
    }
    
    function massInfract() {
      if (selectedStaff.size === 0) return;
      window.location.href = '/admin/staff/mass-infract?ids=' + Array.from(selectedStaff).join(',');
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
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatSpecialtiesHTML(specialties) {
  if (!specialties || specialties.length === 0) return '';
  
  const primary = specialties[0];
  if (specialties.length === 1) {
    return ` • <span class="specialty">${primary.short}</span>`;
  }
  
  const allNames = specialties.map(s => s.name).join(', ');
  return ` • <span class="specialty tooltip" data-tooltip="${allNames}">${primary.short} (+${specialties.length - 1})</span>`;
}
