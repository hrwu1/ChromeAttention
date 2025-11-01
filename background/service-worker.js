// Background service worker for Chrome Focus Assistant
// Includes AI Manager and message routing

import { Logger, CONSTANTS, shouldExcludeUrl, getBaseUrl } from './utils.js';
import { storage } from './storage.js';
import { GoalManager, DetectionEngine, LearningEngine, InterventionManager, ReviewGenerator } from './modules.js';

// ============================================================================
// AI MANAGER CLASS
// ============================================================================

class AIManager {
  constructor() {
    this.capabilities = {
      languageModel: false,
      summarizer: false,
      writer: false,
      rewriter: false
    };

    this.sessions = {
      languageModel: null,
      summarizer: null,
      writer: null,
      rewriter: null
    };
  }

  /**
   * Check availability of all Chrome AI APIs
   */
  async checkAvailability() {
    Logger.info('Checking Chrome AI API availability...');

    try {
      // The AI APIs might be available as direct global classes, not under a namespace!
      // User confirmed: LanguageModel.availability() works directly
      Logger.debug('Checking AI API classes...', {
        'typeof LanguageModel': typeof LanguageModel,
        'typeof Summarizer': typeof Summarizer,
        'typeof Writer': typeof Writer,
        'typeof Rewriter': typeof Rewriter,
        'typeof self.ai': typeof self.ai,
        'typeof globalThis.ai': typeof globalThis.ai
      });

      // Check if APIs are available as direct globals (no namespace needed)
      const hasDirectAPIs = typeof LanguageModel !== 'undefined';

      if (hasDirectAPIs) {
        Logger.info('✅ AI APIs found as direct global classes (LanguageModel, etc.)');
        this.useDirectAPI = true;
      } else {
        // Fallback: Try to find namespace-based access
        let aiNamespace = null;
        if (typeof self.ai !== 'undefined') {
          aiNamespace = self.ai;
          Logger.info('Found AI namespace at: self.ai');
        } else if (typeof globalThis.ai !== 'undefined') {
          aiNamespace = globalThis.ai;
          Logger.info('Found AI namespace at: globalThis.ai');
        }

        if (aiNamespace) {
          this.aiNamespace = aiNamespace;
          this.useDirectAPI = false;
        } else {
          Logger.warn('Chrome AI not available - APIs not found');
          Logger.warn('Checked: LanguageModel (direct), self.ai, globalThis.ai (all undefined)');
          Logger.info('To enable: Visit chrome://flags and enable "Prompt API for Gemini Nano"');
          Logger.info('Then restart Chrome completely (close all windows)');
          return false;
        }
      }

      // Check Language Model (Prompt API for Gemini Nano)
      const hasLanguageModel = this.useDirectAPI ?
        (typeof LanguageModel !== 'undefined') :
        (this.aiNamespace && this.aiNamespace.languageModel);

      if (hasLanguageModel) {
        try {
          // Access API directly or via namespace
          const api = this.useDirectAPI ? LanguageModel : this.aiNamespace.languageModel;

          // Use availability() for direct API, capabilities() for namespace API
          const availability = this.useDirectAPI ?
            await api.availability() :
            await api.capabilities();

          // Direct API returns string: 'readily', 'after-download', 'no'
          // Namespace API returns object: { available: 'readily' }
          let status = availability;
          if (typeof availability === 'object' && availability.available) {
            status = availability.available;
          }

          // Mark as available if it's ready or will download
          // Direct API returns: 'available', 'no'
          // Namespace API returns: 'readily', 'after-download', 'no'
          this.capabilities.languageModel = (status === 'readily' || status === 'after-download' || status === 'available');

          if (status === 'available' || status === 'readily') {
            Logger.info('Language Model: Ready to use');
          } else if (status === 'after-download') {
            Logger.info('Language Model: Model will download on first use');
          } else {
            Logger.warn('Language Model: Not available -', status);
            Logger.warn('Check hardware requirements: 22GB free space, 4GB+ VRAM');
          }

          Logger.info('Language Model status:', status);
        } catch (e) {
          Logger.warn('Language Model check failed:', e.message);
          this.capabilities.languageModel = false;
        }
      } else {
        Logger.warn('Language Model API not found');
        this.capabilities.languageModel = false;
      }

      // Check Summarizer
      const hasSummarizer = this.useDirectAPI ?
        (typeof Summarizer !== 'undefined') :
        (this.aiNamespace && this.aiNamespace.summarizer);

      if (hasSummarizer) {
        try {
          const api = this.useDirectAPI ? Summarizer : this.aiNamespace.summarizer;

          // Use availability() for direct API, capabilities() for namespace API
          const availability = this.useDirectAPI ?
            await api.availability() :
            await api.capabilities();

          let status = availability;
          if (typeof availability === 'object' && availability.available) {
            status = availability.available;
          }

          this.capabilities.summarizer = (status === 'readily' || status === 'after-download' || status === 'available');

          if (status === 'no') {
            Logger.warn('Summarizer: Not available - check hardware requirements');
          }
          Logger.info('Summarizer status:', status);
        } catch (e) {
          Logger.warn('Summarizer check failed:', e.message);
          this.capabilities.summarizer = false;
        }
      } else {
        Logger.warn('Summarizer API not found');
        this.capabilities.summarizer = false;
      }

      // Check Writer
      const hasWriter = this.useDirectAPI ?
        (typeof Writer !== 'undefined') :
        (this.aiNamespace && this.aiNamespace.writer);

      Logger.debug('Checking Writer API:', {
        useDirectAPI: this.useDirectAPI,
        typeofWriter: typeof Writer,
        hasNamespaceWriter: !!(this.aiNamespace && this.aiNamespace.writer),
        hasWriter: hasWriter
      });

      if (hasWriter) {
        try {
          const api = this.useDirectAPI ? Writer : this.aiNamespace.writer;

          Logger.debug('Calling Writer API availability/capabilities...');

          // Use availability() for direct API, capabilities() for namespace API
          const availability = this.useDirectAPI ?
            await api.availability() :
            await api.capabilities();

          Logger.debug('Writer availability response:', {
            raw: availability,
            type: typeof availability
          });

          let status = availability;
          if (typeof availability === 'object' && availability.available) {
            status = availability.available;
          }

          this.capabilities.writer = (status === 'readily' || status === 'after-download' || status === 'available');
          Logger.info('Writer status:', status, '(capability:', this.capabilities.writer + ')');
        } catch (e) {
          Logger.warn('Writer check failed:', e.message);
          this.capabilities.writer = false;
        }
      } else {
        Logger.warn('Writer API not found. Available APIs:', {
          directAPIs: { Writer: typeof Writer },
          namespaceAPIs: this.aiNamespace ? Object.keys(this.aiNamespace) : 'no namespace'
        });
        this.capabilities.writer = false;
      }

      // Check Rewriter  
      const hasRewriter = this.useDirectAPI ?
        (typeof Rewriter !== 'undefined') :
        (this.aiNamespace && this.aiNamespace.rewriter);

      if (hasRewriter) {
        try {
          const api = this.useDirectAPI ? Rewriter : this.aiNamespace.rewriter;

          // Use availability() for direct API, capabilities() for namespace API
          const availability = this.useDirectAPI ?
            await api.availability() :
            await api.capabilities();

          let status = availability;
          if (typeof availability === 'object' && availability.available) {
            status = availability.available;
          }

          this.capabilities.rewriter = (status === 'readily' || status === 'after-download' || status === 'available');
          Logger.info('Rewriter status:', status);
        } catch (e) {
          Logger.warn('Rewriter check failed:', e.message);
          this.capabilities.rewriter = false;
        }
      } else {
        Logger.warn('Rewriter API not found');
        this.capabilities.rewriter = false;
      }

      const anyAvailable = Object.values(this.capabilities).some(v => v);
      Logger.info('AI APIs summary:', this.capabilities);

      if (!anyAvailable) {
        Logger.warn('No AI APIs available. Please ensure Chrome flags are enabled:');
        Logger.warn('1. chrome://flags/#prompt-api-for-gemini-nano -> Enabled');
        Logger.warn('2. chrome://flags/#optimization-guide-on-device-model -> Enabled BypassPerfRequirement');
        Logger.warn('3. After enabling, check chrome://components/ and update "Optimization Guide On Device Model"');
      }

      return anyAvailable;

    } catch (error) {
      Logger.error('Error checking AI availability', error);
      return false;
    }
  }

