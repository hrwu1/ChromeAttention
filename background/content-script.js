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

    // Show processing indicator
    this.showProcessingIndicator();

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

      // Hide processing indicator
      this.hideProcessingIndicator();

      if (response.success) {
        console.log('[Focus Assistant] Evaluation result:', response.data);
        this.hasEvaluated = true;
        this.lastEvaluationTime = Date.now();

        // Show intervention modal or subtle indicator
        if (response.data.interventionShown && response.data.goal) {
          // Show center modal for interventions
          this.showInterventionModal(response.data, response.data.goal);
        } else if (!response.data.interventionShown) {
          // Show subtle indicator if intervention wasn't shown
          this.showEvaluationIndicator(response.data);
        }
      }

    } catch (error) {
      console.error('[Focus Assistant] Evaluation failed:', error);
      this.hideProcessingIndicator();
    }
  }

  /**
   * Show processing indicator while AI is evaluating
   */
  showProcessingIndicator() {
    // Remove existing indicator
    const existing = document.getElementById('focus-assistant-processing');
    if (existing) {
      existing.remove();
    }

    // Create processing indicator
    const indicator = document.createElement('div');
    indicator.id = 'focus-assistant-processing';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 10px 14px;
      background: rgba(102, 126, 234, 0.95);
      color: white;
      border-radius: 0;
      border: 1px solid #333;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: none;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: fadeIn 0.3s ease-out;
    `;

    // Create spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 14px;
      height: 14px;
      border: 2px solid rgba(51, 51, 51, 0.3);
      border-top-color: #333;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    `;

    // Add animations
    const style = document.createElement('style');
    style.id = 'focus-assistant-processing-style';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    const text = document.createElement('span');
    text.textContent = 'Analyzing...';

    indicator.appendChild(spinner);
    indicator.appendChild(text);
    document.body.appendChild(indicator);
  }

  /**
   * Hide processing indicator
   */
  hideProcessingIndicator() {
    const indicator = document.getElementById('focus-assistant-processing');
    const style = document.getElementById('focus-assistant-processing-style');
    if (indicator) {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateY(-10px)';
      setTimeout(() => indicator.remove(), 300);
    }
    if (style) {
      style.remove();
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

  /**
   * Show center modal intervention popup - Redesigned to match sidebar theme
   */
  async showInterventionModal(evaluation, goal) {
    // Remove existing modal
    const existing = document.getElementById('focus-assistant-modal');
    if (existing) {
      existing.remove();
    }

    // Get current theme from storage
    let theme = 'default';
    try {
      const result = await chrome.storage.local.get(['theme']);
      theme = result.theme || 'default';
    } catch (error) {
      console.log('[Focus Assistant] Could not load theme, using default');
    }

    // Define theme colors
    const themeColors = {
      default: {
        bg: '#faf9f8',
        itemBg: '#ffffff',
        border: '#e1dfdd',
        borderDark: '#d1d1d6',
        heroBg: '#e3f2fd',
        textPrimary: '#323130',
        textSecondary: '#605e5c',
        textTertiary: '#8a8886',
        accent: '#0078d4',
        accentHover: '#106ebe',
        accentLight: 'rgba(0, 120, 212, 0.1)',
        warning: '#ff8c00',
        warningBg: '#fff3cd',
        warningBorder: '#ffc107'
      },
      ocean: {
        bg: '#f0f4f8',
        itemBg: '#ffffff',
        border: '#d0dae5',
        borderDark: '#b0c4de',
        heroBg: '#e0f2fe',
        textPrimary: '#1e293b',
        textSecondary: '#475569',
        textTertiary: '#64748b',
        accent: '#0284c7',
        accentHover: '#0369a1',
        accentLight: 'rgba(2, 132, 199, 0.1)',
        warning: '#0891b2',
        warningBg: '#cffafe',
        warningBorder: '#06b6d4'
      },
      forest: {
        bg: '#f1f5f0',
        itemBg: '#ffffff',
        border: '#d4e3d0',
        borderDark: '#a8c9a0',
        heroBg: '#dcfce7',
        textPrimary: '#1e3a1e',
        textSecondary: '#3d5a3d',
        textTertiary: '#5a7a5a',
        accent: '#16a34a',
        accentHover: '#15803d',
        accentLight: 'rgba(22, 163, 74, 0.1)',
        warning: '#16a34a',
        warningBg: '#dcfce7',
        warningBorder: '#22c55e'
      },
      sunset: {
        bg: '#fef3f2',
        itemBg: '#ffffff',
        border: '#fecaca',
        borderDark: '#fca5a5',
        heroBg: '#ffe4e6',
        textPrimary: '#3f1f1f',
        textSecondary: '#7c2d2d',
        textTertiary: '#a84848',
        accent: '#dc2626',
        accentHover: '#b91c1c',
        accentLight: 'rgba(220, 38, 38, 0.1)',
        warning: '#ea580c',
        warningBg: '#ffedd5',
        warningBorder: '#fb923c'
      },
      amber: {
        bg: '#fefce8',
        itemBg: '#ffffff',
        border: '#fde68a',
        borderDark: '#fcd34d',
        heroBg: '#fef3c7',
        textPrimary: '#3f2f1f',
        textSecondary: '#78350f',
        textTertiary: '#92400e',
        accent: '#d97706',
        accentHover: '#b45309',
        accentLight: 'rgba(217, 119, 6, 0.1)',
        warning: '#d97706',
        warningBg: '#fef3c7',
        warningBorder: '#f59e0b'
      }
    };

    const colors = themeColors[theme] || themeColors.default;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'focus-assistant-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: ${colors.itemBg};
      border-radius: 0px;
      border: 2px solid ${colors.borderDark};
      max-width: 520px;
      width: 90%;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      animation: slideIn 0.3s ease-out;
      overflow: hidden;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
      
      <!-- Header Section with theme-inspired gradient -->
      <div style="
        background: ${colors.heroBg};
        padding: 24px;
        border-bottom: 1px solid ${colors.border};
      ">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="
              font-size: 32px;
              line-height: 1;
            ">⚠️</div>
            <div>
              <h2 style="
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: ${colors.textPrimary};
                line-height: 1.3;
              ">Distraction Detected</h2>
              <p style="
                margin: 4px 0 0 0;
                font-size: 13px;
                color: ${colors.textSecondary};
                line-height: 1.4;
              ">This page may not align with your goal</p>
            </div>
          </div>
          <button id="focus-assistant-close-btn" style="
            width: 32px;
            height: 32px;
            padding: 0;
            border: none;
            background: rgba(0, 0, 0, 0.05);
            color: ${colors.textSecondary};
            font-size: 18px;
            cursor: pointer;
            border-radius: 0px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">✕</button>
        </div>
      </div>
      
      <!-- Content Section -->
      <div style="padding: 24px;">
        <!-- Goal Card -->
        <div style="
          background: ${colors.bg};
          border: 1px solid ${colors.border};
          border-radius: 0px;
          padding: 16px;
          margin-bottom: 16px;
        ">
          <div style="
            font-size: 11px;
            font-weight: 600;
            color: ${colors.textTertiary};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          ">Your Active Goal</div>
          <div style="
            font-size: 15px;
            color: ${colors.textPrimary};
            font-weight: 500;
            line-height: 1.5;
          ">${goal.text}</div>
        </div>
        
        <!-- Reason Card -->
        <div style="
          background: ${colors.warningBg};
          border: 1px solid ${colors.warningBorder};
          border-left: 3px solid ${colors.warning};
          border-radius: 0px;
          padding: 14px 16px;
          margin-bottom: 24px;
        ">
          <div style="
            font-size: 14px;
            color: ${colors.textPrimary};
            line-height: 1.6;
          ">
            <span style="font-weight: 600;">Reason:</span> ${evaluation.reason}
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
          <button id="focus-assistant-back-btn" style="
            flex: 1;
            padding: 12px 20px;
            background: ${colors.accent};
            color: white;
            border: none;
            border-radius: 0px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
          ">Back to Goal</button>
          <button id="focus-assistant-relevant-btn" style="
            flex: 1;
            padding: 12px 20px;
            background: ${colors.itemBg};
            color: ${colors.textPrimary};
            border: 1px solid ${colors.border};
            border-radius: 0px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
          ">It's Relevant</button>
        </div>
        
        <button id="focus-assistant-dismiss-btn" style="
          width: 100%;
          padding: 10px;
          background: transparent;
          color: ${colors.textTertiary};
          border: none;
          font-size: 13px;
          cursor: pointer;
          transition: color 0.2s;
          font-family: inherit;
        ">Dismiss</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Get button references
    const closeBtn = modal.querySelector('#focus-assistant-close-btn');
    const backBtn = modal.querySelector('#focus-assistant-back-btn');
    const relevantBtn = modal.querySelector('#focus-assistant-relevant-btn');
    const dismissBtn = modal.querySelector('#focus-assistant-dismiss-btn');

    // Add hover effects matching sidebar theme
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(0, 0, 0, 0.1)';
      closeBtn.style.color = colors.textPrimary;
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(0, 0, 0, 0.05)';
      closeBtn.style.color = colors.textSecondary;
    });

    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = colors.accentHover;
      backBtn.style.transform = 'scale(0.98)';
    });
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = colors.accent;
      backBtn.style.transform = 'scale(1)';
    });

    relevantBtn.addEventListener('mouseenter', () => {
      relevantBtn.style.background = colors.bg;
      relevantBtn.style.borderColor = colors.accent;
      relevantBtn.style.transform = 'scale(0.98)';
    });
    relevantBtn.addEventListener('mouseleave', () => {
      relevantBtn.style.background = colors.itemBg;
      relevantBtn.style.borderColor = colors.border;
      relevantBtn.style.transform = 'scale(1)';
    });

    dismissBtn.addEventListener('mouseenter', () => {
      dismissBtn.style.color = colors.textSecondary;
    });
    dismissBtn.addEventListener('mouseleave', () => {
      dismissBtn.style.color = colors.textTertiary;
    });

    // Button handlers
    const closeModal = () => {
      overlay.style.opacity = '0';
      modal.style.transform = 'translateY(-20px)';
      setTimeout(() => overlay.remove(), 200);
    };

    closeBtn.addEventListener('click', closeModal);

    backBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'NAVIGATE_TO_GOAL'
      });
      closeModal();
    });

    relevantBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'SUBMIT_FEEDBACK',
        data: {
          pageData: this.pageData,
          userLabel: 'relevant',
          systemScore: evaluation.score
        }
      });
      closeModal();
    });

    dismissBtn.addEventListener('click', closeModal);

    // Click overlay to dismiss
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // ESC key to dismiss
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
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

