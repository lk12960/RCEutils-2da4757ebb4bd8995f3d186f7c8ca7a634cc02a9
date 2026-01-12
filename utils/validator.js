// Input Validation and Sanitization

/**
 * Validate and sanitize form data
 */
function validateFormData(formData) {
  const errors = [];
  
  if (!formData.name || typeof formData.name !== 'string') {
    errors.push('Form name is required');
  } else if (formData.name.length > 200) {
    errors.push('Form name is too long');
  }
  
  if (formData.description && formData.description.length > 2000) {
    errors.push('Description is too long');
  }
  
  if (!Array.isArray(formData.questions) || formData.questions.length === 0) {
    errors.push('At least one question is required');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate question data
 */
function validateQuestion(question) {
  const validTypes = ['short_text', 'long_text', 'number', 'dropdown', 'checkboxes', 'linear_scale', 'ranking', 'file_upload'];
  
  if (!question.question || typeof question.question !== 'string') {
    return false;
  }
  
  if (!validTypes.includes(question.type)) {
    return false;
  }
  
  if (['dropdown', 'checkboxes', 'ranking'].includes(question.type)) {
    if (!Array.isArray(question.options) || question.options.length === 0) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validate submission responses
 */
function validateResponses(questions, responses) {
  const errors = [];
  
  questions.forEach(q => {
    const response = responses[q.id];
    
    // Check required fields
    if (q.required && (!response || (Array.isArray(response) && response.length === 0))) {
      errors.push(`${q.question} is required`);
      return;
    }
    
    // Skip validation if not required and empty
    if (!response && !q.required) return;
    
    // Type-specific validation
    switch (q.type) {
      case 'short_text':
        if (typeof response !== 'string') {
          errors.push(`${q.question} must be text`);
        } else if (response.length > (q.maxLength || 200)) {
          errors.push(`${q.question} is too long`);
        }
        break;
        
      case 'long_text':
        if (typeof response !== 'string') {
          errors.push(`${q.question} must be text`);
        } else if (response.length > (q.maxLength || 2000)) {
          errors.push(`${q.question} is too long`);
        }
        break;
        
      case 'number':
        const num = Number(response);
        if (isNaN(num)) {
          errors.push(`${q.question} must be a number`);
        } else {
          if (q.min !== undefined && num < q.min) {
            errors.push(`${q.question} must be at least ${q.min}`);
          }
          if (q.max !== undefined && num > q.max) {
            errors.push(`${q.question} must be at most ${q.max}`);
          }
        }
        break;
        
      case 'dropdown':
        if (!q.options.includes(response)) {
          errors.push(`${q.question} has an invalid selection`);
        }
        break;
        
      case 'checkboxes':
        if (!Array.isArray(response)) {
          errors.push(`${q.question} must have at least one selection`);
        } else {
          const invalidOptions = response.filter(r => !q.options.includes(r));
          if (invalidOptions.length > 0) {
            errors.push(`${q.question} has invalid selections`);
          }
        }
        break;
        
      case 'linear_scale':
        const scale = Number(response);
        if (isNaN(scale) || scale < (q.min || 1) || scale > (q.max || 5)) {
          errors.push(`${q.question} must be between ${q.min || 1} and ${q.max || 5}`);
        }
        break;
    }
  });
  
  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize text input
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  
  // Remove potential XSS vectors
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .trim();
}

/**
 * Sanitize all responses
 */
function sanitizeResponses(responses) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(responses)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(v => typeof v === 'string' ? sanitizeText(v) : v);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

module.exports = {
  validateFormData,
  validateQuestion,
  validateResponses,
  sanitizeText,
  sanitizeResponses
};