  /**
   * Check if AI is available
   * Returns true if at least the language model is available
   * (Other APIs are optional enhancements)
   */
  isAvailable() {
    return this.capabilities.languageModel || this.capabilities.summarizer;
  }

  /**
   * Create or get language model session
   */
  async getLanguageModelSession(systemPrompt = null) {
    try {
      if (!this.capabilities.languageModel) {
        throw new Error('Language Model not available. Please enable Chrome AI in chrome://flags');
      }

      // Create new session if needed
      if (!this.sessions.languageModel || systemPrompt) {
        const options = {
          temperature: CONSTANTS.AI_CONFIG.TEMPERATURE,
          topK: 3
        };

        if (systemPrompt) {
          options.systemPrompt = systemPrompt;
        }

        try {
          const api = this.useDirectAPI ? LanguageModel : this.aiNamespace.languageModel;
          this.sessions.languageModel = await api.create(options);
          Logger.debug('Created language model session with options:', options);
        } catch (createError) {
          Logger.error('Failed to create session, trying without options', createError);
          // Try with minimal options
          const api = this.useDirectAPI ? LanguageModel : this.aiNamespace.languageModel;
          this.sessions.languageModel = await api.create();
        }
      }

      return this.sessions.languageModel;

    } catch (error) {
      Logger.error('Failed to create language model session', error);
      Logger.info('Make sure Gemini Nano is downloaded: Check chrome://components/ -> Optimization Guide On Device Model');
      throw error;
    }
  }

