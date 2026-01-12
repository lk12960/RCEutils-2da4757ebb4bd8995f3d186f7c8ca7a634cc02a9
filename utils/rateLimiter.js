// Rate Limiter for Applications
const rateLimitStore = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limit middleware
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Time window in milliseconds
 */
function rateLimit(maxRequests = 10, windowMs = 60000) {
  return (req, res, next) => {
    const identifier = req.session?.user?.id || req.ip;
    const key = `${req.path}:${identifier}`;
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    if (!record || record.resetTime < now) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, record);
    }
    
    record.count++;
    
    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }
    
    next();
  };
}

/**
 * Specific rate limiter for application submissions
 */
function applicationSubmitLimit(req, res, next) {
  const userId = req.session?.user?.id;
  if (!userId) return next();
  
  const key = `submit:${userId}`;
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000; // 24 hours
  
  let record = rateLimitStore.get(key);
  
  if (!record || record.resetTime < now) {
    record = {
      count: 0,
      resetTime: now + windowMs
    };
    rateLimitStore.set(key, record);
  }
  
  // Allow only 3 submissions per 24 hours
  if (record.count >= 3) {
    return res.status(429).json({
      success: false,
      message: 'Submission limit reached. You can submit up to 3 applications per day.',
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    });
  }
  
  record.count++;
  next();
}

module.exports = {
  rateLimit,
  applicationSubmitLimit
};
