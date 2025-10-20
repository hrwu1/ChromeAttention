// Content script for Chrome Focus Assistant
// Extracts page content and monitors user activity

// ============================================================================
// UTILITY FUNCTIONS (duplicated from utils.js for content script isolation)
// ============================================================================

function extractMainText(doc = document) {
  const clone = doc.cloneNode(true);
  
  const unwantedSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript'];
  unwantedSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  let text = clone.body?.innerText || '';
  text = text.replace(/\s+/g, ' ').trim();
  
  const MAX_LENGTH = 10000;
  if (text.length > MAX_LENGTH) {
    text = text.substring(0, MAX_LENGTH) + '...';
  }
  
  return text;
}

function extractPageMetadata(doc = document) {
  return {
    title: doc.title || '',
    url: doc.location?.href || '',
    domain: doc.location?.hostname || '',
    description: doc.querySelector('meta[name="description"]')?.content || '',
    timestamp: Date.now()
  };
}

function shouldExcludeUrl(url) {
  const excludedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'file:'];
  const excludedPatterns = [
    'chrome.google.com/webstore',
    'microsoftedge.microsoft.com'
  ];
  
  return excludedProtocols.some(protocol => url.startsWith(protocol)) ||
         excludedPatterns.some(pattern => url.includes(pattern));
}

// ============================================================================
// PAGE ANALYZER
// ============================================================================

class PageAnalyzer {
  constructor() {
    this.pageData = null;
    this.activityScore = 0;
    this.dwellStartTime = Date.now();
    this.evaluationTimer = null;
    this.hasEvaluated = false;
  }
  
  /**
   * Extract full page data
   */
  extractPageData() {
    const metadata = extractPageMetadata();
    const text = extractMainText();
    
    this.pageData = {
      ...metadata,
      text: text
    };
    
    return this.pageData;
  }
  
  /**
   * Monitor user activity on page
   */
  startActivityMonitoring() {
    // Track typing
    document.addEventListener('keypress', () => {
      this.activityScore++;
    });
    
    // Track mouse movement (throttled)
    let lastMouseMove = 0;
    document.addEventListener('mousemove', () => {
      const now = Date.now();
      if (now - lastMouseMove > 1000) {
        this.activityScore += 0.1;
        lastMouseMove = now;
      }
    });
    
    // Track scrolling
    let lastScroll = 0;
    document.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - lastScroll > 1000) {
        this.activityScore += 0.2;
        lastScroll = now;
      }
    });
  }
  
  /**
   * Calculate dwell time on current page
   */
  getDwellTime() {
    return Date.now() - this.dwellStartTime;
  }
  
  /**
   * Check if user is actively engaged
   */
  isActivelyEngaged() {
    return this.activityScore > 5; // Arbitrary threshold
  }
  
  /**
   * Start evaluation timer
   */
  scheduleEvaluation(delayMs = 10000) {
    if (this.evaluationTimer) {
      clearTimeout(this.evaluationTimer);
    }
    
    this.evaluationTimer = setTimeout(() => {
      this.performEvaluation();
    }, delayMs);
  }
  
  /**
   * Perform page evaluation
   */
  async performEvaluation() {
    if (this.hasEvaluated) {
      return; // Already evaluated this page
    }
    
    if (!this.pageData) {
      this.extractPageData();
    }
    
    // Check if should exclude
    if (shouldExcludeUrl(this.pageData.url)) {
      console.log('[Focus Assistant] Excluded URL, skipping evaluation');
      return;
    }
    
    // Check dwell time
    const dwellTime = this.getDwellTime();
    if (dwellTime < 5000) {
      console.log('[Focus Assistant] Not enough dwell time, skipping evaluation');
      return;
    }
    
    console.log('[Focus Assistant] Evaluating page...');
    
    try {
      // Send to background for evaluation
      const response = await chrome.runtime.sendMessage({
        type: 'EVALUATE_PAGE',
        data: {
          pageData: this.pageData,
          dwellTime: dwellTime,
          activityScore: this.activityScore
        }
      });
      
      if (response.success) {
        console.log('[Focus Assistant] Evaluation result:', response.data);
        this.hasEvaluated = true;
        
        // Show subtle indicator
        this.showEvaluationIndicator(response.data);
      }
      
    } catch (error) {
      console.error('[Focus Assistant] Evaluation failed:', error);
    }
  }
  
  /**
   * Show subtle visual indicator of evaluation result
   */
  showEvaluationIndicator(evaluation) {
    // Remove existing indicator
    const existing = document.getElementById('focus-assistant-indicator');
    if (existing) {
      existing.remove();
    }
    
    // Only show for distracting pages
    if (evaluation.label !== 'distracting') {
      return;
    }
    
    // Create minimal indicator
    const indicator = document.createElement('div');
    indicator.id = 'focus-assistant-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 12px;
      background: rgba(255, 152, 0, 0.95);
      color: white;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 999999;
      cursor: pointer;
      transition: opacity 0.3s;
    `;
    indicator.textContent = '⚠️ Possible distraction';
    
    // Click to dismiss
    indicator.addEventListener('click', () => {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    });
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 300);
      }
    }, 10000);
    
    document.body.appendChild(indicator);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Check if we should exclude this page
if (shouldExcludeUrl(window.location.href)) {
  console.log('[Focus Assistant] Page excluded from monitoring');
} else {
  // Initialize analyzer
  const analyzer = new PageAnalyzer();
  
  // Wait for page to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeAnalyzer(analyzer);
    });
  } else {
    initializeAnalyzer(analyzer);
  }
}

function initializeAnalyzer(analyzer) {
  console.log('[Focus Assistant] Content script initialized');
  
  // Extract initial page data
  analyzer.extractPageData();
  
  // Start monitoring activity
  analyzer.startActivityMonitoring();
  
  // Schedule evaluation after dwell time
  analyzer.scheduleEvaluation(10000); // 10 seconds
}

// ============================================================================
// MESSAGE LISTENER
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Focus Assistant] Received message:', message.type);
  
  if (message.type === 'START_EVALUATION') {
    // Force immediate evaluation
    const analyzer = new PageAnalyzer();
    analyzer.extractPageData();
    analyzer.performEvaluation()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'REQUEST_FEEDBACK') {
    // User clicked "It's Relevant" in notification
    const analyzer = new PageAnalyzer();
    const pageData = analyzer.extractPageData();
    
    chrome.runtime.sendMessage({
      type: 'SUBMIT_FEEDBACK',
      data: {
        pageData: pageData,
        userLabel: message.data.label,
        systemScore: 0 // We don't have the original score here
      }
    }).then(() => {
      console.log('[Focus Assistant] Feedback submitted');
      sendResponse({ success: true });
    });
    
    return true;
  }
  
  if (message.type === 'EXTRACT_PAGE_DATA') {
    // Extract and return page data
    const analyzer = new PageAnalyzer();
    const pageData = analyzer.extractPageData();
    sendResponse({ success: true, data: pageData });
    return false;
  }
});

console.log('[Focus Assistant] Content script loaded');