  /**
   * Prompt API wrapper
   */
  async prompt(text, systemPrompt = null) {
    try {
      const session = await this.getLanguageModelSession(systemPrompt);
      const response = await session.prompt(text);
      Logger.debug('Prompt response received', response.substring(0, 100));
      return response;
    } catch (error) {
      Logger.error('Prompt API error', error);
      throw error;
    }
  }

  /**
   * Summarizer API wrapper
   */
  async summarize(text, options = {}) {
    try {
      if (!this.capabilities.summarizer) {
        throw new Error('Summarizer not available');
      }

      Logger.debug('Summarizer input', {
        textLength: text.length,
        textPreview: text.substring(0, 200) + '...'
      });

      // Create summarizer with options
      const summarizerOptions = {
        type: options.type || CONSTANTS.AI_CONFIG.SUMMARY_TYPE,
        length: options.length || CONSTANTS.AI_CONFIG.SUMMARY_LENGTH,
        sharedContext: options.context || ''
      };

      Logger.debug('Summarizer options', summarizerOptions);

      const api = this.useDirectAPI ? Summarizer : this.aiNamespace.summarizer;
      const summarizer = await api.create(summarizerOptions);

      Logger.debug('Summarizer created, calling summarize()...');
      const summary = await summarizer.summarize(text);

      Logger.debug('Summary generated', {
        length: summary.length,
        preview: summary.substring(0, 100),
        full: summary
      });
      return summary;

    } catch (error) {
      Logger.error('Summarizer API error', error);
      throw error;
    }
  }

  /**
   * Writer API wrapper
   */
  async write(prompt, options = {}) {
    try {
      if (!this.capabilities.writer) {
        throw new Error('Writer not available');
      }

      const writerOptions = {
        tone: options.tone || 'neutral',
        length: options.length || 'short',
        format: options.format || 'plain-text',
        sharedContext: options.context || ''
      };

      const api = this.useDirectAPI ? Writer : this.aiNamespace.writer;
      const writer = await api.create(writerOptions);
      const result = await writer.write(prompt);

      Logger.debug('Writer result', result.substring(0, 100));
      return result;

    } catch (error) {
      Logger.error('Writer API error', error);
      throw error;
    }
  }

  /**
   * Rewriter API wrapper
   */
  async rewrite(text, options = {}) {
    try {
      if (!this.capabilities.rewriter) {
        throw new Error('Rewriter not available');
      }

      const rewriterOptions = {
        tone: options.tone || 'as-is',
        length: options.length || 'as-is',
        format: options.format || 'as-is',
        sharedContext: options.context || ''
      };

      const api = this.useDirectAPI ? Rewriter : this.aiNamespace.rewriter;
      const rewriter = await api.create(rewriterOptions);
      const result = await rewriter.rewrite(text);

      Logger.debug('Rewriter result', result.substring(0, 100));
      return result;

    } catch (error) {
      Logger.error('Rewriter API error', error);
      throw error;
    }
  }

