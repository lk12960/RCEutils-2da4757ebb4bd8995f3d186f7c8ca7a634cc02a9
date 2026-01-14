// Staff Profile Page View - Part 1: Header and Styles
const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';

function generateStyles() {
  return `
    <style>
      .profile-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
      .profile-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
      .back-link { color: var(--text-secondary); text-decoration: none; display: flex; align-items: center; gap: 8px; transition: color 0.3s ease; }
      .back-link:hover { color: var(--royal-blue); }
      .nav-arrows { display: flex; gap: 8px; }
      .nav-arrow { padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-secondary); text-decoration: none; transition: all 0.3s ease; }
      .nav-arrow:hover:not(.disabled) { border-color: var(--royal-blue); color: var(--royal-blue); }
      .nav-arrow.disabled { opacity: 0.4; pointer-events: none; }
      
      /* Profile Card */
      .profile-card { background: var(--bg-card); border-radius: 16px; padding: 32px; border: 1px solid var(--border-color); margin-bottom: 24px; }
      .profile-header { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
      .profile-avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid var(--border-color); flex-shrink: 0; }
      .profile-info { flex: 1; min-width: 250px; }
      .profile-name { font-size: 2rem; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .profile-id { color: var(--text-muted); font-family: monospace; font-size: 0.9rem; margin-bottom: 12px; }
      .profile-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
      .badge { padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; }
      .badge.category { background: var(--royal-blue); color: white; }
      .badge.position { background: rgba(46, 126, 254, 0.15); color: var(--royal-blue); }
      .badge.specialty { background: rgba(233, 30, 99, 0.15); color: #E91E63; }
      .badge.status-active { background: rgba(0, 255, 136, 0.15); color: #00ff88; }
      .badge.status-suspended { background: rgba(255, 71, 87, 0.15); color: #ff4757; }
      .badge.status-loa { background: rgba(255, 165, 2, 0.15); color: #ffa502; }
      
      /* Stats Row */
      .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border-color); }
      .stat-item { text-align: center; }
      .stat-value { font-size: 1.8rem; font-weight: 800; color: var(--text-primary); }
      .stat-label { font-size: 0.85rem; color: var(--text-muted); }
      
      /* Action Buttons */
      .action-buttons { display: flex; gap: 12px; flex-wrap: wrap; }
      .action-btn { padding: 12px 20px; border-radius: 10px; border: none; cursor: pointer; font-weight: 600; font-size: 0.95rem; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px; }
      .action-btn:hover { transform: translateY(-2px); }
      .action-btn.promote { background: linear-gradient(135deg, #00FF88, #00cc6a); color: var(--bg-dark); }
      .action-btn.demote { background: linear-gradient(135deg, #ffa502, #ff9500); color: var(--bg-dark); }
      .action-btn.infract { background: linear-gradient(135deg, #ff4757, #ff2f3f); color: white; }
      .action-btn.suspend { background: linear-gradient(135deg, #9b59b6, #8e44ad); color: white; }
      .action-btn.secondary { background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); }
      .action-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
      
      /* Tabs */
      .tabs-container { margin-bottom: 24px; }
      .tabs-nav { display: flex; gap: 4px; background: var(--bg-card); padding: 6px; border-radius: 12px; border: 1px solid var(--border-color); overflow-x: auto; }
      .tab-btn { padding: 12px 20px; background: transparent; border: none; color: var(--text-secondary); font-size: 0.95rem; font-weight: 500; border-radius: 8px; cursor: pointer; white-space: nowrap; transition: all 0.3s ease; }
      .tab-btn:hover { color: var(--text-primary); background: rgba(46, 126, 254, 0.1); }
      .tab-btn.active { background: var(--royal-blue); color: white; }
      .tab-content { display: none; animation: fadeIn 0.3s ease; }
      .tab-content.active { display: block; }
      
      /* Content Cards */
      .content-card { background: var(--bg-card); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color); margin-bottom: 16px; }
      .content-card h3 { font-size: 1.1rem; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
      
      /* Info Grid */
      .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
      .info-item { display: flex; flex-direction: column; gap: 4px; }
      .info-item .label { font-size: 0.85rem; color: var(--text-muted); }
      .info-item .value { font-size: 1rem; color: var(--text-primary); }
      
      /* Timeline */
      .timeline { position: relative; padding-left: 24px; }
      .timeline::before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: var(--border-color); }
      .timeline-item { position: relative; padding-bottom: 20px; }
      .timeline-item:last-child { padding-bottom: 0; }
      .timeline-item::before { content: ''; position: absolute; left: -20px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--royal-blue); border: 2px solid var(--bg-card); }
      .timeline-item.promotion::before { background: #00ff88; }
      .timeline-item.demotion::before { background: #ff4757; }
      .timeline-date { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px; }
      .timeline-content { font-size: 0.95rem; }
      
      /* Infractions List */
      .infraction-item { padding: 16px; background: var(--bg-dark); border-radius: 10px; margin-bottom: 12px; border-left: 4px solid var(--border-color); }
      .infraction-item.notice { border-color: #3498db; }
      .infraction-item.warning { border-color: #ffa502; }
      .infraction-item.strike { border-color: #ff4757; }
      .infraction-item.voided { opacity: 0.5; border-color: var(--text-muted); }
      .infraction-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
      .infraction-type { font-weight: 600; }
      .infraction-actions { display: flex; gap: 8px; }
      .infraction-actions button { padding: 4px 10px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary); cursor: pointer; }
      
      /* Notes Section */
      .note-item { padding: 16px; background: var(--bg-dark); border-radius: 10px; margin-bottom: 12px; }
      .note-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .note-meta { font-size: 0.85rem; color: var(--text-muted); }
      .note-content { color: var(--text-primary); line-height: 1.6; }
      .add-note-form { display: flex; gap: 12px; margin-top: 16px; }
      .add-note-form textarea { flex: 1; padding: 12px; background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); resize: vertical; min-height: 80px; }
      
      /* LOA Section */
      .loa-status { padding: 20px; background: var(--bg-dark); border-radius: 10px; }
      .loa-active { border-left: 4px solid #ffa502; }
      .loa-info { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 12px; }
      
      /* Modals */
      .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); display: none; align-items: center; justify-content: center; z-index: 99999; opacity: 0; visibility: hidden; transition: opacity 0.3s ease, visibility 0.3s ease; }
      .modal-overlay.show { display: flex !important; opacity: 1 !important; visibility: visible !important; }
      .modal { background: var(--bg-card); border-radius: 16px; padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; z-index: 100000; position: relative; border: 1px solid var(--border-color); box-shadow: 0 20px 60px rgba(0,0,0,0.5); transform: scale(0.9); transition: transform 0.3s ease; }
      .modal-overlay.show .modal { transform: scale(1); }
      .modal h2 { margin-bottom: 20px; color: var(--text-primary); }
      .modal p { color: var(--text-secondary); margin-bottom: 16px; }
      .modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
      .form-group { margin-bottom: 16px; }
      .form-group label { display: block; margin-bottom: 6px; color: var(--text-secondary); font-size: 0.9rem; }
      .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-size: 1rem; }
      .form-group select { cursor: pointer; }
      .form-group textarea { min-height: 100px; resize: vertical; font-family: inherit; }
      
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @media (max-width: 768px) { .profile-header { flex-direction: column; align-items: center; text-align: center; } .action-buttons { justify-content: center; } }
    </style>
  `;
}

