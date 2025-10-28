// Content script for Chrome Focus Assistant
// Extracts page content and monitors user activity

// Store the global analyzer instance
let globalAnalyzer = null;

// ============================================================================
// CONSTANTS (duplicated from utils.js for content script isolation)
// ============================================================================

const DWELL_TIME_THRESHOLD = 5000; // 5 seconds before evaluation

// ============================================================================
// UTILITY FUNCTIONS (duplicated from utils.js for content script isolation)
// ============================================================================

function extractMainText(doc = document) {
  const clone = doc.cloneNode(true);

  // Remove unwanted elements including transient UI elements
  const unwantedSelectors = [
    'script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript',
    // Additional transient elements that change during scrolling
    '[role="banner"]',          // Header/banner roles
    '[role="navigation"]',      // Navigation roles
    '[role="complementary"]',   // Sidebar/complementary content
    '.sticky',                  // Common sticky element classes
    '.fixed',
    '.header',
    '.navbar',
    '.sidebar',
    '.advertisement',
    '.ad',
    '[class*="sticky"]',        // Any class containing "sticky"
    '[style*="position: fixed"]', // Fixed position elements
    '[style*="position: sticky"]' // Sticky position elements
  ];

  unwantedSelectors.forEach(selector => {
    try {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    } catch (e) {
      // Ignore selector errors for complex selectors
    }
  });

  // Try to focus on main content area if available
  let mainContent = clone.querySelector('main, article, [role="main"], .main-content, #content, #main');

  if (!mainContent) {
    mainContent = clone.body;
  }

  let text = mainContent?.innerText || '';

  text = text.replace(/\s+/g, ' ').trim();

  const MAX_LENGTH = 10000;
  if (text.length > MAX_LENGTH) {
    text = text.substring(0, MAX_LENGTH) + '...';
  }

  console.log('[Focus Assistant] Final text length:', text.length);
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
    this.contentHash = null;  // Store hash of content
    this.lastEvaluationTime = 0;  // Track when we last evaluated
    this.activityScore = 0;
    this.dwellStartTime = Date.now();
    this.evaluationTimer = null;
    this.hasEvaluated = false;
  }

  /**
   * Create a simple hash of text content
   */
  hashContent(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Calculate similarity between two strings (Jaccard similarity)
   */
  calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 1.0;
  }

  /**
   * Extract full page data with content change detection
   */
  extractPageData(forceExtract = false) {
    const metadata = extractPageMetadata();
    const text = extractMainText();

    // Create hash of the content
    const newHash = this.hashContent(text);

    // If we have previous data, check if content changed significantly
    if (this.pageData && !forceExtract) {
      const similarity = this.calculateSimilarity(this.pageData.text, text);

      // If content is more than 80% similar, consider it unchanged
      if (similarity > 0.8) {
        console.log('[Focus Assistant] Content unchanged (similarity:', (similarity * 100).toFixed(1) + '%), skipping re-extraction');
        return { changed: false, pageData: this.pageData };
      }

      console.log('[Focus Assistant] Content changed significantly (similarity:', (similarity * 100).toFixed(1) + '%)');
    }

    this.pageData = {
      ...metadata,
      text: text
    };

    this.contentHash = newHash;

    return { changed: true, pageData: this.pageData };
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
   * Perform page evaluation with smart change detection
   */
  async performEvaluation(skipDwellCheck = false) {
    // Debouncing: Don't evaluate too frequently (minimum 5 seconds between evaluations)
    const timeSinceLastEval = Date.now() - this.lastEvaluationTime;
    if (timeSinceLastEval < 5000 && !skipDwellCheck) {
      console.log('[Focus Assistant] Debouncing: Too soon since last evaluation (', timeSinceLastEval, 'ms)');
      return;
    }

    // Extract page data and check if content changed
    const extractResult = this.extractPageData();

    // If content hasn't changed significantly, skip re-evaluation
    if (!extractResult.changed && this.hasEvaluated) {
      console.log('[Focus Assistant] Content unchanged, skipping re-evaluation');
      return;
    }

    const pageData = extractResult.pageData;

    // Check if should exclude
    if (shouldExcludeUrl(pageData.url)) {
      console.log('[Focus Assistant] Excluded URL, skipping evaluation');
      return;
    }

    // Check dwell time (skip if triggered manually)
    const dwellTime = this.getDwellTime();
    if (!skipDwellCheck && dwellTime < DWELL_TIME_THRESHOLD) {
      console.log('[Focus Assistant] Not enough dwell time, skipping evaluation');
      return;
    }

    console.log('[Focus Assistant] Evaluating page...', { url: pageData.url, dwellTime, contentChanged: extractResult.changed });

    try {
      // Send to background for evaluation
      const response = await chrome.runtime.sendMessage({
        type: 'EVALUATE_PAGE',
        data: {
          pageData: pageData,
          dwellTime: dwellTime,
          activityScore: this.activityScore
        }
      });

      if (response.success) {
        console.log('[Focus Assistant] Evaluation result:', response.data);
        this.hasEvaluated = true;
        this.lastEvaluationTime = Date.now();

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

  // Store as global analyzer
  globalAnalyzer = analyzer;

  // Extract initial page data (force on first load)
  analyzer.extractPageData(true);

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

  if (message.type === 'PING') {
    // Respond to ping to confirm content script is loaded
    sendResponse({ success: true, loaded: true });
    return false;
  }

  if (message.type === 'START_EVALUATION') {
    // Use the global analyzer if available, or create a new one
    if (!globalAnalyzer) {
      globalAnalyzer = new PageAnalyzer();
      globalAnalyzer.extractPageData(true); // Force extract on first load
      globalAnalyzer.startActivityMonitoring();
    } else {
      // For existing analyzer on new page, reset dwell time
      globalAnalyzer.dwellStartTime = Date.now();
    }

    // Reset evaluation flag
    globalAnalyzer.hasEvaluated = false;

    // Force extract page data for new page load
    globalAnalyzer.extractPageData(true);

    // Schedule evaluation after dwell threshold instead of evaluating immediately
    // This ensures we respect the 5-second minimum dwell time
    globalAnalyzer.scheduleEvaluation(DWELL_TIME_THRESHOLD);

    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'REQUEST_FEEDBACK') {
    // User clicked "It's Relevant" in notification
    const analyzer = globalAnalyzer || new PageAnalyzer();
    const extractResult = analyzer.extractPageData(true);
    const pageData = extractResult.pageData || extractResult;

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
    const analyzer = globalAnalyzer || new PageAnalyzer();
    const extractResult = analyzer.extractPageData(true);
    const pageData = extractResult.pageData || extractResult;
    console.log('[Focus Assistant] Extracted page data:', {
      title: pageData.title,
      textLength: pageData.text?.length || 0,
      textPreview: pageData.text?.substring(0, 100) || '(empty)'
    });
    sendResponse({ success: true, data: pageData });
    return false;
  }
});

console.log('[Focus Assistant] Content script loaded');