  /**
   * Cleanup sessions
   */
  async cleanup() {
    try {
      if (this.sessions.languageModel) {
        await this.sessions.languageModel.destroy();
        this.sessions.languageModel = null;
      }
      Logger.info('AI sessions cleaned up');
    } catch (error) {
      Logger.error('Error cleaning up AI sessions', error);
    }
  }
}

// ============================================================================
// SERVICE WORKER INITIALIZATION
// ============================================================================

// Initialize managers
const aiManager = new AIManager();
const goalManager = new GoalManager(aiManager);
const detectionEngine = new DetectionEngine(aiManager);
const learningEngine = new LearningEngine(aiManager);
const interventionManager = new InterventionManager();
const reviewGenerator = new ReviewGenerator(aiManager);

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  Logger.info('Extension installed/updated', details.reason);

  // Initialize storage
  await storage.initialize();

  // Check AI availability
  await aiManager.checkAvailability();

  Logger.info('Service worker initialized');
});

// Open sidebar when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  // Open the side panel for the current window
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// Check AI availability on startup
chrome.runtime.onStartup.addListener(async () => {
  Logger.info('Browser started, checking AI availability');
  await aiManager.checkAvailability();
});

// ============================================================================
// MESSAGE ROUTING
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  Logger.debug('Received message', { type: message.type, from: sender.tab?.id });

  // Handle async messages
  handleMessage(message, sender)
    .then(response => sendResponse({ success: true, data: response }))
    .catch(error => {
      Logger.error('Message handler error', error);
      sendResponse({ success: false, error: error.message });
    });

  // Return true to indicate async response
  return true;
});

