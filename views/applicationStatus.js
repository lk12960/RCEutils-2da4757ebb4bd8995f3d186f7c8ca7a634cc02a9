// Application Status Page View
module.exports = function(user, form, submission) {
  const statusConfig = {
    submitted: { icon: '⏳', title: 'Pending Review', color: '#2E7EFE', message: 'Your application is being reviewed by our team.' },
    accepted: { icon: '✅', title: 'Accepted', color: '#00FF88', message: 'Congratulations! Your application has been accepted.' },
    denied: { icon: '❌', title: 'Denied', color: '#FF4757', message: 'Your application has been denied.' },
    custom: { icon: '📌', title: 'Status Update', color: '#FFA500', message: '' }
  };

  const config = statusConfig[submission.status] || statusConfig.submitted;
  const displayTitle = submission.custom_status || config.title;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Status - ${escapeHtml(form.name)}</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body>
  <div class="container">
    <div class="status-container">
      <div class="status-header">
        <h1>${escapeHtml(form.name)}</h1>
      </div>

      <div class="status-card" style="border-left: 4px solid ${config.color}">
        <div class="status-icon-large">${config.icon}</div>
        <h2>${escapeHtml(displayTitle)}</h2>
        <p class="status-message">${config.message}</p>
        
        ${submission.custom_status ? `
          <div class="custom-status-box">
            <strong>Status Details:</strong>
            <p>${escapeHtml(submission.custom_status)}</p>
          </div>
        ` : ''}

        <div class="status-details">
          <div class="detail-row">
            <span class="detail-label">Submitted:</span>
            <span class="detail-value">${new Date(submission.submitted_at).toLocaleString()}</span>
          </div>
          ${submission.reviewed_at ? `
            <div class="detail-row">
              <span class="detail-label">Reviewed:</span>
              <span class="detail-value">${new Date(submission.reviewed_at).toLocaleString()}</span>
            </div>
          ` : ''}
          ${submission.roblox_username ? `
            <div class="detail-row">
              <span class="detail-label">Roblox Account:</span>
              <span class="detail-value">${escapeHtml(submission.roblox_username)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <a href="/applications" class="back-link">← Back to Applications</a>
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
