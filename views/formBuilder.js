// Form Builder View
module.exports = function(user) {
  const serverLogoUrl = 'https://media.discordapp.net/attachments/1411101283389149294/1459270065185620233/WhiteOutlined.png?ex=69669f27&is=69654da7&hm=e5d3c0edffbcf4b2640825bea6492b51e09eff93d0da515045925fed94368fe3&=&format=webp&quality=lossless&width=1098&height=732';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Form Builder - Applications</title>
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

  <div class="container builder-container">
    <div class="builder-header">
      <h1>🛠️ Application Form Builder</h1>
      <a href="/applications/admin" class="back-link">← Back to Dashboard</a>
    </div>

    <div class="builder-content">
      <div class="form-settings">
        <h2>Form Details</h2>
        <div class="form-group">
          <label>Form Name *</label>
          <input type="text" id="formName" placeholder="e.g., Staff Application" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="formDescription" rows="3" placeholder="Briefly describe this application..."></textarea>
        </div>
      </div>

      <div class="questions-builder">
        <div class="builder-toolbar">
          <h2>Questions</h2>
          <div class="question-types">
            <button onclick="addQuestion('short_text')" class="add-btn" title="Short Text">📝 Short Text</button>
            <button onclick="addQuestion('long_text')" class="add-btn" title="Long Text">📄 Long Text</button>
            <button onclick="addQuestion('number')" class="add-btn" title="Number">🔢 Number</button>
            <button onclick="addQuestion('dropdown')" class="add-btn" title="Dropdown">📋 Dropdown</button>
            <button onclick="addQuestion('checkboxes')" class="add-btn" title="Checkboxes">☑️ Checkboxes</button>
            <button onclick="addQuestion('linear_scale')" class="add-btn" title="Linear Scale">📊 Scale</button>
            <button onclick="addQuestion('ranking')" class="add-btn" title="Ranking">🔝 Ranking</button>
            <button onclick="addQuestion('file_upload')" class="add-btn" title="File Upload">📎 File</button>
          </div>
        </div>

        <div id="questionsList" class="questions-list">
          <p class="empty-state">No questions yet. Click a button above to add one.</p>
        </div>
      </div>

      <div class="form-actions">
        <button onclick="saveForm()" class="submit-button">💾 Create Form</button>
        <button onclick="previewForm()" class="secondary-button">👁️ Preview</button>
      </div>
    </div>
  </div>

  <div id="modal" class="modal">
    <div class="modal-content success">
      <div class="modal-icon">✅</div>
      <h2>Form Created!</h2>
      <p>Your application form has been created successfully.</p>
      <button onclick="window.location.href='/applications/admin'" class="modal-button">Go to Dashboard</button>
    </div>
  </div>

  <script>
    let questions = [];
    let questionIdCounter = 1;

    function addQuestion(type) {
      const question = {
        id: 'q_' + questionIdCounter++,
        type: type,
        question: '',
        description: '',
        required: false,
        options: type === 'dropdown' || type === 'checkboxes' || type === 'ranking' ? ['Option 1'] : undefined,
        min: type === 'linear_scale' ? 1 : undefined,
        max: type === 'linear_scale' ? 5 : undefined,
        maxLength: type === 'short_text' ? 200 : type === 'long_text' ? 2000 : undefined
      };

      questions.push(question);
      renderQuestions();
    }

    function removeQuestion(id) {
      questions = questions.filter(q => q.id !== id);
      renderQuestions();
    }

    function moveQuestion(id, direction) {
      const index = questions.findIndex(q => q.id === id);
      if (direction === 'up' && index > 0) {
        [questions[index], questions[index - 1]] = [questions[index - 1], questions[index]];
      } else if (direction === 'down' && index < questions.length - 1) {
        [questions[index], questions[index + 1]] = [questions[index + 1], questions[index]];
      }
      renderQuestions();
    }

    function updateQuestion(id, field, value) {
      const q = questions.find(q => q.id === id);
      if (q) q[field] = value;
    }

    function addOption(id) {
      const q = questions.find(q => q.id === id);
      if (q && q.options) {
        q.options.push('Option ' + (q.options.length + 1));
        renderQuestions();
      }
    }

    function removeOption(id, index) {
      const q = questions.find(q => q.id === id);
      if (q && q.options && q.options.length > 1) {
        q.options.splice(index, 1);
        renderQuestions();
      }
    }

    function updateOption(id, index, value) {
      const q = questions.find(q => q.id === id);
      if (q && q.options) {
        q.options[index] = value;
      }
    }

    function renderQuestions() {
      const container = document.getElementById('questionsList');
      
      if (questions.length === 0) {
        container.innerHTML = '<p class="empty-state">No questions yet. Click a button above to add one.</p>';
        return;
      }

      container.innerHTML = questions.map((q, idx) => \`
        <div class="question-card" data-id="\${q.id}">
          <div class="question-header">
            <span class="question-number">\${idx + 1}</span>
            <span class="question-type-label">\${getTypeLabel(q.type)}</span>
            <div class="question-controls">
              <button onclick="moveQuestion('\${q.id}', 'up')" \${idx === 0 ? 'disabled' : ''}>↑</button>
              <button onclick="moveQuestion('\${q.id}', 'down')" \${idx === questions.length - 1 ? 'disabled' : ''}>↓</button>
              <button onclick="removeQuestion('\${q.id}')" class="delete-btn">🗑️</button>
            </div>
          </div>

          <div class="question-fields">
            <input type="text" 
                   placeholder="Question text *" 
                   value="\${q.question}"
                   onchange="updateQuestion('\${q.id}', 'question', this.value)"
                   class="question-input">

            <input type="text" 
                   placeholder="Description (optional)" 
                   value="\${q.description || ''}"
                   onchange="updateQuestion('\${q.id}', 'description', this.value)"
                   class="description-input">

            <label class="checkbox-label">
              <input type="checkbox" 
                     \${q.required ? 'checked' : ''}
                     onchange="updateQuestion('\${q.id}', 'required', this.checked)">
              Required
            </label>

            \${renderQuestionSettings(q)}
          </div>
        </div>
      \`).join('');
    }

    function getTypeLabel(type) {
      const labels = {
        short_text: '📝 Short Text',
        long_text: '📄 Long Text',
        number: '🔢 Number',
        dropdown: '📋 Dropdown',
        checkboxes: '☑️ Checkboxes',
        linear_scale: '📊 Linear Scale',
        ranking: '🔝 Ranking',
        file_upload: '📎 File Upload'
      };
      return labels[type] || type;
    }

    function renderQuestionSettings(q) {
      if (q.type === 'dropdown' || q.type === 'checkboxes' || q.type === 'ranking') {
        return \`
          <div class="options-editor">
            <strong>Options:</strong>
            \${q.options.map((opt, idx) => \`
              <div class="option-row">
                <input type="text" 
                       value="\${opt}"
                       onchange="updateOption('\${q.id}', \${idx}, this.value)"
                       placeholder="Option \${idx + 1}">
                <button onclick="removeOption('\${q.id}', \${idx})" \${q.options.length <= 1 ? 'disabled' : ''}>✕</button>
              </div>
            \`).join('')}
            <button onclick="addOption('\${q.id}')" class="add-option-btn">+ Add Option</button>
          </div>
        \`;
      }

      if (q.type === 'linear_scale') {
        return \`
          <div class="scale-settings">
            <label>
              Min: <input type="number" value="\${q.min}" min="0" max="10" 
                          onchange="updateQuestion('\${q.id}', 'min', parseInt(this.value))">
            </label>
            <label>
              Max: <input type="number" value="\${q.max}" min="1" max="10"
                          onchange="updateQuestion('\${q.id}', 'max', parseInt(this.value))">
            </label>
          </div>
        \`;
      }

      if (q.type === 'short_text' || q.type === 'long_text') {
        return \`
          <div class="text-settings">
            <label>
              Max Length: <input type="number" value="\${q.maxLength}" min="1" max="5000"
                                 onchange="updateQuestion('\${q.id}', 'maxLength', parseInt(this.value))">
            </label>
          </div>
        \`;
      }

      return '';
    }

    async function saveForm() {
      const name = document.getElementById('formName').value.trim();
      const description = document.getElementById('formDescription').value.trim();

      if (!name) {
        alert('Please enter a form name');
        return;
      }

      if (questions.length === 0) {
        alert('Please add at least one question');
        return;
      }

      // Validate questions
      for (let q of questions) {
        if (!q.question.trim()) {
          alert('All questions must have text');
          return;
        }
      }

      try {
        const res = await fetch('/applications/admin/builder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            questions,
            requirements: {},
            settings: {}
          })
        });

        const data = await res.json();

        if (data.success) {
          document.getElementById('modal').style.display = 'flex';
        } else {
          alert('Error: ' + data.message);
        }
      } catch (error) {
        alert('Network error occurred');
      }
    }

    function previewForm() {
      alert('Preview feature coming soon!');
    }
  </script>
</body>
</html>
  `;
};