// Main profile page render function
function renderStaffProfile(user, staffMember, additionalData = {}) {
  const { notes = [], infractions = [], loa = null, allStaff = [] } = additionalData;
  
  // Find prev/next for navigation
  const currentIndex = allStaff.findIndex(s => s.id === staffMember.id);
  const prevStaff = currentIndex > 0 ? allStaff[currentIndex - 1] : null;
  const nextStaff = currentIndex < allStaff.length - 1 ? allStaff[currentIndex + 1] : null;
  
  const statusClass = staffMember.status === 'suspended' ? 'status-suspended' : (loa ? 'status-loa' : 'status-active');
  const statusText = staffMember.status === 'suspended' ? 'SUSPENDED' : (loa ? 'ON LOA' : 'ACTIVE');
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(staffMember.username)} - Staff Profile</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
  ${generateStyles()}
</head>
<body class="has-nav">
  <nav class="top-nav">
    <a href="/" class="nav-logo">
      <img src="${serverLogoUrl}" alt="King's Customs">
      <span class="nav-logo-text">King's Customs</span>
    </a>
    <div class="nav-links">
      <a href="/" class="nav-link home"><span class="nav-link-icon">🏠</span><span class="nav-link-text">Home</span></a>
      <a href="/appeal" class="nav-link appeals"><span class="nav-link-icon">⚖️</span><span class="nav-link-text">Ban Appeals</span></a>
      <a href="/applications" class="nav-link applications"><span class="nav-link-icon">📝</span><span class="nav-link-text">Applications</span></a>
    </div>
  </nav>

  <div class="profile-container">
    <!-- Navigation -->
    <div class="profile-nav">
      <a href="/admin/staff" class="back-link">← Back to Staff List</a>
      <div class="nav-arrows">
        <a href="${prevStaff ? `/admin/staff/${prevStaff.id}` : '#'}" class="nav-arrow ${!prevStaff ? 'disabled' : ''}">← Previous</a>
        <a href="${nextStaff ? `/admin/staff/${nextStaff.id}` : '#'}" class="nav-arrow ${!nextStaff ? 'disabled' : ''}">Next →</a>
      </div>
    </div>
    
    <!-- Profile Card -->
    <div class="profile-card">
      <div class="profile-header">
        <img src="${staffMember.avatar}" alt="${escapeHtml(staffMember.username)}" class="profile-avatar">
        <div class="profile-info">
          <div class="profile-name">
            ${escapeHtml(staffMember.displayName || staffMember.username)}
            <span class="badge ${statusClass}">${statusText}</span>
          </div>
          <div class="profile-id">@${escapeHtml(staffMember.username)} • ${staffMember.id}</div>
          
          <div class="profile-badges">
            <span class="badge category">${staffMember.category.icon} ${staffMember.category.name}</span>
            ${staffMember.category.position ? `<span class="badge position">${staffMember.category.position.name}</span>` : ''}
            ${(staffMember.category.specialties || []).map(s => `<span class="badge specialty">${s.short}</span>`).join('')}
            ${(staffMember.category.additionalCategories || []).map(c => 
              `<span class="badge" style="background: ${c.color}20; color: ${c.color};">${c.icon} ${c.name}</span>`
            ).join('')}
          </div>
          
          <div class="action-buttons">
            <button class="action-btn promote" onclick="showPromoteModal()" ${staffMember.status === 'suspended' ? 'disabled' : ''}>⬆️ Promote</button>
            <button class="action-btn demote" onclick="showDemoteModal()" ${staffMember.status === 'suspended' ? 'disabled' : ''}>⬇️ Demote</button>
            <button class="action-btn infract" onclick="showInfractModal()">⚠️ Infract</button>
            <button class="action-btn suspend" onclick="showSuspendModal()" ${staffMember.status === 'suspended' ? 'disabled' : ''}>⏸️ Suspend</button>
            <button class="action-btn secondary" onclick="showWipeModal()">🗑️ Wipe Infractions</button>
          </div>
        </div>
      </div>
      
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-value">${staffMember.stats.infractionsReceived}</div>
          <div class="stat-label">Infractions</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${staffMember.stats.moderationsIssued}</div>
          <div class="stat-label">Moderations</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${staffMember.stats.ticketsHandled}</div>
          <div class="stat-label">Tickets</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${formatTenure(staffMember.record?.staff_since)}</div>
          <div class="stat-label">Staff Tenure</div>
        </div>
      </div>
    </div>
    
    <!-- Tabs -->
    <div class="tabs-container">
      <div class="tabs-nav">
        <button class="tab-btn active" data-tab="overview">📋 Overview</button>
        <button class="tab-btn" data-tab="infractions">⚠️ Infractions (${infractions.length})</button>
        <button class="tab-btn" data-tab="notes">📝 Notes (${notes.length})</button>
        <button class="tab-btn" data-tab="history">📊 History</button>
        <button class="tab-btn" data-tab="loa">🏖️ LOA</button>
      </div>
      
      <!-- Overview Tab -->
      <div class="tab-content active" id="tab-overview">
        <div class="content-card">
          <h3>👤 Account Information</h3>
          <div class="info-grid">
            <div class="info-item"><span class="label">Discord ID</span><span class="value">${staffMember.id}</span></div>
            <div class="info-item"><span class="label">Username</span><span class="value">${escapeHtml(staffMember.username)}</span></div>
            <div class="info-item"><span class="label">Display Name</span><span class="value">${escapeHtml(staffMember.displayName || 'None')}</span></div>
            <div class="info-item"><span class="label">Account Created</span><span class="value">${formatDateTime(staffMember.createdAt)}</span></div>
            <div class="info-item"><span class="label">Joined Server</span><span class="value">${formatDateTime(staffMember.joinedAt)}</span></div>
          </div>
        </div>
        
        <div class="content-card">
          <h3>📊 Staff Information</h3>
          <div class="info-grid">
            <div class="info-item"><span class="label">Staff Since</span><span class="value">${formatDateTime(staffMember.record?.staff_since)}</span></div>
            <div class="info-item"><span class="label">Last Promotion</span><span class="value">${formatDateTime(staffMember.record?.last_promotion_date) || 'Never'}</span></div>
            <div class="info-item"><span class="label">Primary Category</span><span class="value">${staffMember.category.name}</span></div>
            <div class="info-item"><span class="label">Position</span><span class="value">${staffMember.category.position?.name || 'N/A'}</span></div>
            <div class="info-item"><span class="label">Status</span><span class="value">${statusText}</span></div>
            ${staffMember.category.additionalCategories && staffMember.category.additionalCategories.length > 0 ? 
              `<div class="info-item"><span class="label">Additional Categories</span><span class="value">${staffMember.category.additionalCategories.map(c => c.name).join(', ')}</span></div>` : ''}
          </div>
        </div>
        
        <div class="content-card">
          <h3>🎭 Current Roles</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${(staffMember.roleObjects || []).sort((a,b) => b.position - a.position).slice(0, 15).map(r => 
              `<span style="padding: 4px 10px; background: ${r.color}20; color: ${r.color === '#000000' ? 'var(--text-primary)' : r.color}; border-radius: 6px; font-size: 0.85rem;">${escapeHtml(r.name)}</span>`
            ).join('')}
          </div>
        </div>
      </div>
      
      <!-- Infractions Tab -->
      <div class="tab-content" id="tab-infractions">
        <div class="content-card">
          <h3>⚠️ Infractions Received</h3>
          ${infractions.length === 0 ? '<p style="color: var(--text-muted);">No infractions on record.</p>' : 
            infractions.map(inf => `
              <div class="infraction-item ${inf.type.toLowerCase()} ${inf.revoked ? 'voided' : ''}">
                <div class="infraction-header">
                  <span class="infraction-type">#${inf.id} - ${inf.type} ${inf.revoked ? '(VOIDED)' : ''}</span>
                  <div class="infraction-actions">
                    ${inf.revoked ? 
                      `<button onclick="unrevokeInfraction(${inf.id})">Unvoid</button>` : 
                      `<button onclick="revokeInfraction(${inf.id})">Void</button>`
                    }
                  </div>
                </div>
                <div style="margin-bottom: 8px;"><strong>Reason:</strong> ${escapeHtml(inf.reason)}</div>
                ${inf.notes ? `<div style="margin-bottom: 8px; color: var(--text-muted);"><strong>Notes:</strong> ${escapeHtml(inf.notes)}</div>` : ''}
                <div style="font-size: 0.85rem; color: var(--text-muted);">Issued by <@${inf.moderator_id}> on ${formatDateTime(inf.timestamp)}</div>
              </div>
            `).join('')}
        </div>
      </div>
      
      <!-- Notes Tab -->
      <div class="tab-content" id="tab-notes">
        <div class="content-card">
          <h3>📝 Staff Notes</h3>
          ${notes.length === 0 ? '<p style="color: var(--text-muted);">No notes on record.</p>' : 
            notes.map(note => `
              <div class="note-item">
                <div class="note-header">
                  <span class="note-meta">By <@${note.moderatorId}></span>
                  <span class="note-meta">${formatDateTime(note.timestamp)}</span>
                </div>
                <div class="note-content">${escapeHtml(note.content)}</div>
                <button style="margin-top: 8px; padding: 4px 10px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color); background: transparent; color: var(--text-muted); cursor: pointer;" onclick="deleteNote('${note.id}')">Delete</button>
              </div>
            `).join('')}
          
          <div class="add-note-form">
            <textarea id="newNote" placeholder="Add a note..."></textarea>
            <button class="action-btn secondary" onclick="addNote()">Add Note</button>
          </div>
        </div>
      </div>
      
      <!-- History Tab -->
      <div class="tab-content" id="tab-history">
        <div class="content-card">
          <h3>📊 Promotion History</h3>
          ${(staffMember.promotionHistory || []).length === 0 ? '<p style="color: var(--text-muted);">No promotion history.</p>' : `
            <div class="timeline">
              ${staffMember.promotionHistory.map(p => `
                <div class="timeline-item ${p.reason?.includes('[DEMOTION]') ? 'demotion' : 'promotion'}">
                  <div class="timeline-date">${formatDateTime(p.timestamp)}</div>
                  <div class="timeline-content">
                    ${p.reason?.includes('[DEMOTION]') ? '⬇️ Demoted' : '⬆️ Promoted'} from <strong>${p.from_category || 'N/A'}</strong> to <strong>${p.to_category}</strong>
                    ${p.reason ? `<br><span style="color: var(--text-muted);">${escapeHtml(p.reason.replace('[DEMOTION] ', ''))}</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
      
      <!-- LOA Tab -->
      <div class="tab-content" id="tab-loa">
        <div class="content-card">
          <h3>🏖️ Leave of Absence</h3>
          ${loa ? `
            <div class="loa-status loa-active">
              <strong>Currently on LOA</strong>
              <div class="loa-info">
                <div class="info-item"><span class="label">Started</span><span class="value">${formatDateTime(loa.start_time)}</span></div>
                <div class="info-item"><span class="label">Ends</span><span class="value">${formatDateTime(loa.end_time)}</span></div>
                <div class="info-item"><span class="label">Reason</span><span class="value">${escapeHtml(loa.reason)}</span></div>
              </div>
              <div style="margin-top: 16px; display: flex; gap: 12px;">
                <button class="action-btn secondary" onclick="editLOA(${loa.id})">✏️ Edit LOA</button>
                <button class="action-btn secondary" onclick="endLOA(${loa.id})">⏹️ End LOA Early</button>
              </div>
            </div>
          ` : `
            <p style="color: var(--text-muted); margin-bottom: 16px;">Not currently on LOA.</p>
            <button class="action-btn secondary" onclick="showStartLOAModal()">🏖️ Start LOA</button>
          `}
        </div>
      </div>
    </div>
  </div>

  <!-- Modals - Must be at body root level -->
  <div id="modalsContainer">
    <!-- Promote Modal -->
    <div class="modal-overlay" id="promoteModal">
      <div class="modal" onclick="event.stopPropagation()">
        <h2>⬆️ Promote Staff Member</h2>
        <p>Promoting <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Reason (optional)</label>
          <textarea id="promoteReason" placeholder="Reason for promotion..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('promoteModal')">Cancel</button>
          <button class="action-btn promote" onclick="promoteStaff()">Promote</button>
        </div>
      </div>
    </div>
    
    <!-- Demote Modal -->
    <div class="modal-overlay" id="demoteModal">
      <div class="modal" onclick="event.stopPropagation()">
        <h2>⬇️ Demote Staff Member</h2>
        <p>Demoting <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Reason (required)</label>
          <textarea id="demoteReason" placeholder="Reason for demotion..." required></textarea>
        </div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">⚠️ A demotion infraction will be automatically issued.</p>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('demoteModal')">Cancel</button>
          <button class="action-btn demote" onclick="demoteStaff()">Demote</button>
        </div>
      </div>
    </div>
    
    <!-- Infract Modal -->
    <div class="modal-overlay" id="infractModal">
      <div class="modal" onclick="event.stopPropagation()">
        <h2>⚠️ Issue Infraction</h2>
        <p>Issuing infraction to <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Type</label>
          <select id="infractType">
            <option value="Notice">Notice</option>
            <option value="Warning">Warning</option>
            <option value="Strike">Strike</option>
            <option value="Termination">Termination</option>
            <option value="Blacklist">Blacklist</option>
          </select>
        </div>
        <div class="form-group">
          <label>Reason (required)</label>
          <textarea id="infractReason" placeholder="Reason for infraction..." required></textarea>
        </div>
        <div class="form-group">
          <label>Notes (optional)</label>
          <textarea id="infractNotes" placeholder="Additional notes..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('infractModal')">Cancel</button>
          <button class="action-btn infract" onclick="infractStaff()">Issue Infraction</button>
        </div>
      </div>
    </div>
    
    <!-- Suspend Modal -->
    <div class="modal-overlay" id="suspendModal">
      <div class="modal" onclick="event.stopPropagation()">
        <h2>⏸️ Suspend Staff Member</h2>
        <p>Suspending <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Duration</label>
          <select id="suspendDuration">
            <option value="1d">1 Day</option>
            <option value="3d">3 Days</option>
            <option value="1w">1 Week</option>
            <option value="2w">2 Weeks</option>
            <option value="1m">1 Month</option>
          </select>
        </div>
        <div class="form-group">
          <label>Reason (required)</label>
          <textarea id="suspendReason" placeholder="Reason for suspension..." required></textarea>
        </div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">⚠️ All staff roles will be temporarily removed and restored when suspension ends.</p>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('suspendModal')">Cancel</button>
          <button class="action-btn suspend" onclick="suspendStaff()">Suspend</button>
        </div>
      </div>
    </div>
    
    <!-- Wipe Modal -->
    <div class="modal-overlay" id="wipeModal">
      <div class="modal" onclick="event.stopPropagation()">
        <h2>🗑️ Wipe Infractions</h2>
        <p>This will permanently delete ALL infractions for <strong>${escapeHtml(staffMember.username)}</strong>.</p>
        <p style="color: #ff4757; font-weight: 600;">⚠️ This action cannot be undone!</p>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('wipeModal')">Cancel</button>
          <button class="action-btn infract" onclick="wipeInfractions()">Wipe All Infractions</button>
        </div>
      </div>
    </div>
    
    <!-- LOA Modal -->
    <div class="modal-overlay" id="loaModal">
      <div class="modal" onclick="event.stopPropagation()">
        <h2>🏖️ Start LOA</h2>
        <p>Starting LOA for <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Duration</label>
          <select id="loaDuration">
            <option value="1d">1 Day</option>
            <option value="3d">3 Days</option>
            <option value="1w">1 Week</option>
            <option value="2w">2 Weeks</option>
          </select>
        </div>
        <div class="form-group">
          <label>Reason</label>
          <textarea id="loaReason" placeholder="Reason for LOA..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('loaModal')">Cancel</button>
          <button class="action-btn promote" onclick="startLOA()">Start LOA</button>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    // Staff member ID for API calls
    const STAFF_ID = '${staffMember.id}';
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });
    
    // Modal functions
    function showModal(id) { 
      const modal = document.getElementById(id);
      if (modal) {
        // Force display and add show class
        modal.style.display = 'flex';
        // Use setTimeout to ensure transition works
        setTimeout(() => {
          modal.classList.add('show');
        }, 10);
        document.body.style.overflow = 'hidden';
        console.log('Showing modal:', id);
      } else {
        console.error('Modal not found:', id);
      }
    }
    function hideModal(id) { 
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.remove('show');
        // Delay hiding display until transition completes
        setTimeout(() => {
          modal.style.display = 'none';
        }, 300);
        document.body.style.overflow = '';
      }
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.show').forEach(modal => {
          hideModal(modal.id);
        });
      }
    });
    function showPromoteModal() { showModal('promoteModal'); }
    function showDemoteModal() { showModal('demoteModal'); }
    function showInfractModal() { showModal('infractModal'); }
    function showSuspendModal() { showModal('suspendModal'); }
    function showWipeModal() { showModal('wipeModal'); }
    function showStartLOAModal() { showModal('loaModal'); }
    
    // Close modal when clicking overlay background
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', function(e) {
        if (e.target === this) {
          hideModal(this.id);
        }
      });
    });
    
    // API calls
    async function apiCall(endpoint, method = 'POST', body = null) {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null
      });
      return res.json();
    }
    
    async function promoteStaff() {
      const reason = document.getElementById('promoteReason').value;
      const result = await apiCall('/admin/staff/' + STAFF_ID + '/promote', 'POST', { reason });
      if (result.success) { alert('Staff member promoted!'); location.reload(); }
      else alert('Error: ' + result.message);
    }
    
    async function demoteStaff() {
      const reason = document.getElementById('demoteReason').value;
      if (!reason) { alert('Reason is required for demotion'); return; }
      const result = await apiCall('/admin/staff/' + STAFF_ID + '/demote', 'POST', { reason });
      if (result.success) { alert('Staff member demoted!'); location.reload(); }
      else alert('Error: ' + result.message);
    }
    
    async function infractStaff() {
      const type = document.getElementById('infractType').value;
      const reason = document.getElementById('infractReason').value;
      const notes = document.getElementById('infractNotes').value;
      if (!reason) { alert('Reason is required'); return; }
      const result = await apiCall('/admin/staff/' + STAFF_ID + '/infract', 'POST', { type, reason, notes });
      if (result.success) { alert('Infraction issued!'); location.reload(); }
      else alert('Error: ' + result.message);
    }
    
    async function suspendStaff() {
      const duration = document.getElementById('suspendDuration').value;
      const reason = document.getElementById('suspendReason').value;
      if (!duration || !reason) { alert('Duration and reason are required'); return; }
      const result = await apiCall('/admin/staff/' + STAFF_ID + '/suspend', 'POST', { duration, reason });
      if (result.success) { alert('Staff member suspended!'); location.reload(); }
      else alert('Error: ' + result.message);
    }
    
    async function wipeInfractions() {
      if (!confirm('Are you sure you want to wipe ALL infractions for this user? This cannot be undone!')) return;
      const result = await apiCall('/admin/staff/' + STAFF_ID + '/wipe-infractions', 'POST');
      if (result.success) { alert('Infractions wiped!'); location.reload(); }
      else alert('Error: ' + result.message);
    }
    
    async function revokeInfraction(id) {
      const result = await apiCall('/admin/infractions/' + id + '/revoke', 'POST');
      if (result.success) location.reload();
      else alert('Error: ' + result.message);
    }
    
    async function unrevokeInfraction(id) {
      const result = await apiCall('/admin/infractions/' + id + '/unrevoke', 'POST');
      if (result.success) location.reload();
      else alert('Error: ' + result.message);
    }
    
    async function addNote() {
      const content = document.getElementById('newNote').value;
      if (!content) { alert('Note content is required'); return; }
      const result = await apiCall('/admin/staff/' + STAFF_ID + '/notes', 'POST', { content });
      if (result.success) location.reload();
      else alert('Error: ' + result.message);
    }
    
    async function deleteNote(id) {
      if (!confirm('Delete this note?')) return;
      const result = await apiCall('/admin/notes/' + id, 'DELETE');
      if (result.success) location.reload();
      else alert('Error: ' + result.message);
    }
    
    async function endLOA(id) {
      if (!confirm('End this LOA early?')) return;
      const result = await apiCall('/admin/loa/' + id + '/end', 'POST');
      if (result.success) location.reload();
      else alert('Error: ' + result.message);
    }
    
    async function startLOA() {
      const duration = document.getElementById('loaDuration').value;
      const reason = document.getElementById('loaReason').value;
      const result = await apiCall('/admin/staff/' + STAFF_ID + '/loa', 'POST', { duration, reason });
      if (result.success) { alert('LOA started!'); location.reload(); }
      else alert('Error: ' + result.message);
    }
  </script>
</body>
</html>
  `;
}

function generateModals(staffMember) {
  return `
    <!-- Promote Modal -->
    <div class="modal-overlay" id="promoteModal" onclick="if(event.target === this) hideModal('promoteModal')">
      <div class="modal">
        <h2>⬆️ Promote Staff Member</h2>
        <p>Promoting <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Reason (optional)</label>
          <textarea id="promoteReason" placeholder="Reason for promotion..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('promoteModal')">Cancel</button>
          <button class="action-btn promote" onclick="promoteStaff()">Promote</button>
        </div>
      </div>
    </div>
    
    <!-- Demote Modal -->
    <div class="modal-overlay" id="demoteModal" onclick="if(event.target === this) hideModal('demoteModal')">
      <div class="modal">
        <h2>⬇️ Demote Staff Member</h2>
        <p>Demoting <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Reason (required)</label>
          <textarea id="demoteReason" placeholder="Reason for demotion..." required></textarea>
        </div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">⚠️ A demotion infraction will be automatically issued.</p>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('demoteModal')">Cancel</button>
          <button class="action-btn demote" onclick="demoteStaff()">Demote</button>
        </div>
      </div>
    </div>
    
    <!-- Infract Modal -->
    <div class="modal-overlay" id="infractModal" onclick="if(event.target === this) hideModal('infractModal')">
      <div class="modal">
        <h2>⚠️ Issue Infraction</h2>
        <p>Issuing infraction to <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Type</label>
          <select id="infractType">
            <option value="Notice">Notice</option>
            <option value="Warning">Warning</option>
            <option value="Strike">Strike</option>
            <option value="Termination">Termination</option>
            <option value="Blacklist">Blacklist</option>
          </select>
        </div>
        <div class="form-group">
          <label>Reason (required)</label>
          <textarea id="infractReason" placeholder="Reason for infraction..." required></textarea>
        </div>
        <div class="form-group">
          <label>Notes (optional)</label>
          <textarea id="infractNotes" placeholder="Additional notes..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('infractModal')">Cancel</button>
          <button class="action-btn infract" onclick="infractStaff()">Issue Infraction</button>
        </div>
      </div>
    </div>
    
    <!-- Suspend Modal -->
    <div class="modal-overlay" id="suspendModal" onclick="if(event.target === this) hideModal('suspendModal')">
      <div class="modal">
        <h2>⏸️ Suspend Staff Member</h2>
        <p>Suspending <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Duration</label>
          <select id="suspendDuration">
            <option value="1d">1 Day</option>
            <option value="3d">3 Days</option>
            <option value="1w">1 Week</option>
            <option value="2w">2 Weeks</option>
            <option value="1m">1 Month</option>
          </select>
        </div>
        <div class="form-group">
          <label>Reason (required)</label>
          <textarea id="suspendReason" placeholder="Reason for suspension..." required></textarea>
        </div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">⚠️ All staff roles will be temporarily removed and restored when suspension ends.</p>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('suspendModal')">Cancel</button>
          <button class="action-btn suspend" onclick="suspendStaff()">Suspend</button>
        </div>
      </div>
    </div>
    
    <!-- Wipe Modal -->
    <div class="modal-overlay" id="wipeModal" onclick="if(event.target === this) hideModal('wipeModal')">
      <div class="modal">
        <h2>🗑️ Wipe Infractions</h2>
        <p>This will permanently delete ALL infractions for <strong>${escapeHtml(staffMember.username)}</strong>.</p>
        <p style="color: #ff4757; font-weight: 600;">⚠️ This action cannot be undone!</p>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('wipeModal')">Cancel</button>
          <button class="action-btn infract" onclick="wipeInfractions()">Wipe All Infractions</button>
        </div>
      </div>
    </div>
    
    <!-- LOA Modal -->
    <div class="modal-overlay" id="loaModal" onclick="if(event.target === this) hideModal('loaModal')">
      <div class="modal">
        <h2>🏖️ Start LOA</h2>
        <p>Starting LOA for <strong>${escapeHtml(staffMember.username)}</strong></p>
        <div class="form-group">
          <label>Duration</label>
          <select id="loaDuration">
            <option value="1d">1 Day</option>
            <option value="3d">3 Days</option>
            <option value="1w">1 Week</option>
            <option value="2w">2 Weeks</option>
          </select>
        </div>
        <div class="form-group">
          <label>Reason</label>
          <textarea id="loaReason" placeholder="Reason for LOA..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="action-btn secondary" onclick="hideModal('loaModal')">Cancel</button>
          <button class="action-btn promote" onclick="startLOA()">Start LOA</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTenure(dateString) {
  if (!dateString) return 'N/A';
  const start = new Date(dateString);
  const now = new Date();
  const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

module.exports = { generateStyles, serverLogoUrl, renderStaffProfile };