async function handleMessage(message, sender) {
  const { type, data } = message;

  switch (type) {
    // AI Status
    case 'CHECK_AI_STATUS':
      // Re-check AI availability to ensure we have the latest status
      await aiManager.checkAvailability();
      return {
        available: aiManager.isAvailable(),
        capabilities: aiManager.capabilities
      };

    // Goal Management
    case 'EXTRACT_GOAL':
      return await goalManager.extractGoalFromPage(data.pageData, data.setAsActive !== false);

    case 'GET_CURRENT_GOAL':
      return await goalManager.getCurrentGoal();

    case 'GET_ALL_GOALS':
      return await goalManager.getAllGoals();

    case 'GET_ACTIVE_GOALS':
      return await goalManager.getActiveGoals();

    case 'ADD_GOAL':
      return await storage.addGoal(data.goalData);

    case 'UPDATE_GOAL':
      // Support both old and new format
      if (data.goalId) {
        return await goalManager.updateGoal(data.goalId, data.updates);
      } else {
        // Legacy support: update first active goal
        const currentGoal = await goalManager.getCurrentGoal();
        if (currentGoal) {
          return await goalManager.updateGoal(currentGoal.id, {
            text: data.text,
            keywords: data.keywords
          });
        }
        return null;
      }

    case 'DELETE_GOAL':
      return await goalManager.deleteGoal(data.goalId);

    case 'MARK_GOAL_DONE':
      return await goalManager.markGoalDone(data.goalId);

    case 'TOGGLE_GOAL_ACTIVE':
      return await goalManager.toggleGoalActive(data.goalId);

    case 'CLEAR_GOAL':
      // Check if there's an active session and end it first
      const currentActiveSession = await storage.getCurrentSession();
      if (currentActiveSession) {
        Logger.info('Auto-ending session because goal was cleared');
        await storage.endSession(null); // End without review
      }
      return await goalManager.clearGoal();

    // Detection
    case 'EVALUATE_PAGE':
      // Only evaluate if there's an active session
      const session = await storage.getCurrentSession();
      if (!session) {
        return { score: 1.0, label: 'no-session', reason: 'No active session', matchedGoals: [], interventionShown: false };
      }

      // Evaluate against all active goals
      const activeGoals = await goalManager.getActiveGoals();
      if (activeGoals.length === 0) {
        return { score: 1.0, label: 'no-goal', reason: 'No active goals', matchedGoals: [], interventionShown: false };
      }

      const evaluation = await detectionEngine.evaluatePage(data.pageData, activeGoals);
      Logger.info('[EVALUATE_PAGE] Evaluation complete', {
        url: data.pageData.url,
        label: evaluation.label,
        score: evaluation.score,
        reason: evaluation.reason
      });

      // Check if intervention needed
      let interventionShown = false;
      let goalForIntervention = null;
      if (await interventionManager.shouldIntervene(evaluation, data.pageData)) {
        Logger.info('[EVALUATE_PAGE] Intervention check passed, will show modal');
        // Use the first active goal for intervention context
        goalForIntervention = activeGoals[0];
        interventionShown = true;
        
        // Update intervention count
        await storage.updateSession({
          interventions: (session.interventions || 0) + 1
        });
        
        Logger.info('[EVALUATE_PAGE] Intervention will be shown in content script');
      } else {
        Logger.info('[EVALUATE_PAGE] Intervention check failed, no modal shown');
      }

      // Update session
      if (session) {
        const pages = session.pagesVisited || [];

        // Use base URL for grouping (without query params/fragments)
        const baseUrl = getBaseUrl(data.pageData.url);

        // Check if this base URL already exists
        const existingPageIndex = pages.findIndex(p => p.baseUrl === baseUrl);

        if (existingPageIndex >= 0) {
          // Update relevance score if it changed significantly
          const existingPage = pages[existingPageIndex];
          if (Math.abs(existingPage.relevanceScore - evaluation.score) > 0.1) {
            existingPage.relevanceScore = evaluation.score;
            existingPage.lastEvaluationTime = Date.now();
          }
          // Update with latest full URL and title
          existingPage.url = data.pageData.url;
          existingPage.title = data.pageData.title;
        } else {
          // Add new page entry
          pages.push({
            url: data.pageData.url,
            baseUrl: baseUrl,
            title: data.pageData.title,
            domain: data.pageData.domain,
            relevanceScore: evaluation.score,
            timestamp: Date.now(),
            lastEvaluationTime: Date.now(),
            dwellTime: 0,
            visitCount: 1,
            lastVisitTime: Date.now()
          });
        }

        await storage.updateSession({
          pagesVisited: pages,
          distractions: evaluation.label === 'distracting' ?
            (session.distractions || 0) + 1 : session.distractions
        });
      }

      return { ...evaluation, interventionShown, goal: goalForIntervention };

    // Learning
    case 'SUBMIT_FEEDBACK':
      const currentGoal = await goalManager.getCurrentGoal();
      await learningEngine.learnFromFeedback(
        data.pageData,
        currentGoal?.id,
        data.userLabel,
        data.systemScore
      );

      // Update session
      const feedbackSession = await storage.getCurrentSession();
      if (feedbackSession) {
        await storage.updateSession({
          feedbackGiven: (feedbackSession.feedbackGiven || 0) + 1
        });
      }

      return { success: true };

    // Session Management
    case 'START_SESSION':
      const sessionActiveGoals = await goalManager.getActiveGoals();
      if (sessionActiveGoals.length === 0) {
        throw new Error('No active goals. Please set and activate at least one goal first.');
      }
      // Use first active goal ID for session (can be enhanced later for multi-goal sessions)
      return await storage.startSession(sessionActiveGoals[0].id);

    case 'END_SESSION':
      const endingSession = await storage.getCurrentSession();
      if (!endingSession) {
        return null;
      }

      // Record final page dwell time before ending
      await recordPageDwellTime();

      // Get updated session after recording dwell time
      const updatedSession = await storage.getCurrentSession();

      // Generate review based on settings
      const sessionGoalData = await goalManager.getCurrentGoal();
      const sessionSettings = await storage.getSettings();
      let review = null;

      if (sessionGoalData) {
        if (sessionSettings.enableSessionSummary !== false) {
          // Generate full AI review
          try {
            review = await reviewGenerator.generateReview(updatedSession, sessionGoalData);
          } catch (error) {
            Logger.warn('Failed to generate review, ending session without review', error);
          }
        } else {
          // Generate stats-only review (no AI summary)
          review = reviewGenerator.generateStatsOnlyReview(updatedSession, sessionGoalData);
        }
      } else {
        Logger.info('No goal available, ending session without review');
      }

      return await storage.endSession(review);

    case 'GET_CURRENT_SESSION':
      return await storage.getCurrentSession();

    case 'GET_SESSION_HISTORY':
      return await storage.getSessionHistory(data.limit || 10);

    // Settings
    case 'GET_SETTINGS':
      return await storage.getSettings();

    case 'UPDATE_SETTINGS':
      return await storage.updateSettings(data.settings);

    // Domain lists
    case 'GET_WHITELIST':
      return await storage.getWhitelist();

    case 'ADD_TO_WHITELIST':
      return await storage.addToWhitelist(data.domain);

    case 'REMOVE_FROM_WHITELIST':
      return await storage.removeFromWhitelist(data.domain);

    case 'GET_BLACKLIST':
      return await storage.getBlacklist();

    case 'ADD_TO_BLACKLIST':
      const result = await storage.addToBlacklist(data.domain);
      // Check all open tabs and block any that match the newly blacklisted domain
      const allTabs = await chrome.tabs.query({});
      for (const tab of allTabs) {
        if (tab.url && !shouldExcludeUrl(tab.url)) {
          await checkAndBlockBlacklistedUrl(tab.id, tab.url);
        }
      }
      return result;

    case 'REMOVE_FROM_BLACKLIST':
      return await storage.removeFromBlacklist(data.domain);

    // Navigate to goal
    case 'NAVIGATE_TO_GOAL':
      const navGoal = await goalManager.getCurrentGoal();
      if (navGoal && navGoal.basePageUrl) {
        // Try to find existing tab with the base page URL
        const existingTabs = await chrome.tabs.query({ url: navGoal.basePageUrl });

        if (existingTabs.length > 0) {
          // Tab exists, switch to it
          await chrome.tabs.update(existingTabs[0].id, { active: true });
          await chrome.windows.update(existingTabs[0].windowId, { focused: true });
          Logger.info('Switched to existing base page tab');
        } else {
          // Tab doesn't exist, open new one
          await chrome.tabs.create({ url: navGoal.basePageUrl });
          Logger.info('Opened new tab with base page URL');
        }
        return { success: true };
      } else if (navGoal) {
        // Fallback: search for goal if no base page URL
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(navGoal.text)}`;
        await chrome.tabs.create({ url: searchUrl });
        Logger.info('No base page URL, opened search');
        return { success: true };
      }
      return { success: false, error: 'No goal set' };

    // Close current tab
    case 'CLOSE_CURRENT_TAB':
      try {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currentTab) {
          await chrome.tabs.remove(currentTab.id);
          Logger.info('Closed current tab');
          return { success: true };
        }
        return { success: false, error: 'No active tab found' };
      } catch (error) {
        Logger.error('Failed to close tab', error);
        return { success: false, error: error.message };
      }

    // Open sidebar settings
    case 'OPEN_SIDEBAR_SETTINGS':
      try {
        // Get current window
        const currentWindow = await chrome.windows.getCurrent();
        // Open side panel
        await chrome.sidePanel.open({ windowId: currentWindow.id });
        Logger.info('Opened sidebar for settings');
        return { success: true };
      } catch (error) {
        Logger.error('Failed to open sidebar', error);
        return { success: false, error: error.message };
      }

    // Navigate from blocked page
    case 'NAVIGATE_FROM_BLOCKED':
      try {
        const tabId = data.tabId;
        Logger.info('Navigating from blocked page', { tabId });

        // Try to go back in tab history
        try {
          await chrome.tabs.goBack(tabId);
          Logger.info('Successfully navigated back in history');
          return { success: true, method: 'history' };
        } catch (historyError) {
          Logger.info('No history available, trying goal base page', historyError.message);
          
          // No history, try to navigate to first active goal's base page
          const activeGoals = await goalManager.getActiveGoals();
          
          if (activeGoals && activeGoals.length > 0) {
            const firstGoal = activeGoals[0];
            
            if (firstGoal.basePageUrl) {
              await chrome.tabs.update(tabId, { url: firstGoal.basePageUrl });
              Logger.info('Navigated to goal base page', { url: firstGoal.basePageUrl });
              return { success: true, method: 'goal', url: firstGoal.basePageUrl };
            }
          }
          
          // No goal with base page, close the tab
          await chrome.tabs.remove(tabId);
          Logger.info('No navigation options, closed tab');
          return { success: true, method: 'close' };
        }
      } catch (error) {
        Logger.error('Failed to navigate from blocked page', error);
        return { success: false, error: error.message };
      }

    // Test notification
    case 'TEST_NOTIFICATION':
      try {
        const testId = await chrome.notifications.create(`test-${Date.now()}`, {
          type: 'basic',
          iconUrl: '../icons/icon128.png',
          title: 'Focus Assistant Test',
          message: 'If you see this, notifications are working!',
          priority: 2
        });
        Logger.info('[TEST] Notification created with ID:', testId);
        return { success: true, notificationId: testId };
      } catch (error) {
        Logger.error('[TEST] Failed to create notification:', error);
        return { success: false, error: error.message };
      }

    // Storage
    case 'GET_STORAGE_DATA':
      return {
        goal: await goalManager.getCurrentGoal(),  // Legacy - first active goal
        goals: await goalManager.getAllGoals(),    // New - all goals
        activeGoals: await goalManager.getActiveGoals(), // New - active goals
        session: await storage.getCurrentSession(),
        settings: await storage.getSettings(),
        profile: await storage.getUserProfile()
      };

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

// ============================================================================
// NOTIFICATION HANDLERS
// ============================================================================

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith('focus-')) return;

  if (buttonIndex === 0) {
    // "Back to Goal" clicked
    const goal = await goalManager.getCurrentGoal();
    if (goal && goal.basePageUrl) {
      // Try to find existing tab with the base page URL
      const existingTabs = await chrome.tabs.query({ url: goal.basePageUrl });

      if (existingTabs.length > 0) {
        // Tab exists, switch to it
        await chrome.tabs.update(existingTabs[0].id, { active: true });
        await chrome.windows.update(existingTabs[0].windowId, { focused: true });
        Logger.info('Switched to existing base page tab');
      } else {
        // Tab doesn't exist, open new one
        await chrome.tabs.create({ url: goal.basePageUrl });
        Logger.info('Opened new tab with base page URL');
      }
    } else if (goal) {
      // Fallback: search for goal if no base page URL
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(goal.text)}`;
      await chrome.tabs.create({ url: searchUrl });
      Logger.info('No base page URL, opened search');
    }
  } else if (buttonIndex === 1) {
    // "It's Relevant" clicked - get current tab and submit feedback
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'REQUEST_FEEDBACK',
        data: { label: 'relevant' }
      });
    }
  }

  // Clear notification
  chrome.notifications.clear(notificationId);
});

