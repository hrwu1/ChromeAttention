// Shared utilities, constants, and logger for Chrome Focus Assistant

// ============================================================================
// CONSTANTS
// ============================================================================

export const CONSTANTS = {
  // Detection thresholds
  RELEVANCE_THRESHOLD: 0.6,        // Score below this = distraction
  DWELL_TIME_THRESHOLD: 10000,     // 10 seconds before evaluation
  ACTIVITY_CHECK_INTERVAL: 5000,   // Check user activity every 5s
  
  // Learning parameters
  MAX_FEEDBACK_SAMPLES: 100,       // Max few-shot examples to keep
  LEARNING_RATE: 0.05,             // Threshold adjustment rate
  
  // Intervention settings
  NOTIFICATION_COOLDOWN: 300000,   // 5 minutes between notifications
  BLOCK_DURATION: 1800000,         // 30 minutes default block duration
  
  // Session settings
  SESSION_TIMEOUT: 3600000,        // 1 hour of inactivity ends session
  REVIEW_MIN_DURATION: 600000,     // 10 minutes minimum for review
  
  // Storage keys
  STORAGE_KEYS: {
    CURRENT_GOAL: 'currentGoal',     // Legacy - kept for backward compatibility
    GOALS_LIST: 'goalsList',         // Array of all goals
    USER_PROFILE: 'userProfile',
    FEEDBACK_HISTORY: 'feedbackHistory',
    SESSION_DATA: 'sessionData',
    WHITELIST: 'whitelist',
    BLACKLIST: 'blacklist',
    SETTINGS: 'settings'
  },
  
  // AI Model settings
  AI_CONFIG: {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 1000,
    SUMMARY_TYPE: 'key-points',
    SUMMARY_LENGTH: 'medium'
  }
};

// ============================================================================
// LOGGER
// ============================================================================

export class Logger {
  static LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };
  
  static currentLevel = Logger.LOG_LEVELS.DEBUG;
  
  static setLevel(level) {
    this.currentLevel = level;
  }
  
  static debug(message, data = null) {
    if (this.currentLevel <= this.LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }
  
  static info(message, data = null) {
    if (this.currentLevel <= this.LOG_LEVELS.INFO) {
      console.info(`[INFO] ${message}`, data || '');
    }
  }
  
  static warn(message, data = null) {
    if (this.currentLevel <= this.LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  }
  
  static error(message, error = null) {
    if (this.currentLevel <= this.LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${message}`, error || '');
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extracts main text content from HTML, removing scripts, styles, etc.
 */
export function extractMainText(doc = document) {
  // Clone to avoid modifying actual DOM
  const clone = doc.cloneNode(true);
  
  // Remove unwanted elements
  const unwantedSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript'];
  unwantedSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  // Get text content
  let text = clone.body?.innerText || '';
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Limit length (Chrome AI has token limits)
  const MAX_LENGTH = 10000;
  if (text.length > MAX_LENGTH) {
    text = text.substring(0, MAX_LENGTH) + '...';
  }
  
  return text;
}

/**
 * Extracts page metadata
 */
export function extractPageMetadata(doc = document) {
  return {
    title: doc.title || '',
    url: doc.location?.href || '',
    domain: doc.location?.hostname || '',
    description: doc.querySelector('meta[name="description"]')?.content || '',
    timestamp: Date.now()
  };
}

/**
 * Calculates similarity score between two strings (simple word overlap)
 */
export function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.toLowerCase().match(/\b\w+\b/g) || []);
  const words2 = new Set(str2.toLowerCase().match(/\b\w+\b/g) || []);
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Debounce function to limit rate of function calls
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Check if URL should be excluded from analysis
 */
export function shouldExcludeUrl(url) {
  const excludedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'file:'];
  const excludedPatterns = [
    'chrome.google.com/webstore',
    'microsoftedge.microsoft.com'
  ];
  
  return excludedProtocols.some(protocol => url.startsWith(protocol)) ||
         excludedPatterns.some(pattern => url.includes(pattern));
}

/**
 * Generate unique ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Safely parse JSON with fallback
 */
export function safeParseJSON(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    Logger.warn('Failed to parse JSON', e);
    return fallback;
  }
}

/**
 * Wait for specified milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

