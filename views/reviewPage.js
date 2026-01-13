// Review Page View
module.exports = function(user, form, submission, questions, responses, allSubmissions) {
  const currentIndex = allSubmissions.findIndex(s => s.id === submission.id);
  const prevSubmission = currentIndex > 0 ? allSubmissions[currentIndex - 1] : null;
  const nextSubmission = currentIndex < allSubmissions.length - 1 ? allSubmissions[currentIndex + 1] : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Application - ${escapeHtml(form.name)}</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body>
  <div class="container review-container">
    <div class="review-header">
      <h1>📋 Review Application</h1>
      <p class="subtitle">${escapeHtml(form.name)}</p>
    </div>

    <div class="review-navigation">
      <button onclick="navigate(${prevSubmission ? prevSubmission.id : 'null'})" 
              ${!prevSubmission ? 'disabled' : ''} 
              class="nav-arrow">
        ← Previous
      </button>
      
      <select onchange="navigate(this.value)" class="applicant-dropdown">
        ${allSubmissions.map(sub => `
          <option value="${sub.id}" ${sub.id === submission.id ? 'selected' : ''}>
            ${escapeHtml(sub.username)} - ${new Date(sub.submitted_at).toLocaleDateString()}
          </option>
        `).join('')}
      </select>
      
      <button onclick="navigate(${nextSubmission ? nextSubmission.id : 'null'})" 
              ${!nextSubmission ? 'disabled' : ''} 
              class="nav-arrow">
        Next →
      </button>
    </div>

    <div class="applicant-info">
      <h2>Applicant Information</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Username:</span>
          <span class="info-value">${escapeHtml(submission.username)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">User ID:</span>
          <span class="info-value">${submission.user_id}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Submitted:</span>
          <span class="info-value">${new Date(submission.submitted_at).toLocaleString()}</span>
        </div>
        ${submission.roblox_username ? `
          <div class="info-item">
            <span class="info-label">Roblox:</span>
            <span class="info-value">${escapeHtml(submission.roblox_username)} (${submission.roblox_id})</span>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="responses-section">
      <h2>Application Responses</h2>
      ${questions.map(q => `
        <div class="response-item">
          <h3 class="question-text">${escapeHtml(q.question)}</h3>
          <div class="response-answer">
            ${formatResponse(responses[q.id], q.type)}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="review-actions">
      <button onclick="reviewAction('accepted')" class="review-btn accept">
        ✅ Accept
      </button>
      <button onclick="reviewAction('denied')" class="review-btn deny">
        ❌ Deny
      </button>
      <button onclick="showCustomStatus()" class="review-btn custom">
        📌 Custom Status
      </button>
      <button onclick="deleteSubmission()" class="review-btn delete">
        🗑️ Delete Response
      </button>
    </div>

    <div class="review-navigation">
      <button onclick="navigate(${prevSubmission ? prevSubmission.id : 'null'})" 
              ${!prevSubmission ? 'disabled' : ''} 
              class="nav-arrow">
        ← Previous
      </button>
      <button onclick="navigate(${nextSubmission ? nextSubmission.id : 'null'})" 
              ${!nextSubmission ? 'disabled' : ''} 
              class="nav-arrow">
        Next →
      </button>
    </div>

    <a href="/applications/admin" class="back-link">← Back to Dashboard</a>
  </div>

  <div id="customModal" class="modal">
    <div class="modal-content">
      <h2>Custom Status</h2>
      <p>Enter a custom status message:</p>
      <input type="text" id="customStatusInput" placeholder="e.g., Awaiting additional information">
      <div class="modal-actions">
        <button onclick="submitCustomStatus()" class="modal-button">Submit</button>
        <button onclick="closeCustomModal()" class="modal-button secondary">Cancel</button>
      </div>
    </div>
  </div>

  <script>
    function navigate(submissionId) {
      if (submissionId) {
        window.location.href = '/applications/admin/review/' + submissionId;
      }
    }

    async function reviewAction(action) {
      if (!confirm('Are you sure you want to ' + action + ' this application?')) {
        return;
      }

      try {
        const res = await fetch('/applications/admin/review/${submission.id}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });

        const data = await res.json();
        
        if (data.success) {
          alert('Application ' + action + ' successfully!');
          window.location.href = '/applications/admin';
        } else {
          alert('Error: ' + data.message);
        }
      } catch (error) {
        alert('Network error occurred');
      }
    }

    function showCustomStatus() {
      document.getElementById('customModal').style.display = 'flex';
    }

    function closeCustomModal() {
      document.getElementById('customModal').style.display = 'none';
    }

    async function submitCustomStatus() {
      const customStatus = document.getElementById('customStatusInput').value.trim();
      if (!customStatus) {
        alert('Please enter a status message');
        return;
      }

      try {
        const res = await fetch('/applications/admin/review/${submission.id}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'custom', customStatus })
        });

        const data = await res.json();
        
        if (data.success) {
          alert('Custom status set successfully!');
          window.location.href = '/applications/admin';
        } else {
          alert('Error: ' + data.message);
        }
      } catch (error) {
        alert('Network error occurred');
      }
    }

    async function deleteSubmission() {
      if (!confirm('Are you sure you want to DELETE this submission?\\n\\nThis will allow the user to submit a new application.\\n\\nThis action CANNOT be undone!')) {
        return;
      }

      try {
        const res = await fetch('/applications/admin/submission/${submission.id}', {
          method: 'DELETE'
        });

        const data = await res.json();
        
        if (data.success) {
          alert('Submission deleted successfully!');
          window.location.href = '/applications/admin';
        } else {
          alert('Error: ' + data.message);
        }
      } catch (error) {
        alert('Network error occurred');
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

function formatResponse(response, type) {
  if (!response && response !== 0) return '<em>No response</em>';
  
  switch (type) {
    case 'checkboxes':
      return Array.isArray(response) 
        ? response.map(r => `<span class="checkbox-item">✓ ${escapeHtml(r)}</span>`).join('<br>')
        : escapeHtml(response);
    
    case 'ranking':
      try {
        const ranked = typeof response === 'string' ? JSON.parse(response) : response;
        return Array.isArray(ranked)
          ? ranked.map((r, i) => `<div class="rank-item">${i + 1}. ${escapeHtml(r)}</div>`).join('')
          : escapeHtml(response);
      } catch {
        return escapeHtml(response);
      }
    
    case 'long_text':
      return `<div class="long-text-response">${escapeHtml(response).replace(/\n/g, '<br>')}</div>`;
    
    default:
      return escapeHtml(response);
  }
}