// ============================================================================
// ALARM HANDLERS (for unblocking)
// ============================================================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('unblock-')) {
    const ruleId = parseInt(alarm.name.split('-')[1]);
    await interventionManager.unblockDomain(ruleId);
    Logger.info('Auto-unblocked domain', ruleId);
  }
});

// ============================================================================
// TAB CHANGE DETECTION & TIME TRACKING
// ============================================================================

let lastActiveTabId = null;
let tabActivationTime = Date.now();
let currentPageUrl = null;
let currentPageBaseUrl = null;  // Track base URL to detect real navigation
let currentPageStartTime = Date.now();

/**
 * Record dwell time for current page before switching to a new one
 */
async function recordPageDwellTime() {
  if (!currentPageUrl) {
    return;
  }

  const session = await storage.getCurrentSession();
  if (!session) {
    return;
  }

  const dwellTime = Date.now() - currentPageStartTime;

  // Only record if dwelt for at least 1 second
  if (dwellTime < 1000) {
    return;
  }

  const pages = session.pagesVisited || [];

  // Use base URL for grouping (without query params/fragments)
  const baseUrl = getBaseUrl(currentPageUrl);

  // Find existing entry for this base URL
  const existingPage = pages.find(p => p.baseUrl === baseUrl);

  if (existingPage) {
    // Update existing entry with accumulated time
    existingPage.dwellTime = (existingPage.dwellTime || 0) + dwellTime;
    existingPage.lastVisitTime = Date.now();
    existingPage.visitCount = (existingPage.visitCount || 1) + 1;
    // Keep the most recent full URL as example
    existingPage.url = currentPageUrl;
  }
  // If not found, it means this page hasn't been evaluated yet, skip for now

  await storage.updateSession({ pagesVisited: pages });
  Logger.debug(`Recorded ${dwellTime}ms dwell time for ${baseUrl}`);
}

