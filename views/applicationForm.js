// Application Form View
module.exports = function(user, form, questions, savedResponses) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(form.name)} - Applications</title>
  <link rel="stylesheet" href="/css/appeal.css">
  <link rel="stylesheet" href="/css/applications.css">
</head>
<body>
  <div class="container">
    <div class="form-container">
      <div class="form-header">
        <h1>${escapeHtml(form.name)}</h1>
        <p>${escapeHtml(form.description || '')}</p>
      </div>

      <form id="applicationForm" class="application-form">
        ${questions.map(q => renderQuestion(q, savedResponses[q.id])).join('')}

        <div class="form-actions">
          <button type="button" id="saveBtn" class="save-button">
            💾 Save Progress
          </button>
          <button type="submit" id="submitBtn" class="submit-button">
            📤 Submit Application
          </button>
        </div>
      </form>

      <a href="/applications" class="back-link">← Back to Applications</a>
    </div>
  </div>

  <div id="modal" class="modal">
    <div class="modal-content">
      <div class="modal-icon" id="modalIcon">✅</div>
      <h2 id="modalTitle">Success!</h2>
      <p id="modalMessage">Your application has been saved.</p>
      <button onclick="closeModal()" class="modal-button" id="modalButton">OK</button>
    </div>
  </div>

  <script>
    const form = document.getElementById('applicationForm');
    const saveBtn = document.getElementById('saveBtn');
    const submitBtn = document.getElementById('submitBtn');
    const modal = document.getElementById('modal');

    function getFormData() {
      const formData = new FormData(form);
      const responses = {};
      
      for (let [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          // Handle checkboxes
          const cleanKey = key.replace('[]', '');
          if (!responses[cleanKey]) responses[cleanKey] = [];
          responses[cleanKey].push(value);
        } else {
          responses[key] = value;
        }
      }
      
      return responses;
    }

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      try {
        const responses = getFormData();
        const res = await fetch('/applications/${form.id}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses, submit: false })
        });
        
        const data = await res.json();
        
        if (data.success) {
          showModal('✅', 'Saved!', 'Your progress has been saved. You can continue later.');
        } else {
          showModal('❌', 'Error', data.message || 'Failed to save');
        }
      } catch (error) {
        showModal('❌', 'Error', 'Network error occurred');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Progress';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!confirm('Are you sure you want to submit? You cannot edit after submission.')) {
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      
      try {
        const responses = getFormData();
        const res = await fetch('/applications/${form.id}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses, submit: true })
        });
        
        const data = await res.json();
        
        if (data.success) {
          showModal('✅', 'Submitted!', 'Your application has been submitted. You will be notified of the decision.', true);
        } else {
          showModal('❌', 'Error', data.message || 'Failed to submit');
          submitBtn.disabled = false;
          submitBtn.textContent = '📤 Submit Application';
        }
      } catch (error) {
        showModal('❌', 'Error', 'Network error occurred');
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 Submit Application';
      }
    });

    function showModal(icon, title, message, redirect = false) {
      document.getElementById('modalIcon').textContent = icon;
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('modalMessage').textContent = message;
      modal.style.display = 'flex';
      
      if (redirect) {
        document.getElementById('modalButton').onclick = () => {
          window.location.href = '/applications';
        };
      }
    }

    function closeModal() {
      modal.style.display = 'none';
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

function renderQuestion(question, savedValue = '') {
  const required = question.required ? 'required' : '';
  const value = savedValue || question.default || '';

  switch (question.type) {
    case 'short_text':
      return `
        <div class="form-group">
          <label for="q_${question.id}">
            ${escapeHtml(question.question)}
            ${question.required ? '<span class="required">*</span>' : ''}
          </label>
          ${question.description ? `<p class="field-description">${escapeHtml(question.description)}</p>` : ''}
          <input type="text" 
                 id="q_${question.id}" 
                 name="${question.id}" 
                 value="${escapeHtml(value)}"
                 ${required}
                 maxlength="${question.maxLength || 200}">
        </div>
      `;

    case 'long_text':
      return `
        <div class="form-group">
          <label for="q_${question.id}">
            ${escapeHtml(question.question)}
            ${question.required ? '<span class="required">*</span>' : ''}
          </label>
          ${question.description ? `<p class="field-description">${escapeHtml(question.description)}</p>` : ''}
          <textarea id="q_${question.id}" 
                    name="${question.id}" 
                    rows="${question.rows || 5}"
                    ${required}
                    maxlength="${question.maxLength || 2000}">${escapeHtml(value)}</textarea>
        </div>
      `;

    case 'number':
      return `
        <div class="form-group">
          <label for="q_${question.id}">
            ${escapeHtml(question.question)}
            ${question.required ? '<span class="required">*</span>' : ''}
          </label>
          ${question.description ? `<p class="field-description">${escapeHtml(question.description)}</p>` : ''}
          <input type="number" 
                 id="q_${question.id}" 
                 name="${question.id}" 
                 value="${value}"
                 ${required}
                 ${question.min !== undefined ? `min="${question.min}"` : ''}
                 ${question.max !== undefined ? `max="${question.max}"` : ''}>
        </div>
      `;

    case 'dropdown':
      return `
        <div class="form-group">
          <label for="q_${question.id}">
            ${escapeHtml(question.question)}
            ${question.required ? '<span class="required">*</span>' : ''}
          </label>
          ${question.description ? `<p class="field-description">${escapeHtml(question.description)}</p>` : ''}
          <select id="q_${question.id}" name="${question.id}" ${required}>
            <option value="">Select an option...</option>
            ${(question.options || []).map(opt => `
              <option value="${escapeHtml(opt)}" ${value === opt ? 'selected' : ''}>
                ${escapeHtml(opt)}
              </option>
            `).join('')}
          </select>
        </div>
      `;

    case 'checkboxes':
      return `
        <div class="form-group">
          <label>${escapeHtml(question.question)}
            ${question.required ? '<span class="required">*</span>' : ''}
          </label>
          ${question.description ? `<p class="field-description">${escapeHtml(question.description)}</p>` : ''}
          <div class="checkbox-group">
            ${(question.options || []).map(opt => {
              const checked = Array.isArray(value) ? value.includes(opt) : false;
              return `
                <label class="checkbox-label">
                  <input type="checkbox" 
                         name="${question.id}[]" 
                         value="${escapeHtml(opt)}"
                         ${checked ? 'checked' : ''}>
                  ${escapeHtml(opt)}
                </label>
              `;
            }).join('')}
          </div>
        </div>
      `;

    case 'linear_scale':
      return `
        <div class="form-group">
          <label>${escapeHtml(question.question)}
            ${question.required ? '<span class="required">*</span>' : ''}
          </label>
          ${question.description ? `<p class="field-description">${escapeHtml(question.description)}</p>` : ''}
          <div class="linear-scale">
            <span class="scale-label">${escapeHtml(question.minLabel || question.min || '1')}</span>
            ${Array.from({length: (question.max || 5) - (question.min || 1) + 1}, (_, i) => {
              const val = (question.min || 1) + i;
              return `
                <label class="scale-option">
                  <input type="radio" 
                         name="${question.id}" 
                         value="${val}"
                         ${value == val ? 'checked' : ''}
                         ${required}>
                  <span>${val}</span>
                </label>
              `;
            }).join('')}
            <span class="scale-label">${escapeHtml(question.maxLabel || question.max || '5')}</span>
          </div>
        </div>
      `;

    case 'ranking':
      return `
        <div class="form-group">
          <label>${escapeHtml(question.question)}
            ${question.required ? '<span class="required">*</span>' : ''}
          </label>
          ${question.description ? `<p class="field-description">${escapeHtml(question.description)}</p>` : ''}
          <p class="field-note">Drag to reorder by preference</p>
          <div class="ranking-list" id="rank_${question.id}">
            ${(question.options || []).map((opt, idx) => `
              <div class="ranking-item" draggable="true" data-value="${escapeHtml(opt)}">
                <span class="rank-number">${idx + 1}</span>
                <span class="rank-text">${escapeHtml(opt)}</span>
                <span class="drag-handle">⋮⋮</span>
              </div>
            `).join('')}
          </div>
          <input type="hidden" name="${question.id}" id="rank_input_${question.id}">
        </div>
        <script>
          (function() {
            const list = document.getElementById('rank_${question.id}');
            const input = document.getElementById('rank_input_${question.id}');
            let draggedItem = null;

            list.querySelectorAll('.ranking-item').forEach(item => {
              item.addEventListener('dragstart', () => {
                draggedItem = item;
                item.style.opacity = '0.5';
              });

              item.addEventListener('dragend', () => {
                item.style.opacity = '1';
                updateRanking();
              });

              item.addEventListener('dragover', (e) => {
                e.preventDefault();
              });

              item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedItem !== item) {
                  list.insertBefore(draggedItem, item);
                }
              });
            });

            function updateRanking() {
              const items = Array.from(list.querySelectorAll('.ranking-item'));
              items.forEach((item, idx) => {
                item.querySelector('.rank-number').textContent = idx + 1;
              });
              const ranked = items.map(item => item.dataset.value);
              input.value = JSON.stringify(ranked);
            }

            updateRanking();
          })();
        </script>
      `;

    case 'file_upload':
      return `
        <div class="form-group">
          <label for="q_${question.id}">
            ${escapeHtml(question.question)}
            ${question.required ? '<span class="required">*</span>' : ''}
          </label>
          ${question.description ? `<p class="field-description">${escapeHtml(question.description)}</p>` : ''}
          <p class="field-note">Note: File uploads are not yet implemented. Please provide a link instead.</p>
          <input type="url" 
                 id="q_${question.id}" 
                 name="${question.id}" 
                 placeholder="https://..."
                 value="${escapeHtml(value)}"
                 ${required}>
        </div>
      `;

    default:
      return `<div class="form-group"><p>Unknown question type: ${question.type}</p></div>`;
  }
}