/**
 * Inject content script if not already present
 */
async function ensureContentScript(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch (error) {
    // Content script not present, inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['background/content-script.js']
      });
      Logger.info('Injected content script into tab', tabId);
      return true;
    } catch (injectError) {
      Logger.debug('Cannot inject content script', injectError.message);
      return false;
    }
  }
}

/**
 * Check if URL is blacklisted and redirect if needed
 */
async function checkAndBlockBlacklistedUrl(tabId, url) {
  try {
    const blacklist = await storage.getBlacklist();
    if (blacklist.length === 0) return false;

    const domain = new URL(url).hostname;
    const isBlacklisted = blacklist.some(blacklistedDomain => 
      domain.includes(blacklistedDomain)
    );
    
    if (isBlacklisted) {
      Logger.info('Blacklisted domain detected, redirecting to blocked page', { domain, url });
      const blockedUrl = chrome.runtime.getURL('ui/blocked.html') + 
        `?blocked=${encodeURIComponent(url)}&domain=${encodeURIComponent(domain)}`;
      await chrome.tabs.update(tabId, { url: blockedUrl });
      return true;
    }
    return false;
  } catch (error) {
    Logger.error('Error checking blacklist', error);
    return false;
  }
}

/**
 * Trigger page evaluation
 */
async function triggerPageEvaluation(tabId, url) {
  // Check if should exclude
  if (shouldExcludeUrl(url)) {
    Logger.debug('Excluded URL, skipping evaluation', url);
    return;
  }

  // Check if domain is blacklisted - block immediately
  const wasBlocked = await checkAndBlockBlacklistedUrl(tabId, url);
  if (wasBlocked) {
    return;
  }

  // Get current goal and settings
  const goal = await goalManager.getCurrentGoal();
  const settings = await storage.getSettings();

  if (!goal || !settings.enabled || !settings.detectionEnabled) {
    Logger.debug('Evaluation skipped: no goal or detection disabled');
    return;
  }

  // Ensure content script is loaded
  const hasContentScript = await ensureContentScript(tabId);
  if (!hasContentScript) {
    Logger.debug('Cannot ensure content script for tab', tabId);
    return;
  }

  // Wait briefly for page to settle, then send evaluation message
  setTimeout(async () => {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'START_EVALUATION' });
      Logger.debug('Triggered evaluation for tab', tabId);
    } catch (error) {
      Logger.debug('Could not trigger evaluation', error.message);
    }
  }, 500); // 500ms delay for page to settle
}

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  Logger.debug('Tab activated', activeInfo.tabId);

  // Record dwell time on previous page
  await recordPageDwellTime();

  lastActiveTabId = activeInfo.tabId;
  tabActivationTime = Date.now();

  // Get tab info and trigger evaluation
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      const newBaseUrl = getBaseUrl(tab.url);

      // Update current page tracking
      currentPageUrl = tab.url;
      currentPageBaseUrl = newBaseUrl;
      currentPageStartTime = Date.now();

      await triggerPageEvaluation(activeInfo.tabId, tab.url);
    }
  } catch (error) {
    Logger.debug('Error handling tab activation', error.message);
  }
});

// Listen for page navigation (URL changes in current tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only trigger when the page has finished loading
  if (changeInfo.status === 'complete' && tab.url) {
    const newBaseUrl = getBaseUrl(tab.url);

    // Check if base URL actually changed (not just query parameters)
    const baseUrlChanged = currentPageBaseUrl !== newBaseUrl;

    if (baseUrlChanged) {
      Logger.debug('Tab updated (navigation)', { tabId, url: tab.url });

      // Record dwell time for previous page if base URL changed
      if (tab.active && currentPageUrl) {
        await recordPageDwellTime();
      }

      // Update tracking
      if (tab.active) {
        currentPageUrl = tab.url;
        currentPageBaseUrl = newBaseUrl;
        currentPageStartTime = Date.now();
      }

      await triggerPageEvaluation(tabId, tab.url);
    } else {
      Logger.debug('Tab updated (query params changed, skipping re-evaluation)', {
        tabId,
        baseUrl: newBaseUrl
      });

      // Just update the full URL for tracking, but don't re-evaluate
      if (tab.active) {
        currentPageUrl = tab.url;
      }
    }
  }
});

// Export for testing
self.managers = {
  aiManager,
  goalManager,
  detectionEngine,
  learningEngine,
  interventionManager,
  reviewGenerator
};

Logger.info('Service worker script loaded');

