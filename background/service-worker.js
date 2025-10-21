// Background service worker for Chrome Focus Assistant
// Includes AI Manager and message routing

import { Logger, CONSTANTS, shouldExcludeUrl } from './utils.js';
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
      // Check if ai namespace exists
      if (!self.ai) {
        Logger.warn('Chrome AI namespace not available');
        return false;
      }
      
      // Check Language Model (Prompt API)
      if (self.ai.languageModel) {
        const status = await self.ai.languageModel.capabilities();
        this.capabilities.languageModel = status.available === 'readily' || status.available === 'after-download';
        Logger.info('Language Model available:', this.capabilities.languageModel);
      }
      
      // Check Summarizer
      if (self.ai.summarizer) {
        const status = await self.ai.summarizer.capabilities();
        this.capabilities.summarizer = status.available === 'readily' || status.available === 'after-download';
        Logger.info('Summarizer available:', this.capabilities.summarizer);
      }
      
      // Check Writer
      if (self.ai.writer) {
        const status = await self.ai.writer.capabilities();
        this.capabilities.writer = status.available === 'readily' || status.available === 'after-download';
        Logger.info('Writer available:', this.capabilities.writer);
      }
      
      // Check Rewriter
      if (self.ai.rewriter) {
        const status = await self.ai.rewriter.capabilities();
        this.capabilities.rewriter = status.available === 'readily' || status.available === 'after-download';
        Logger.info('Rewriter available:', this.capabilities.rewriter);
      }
      
      const allAvailable = Object.values(this.capabilities).every(v => v);
      Logger.info('All AI APIs available:', allAvailable);
      
      return allAvailable;
      
    } catch (error) {
      Logger.error('Error checking AI availability', error);
      return false;
    }
  }
  
  /**
   * Check if AI is available
   */
  isAvailable() {
    return this.capabilities.languageModel && this.capabilities.summarizer;
  }
  
  /**
   * Create or get language model session
   */
  async getLanguageModelSession(systemPrompt = null) {
    try {
      if (!this.capabilities.languageModel) {
        throw new Error('Language Model not available');
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
        
        this.sessions.languageModel = await self.ai.languageModel.create(options);
        Logger.debug('Created language model session');
      }
      
      return this.sessions.languageModel;
      
    } catch (error) {
      Logger.error('Failed to create language model session', error);
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
      
      // Create summarizer with options
      const summarizerOptions = {
        type: options.type || CONSTANTS.AI_CONFIG.SUMMARY_TYPE,
        length: options.length || CONSTANTS.AI_CONFIG.SUMMARY_LENGTH,
        sharedContext: options.context || ''
      };
      
      const summarizer = await self.ai.summarizer.create(summarizerOptions);
      const summary = await summarizer.summarize(text);
      
      Logger.debug('Summary generated', summary.substring(0, 100));
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
      
      const writer = await self.ai.writer.create(writerOptions);
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
      
      const rewriter = await self.ai.rewriter.create(rewriterOptions);
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
      return {
        available: aiManager.isAvailable(),
        capabilities: aiManager.capabilities
      };
    
    // Goal Management
    case 'EXTRACT_GOAL':
      return await goalManager.extractGoalFromPage(data.pageData);
    
    case 'GET_CURRENT_GOAL':
      return await goalManager.getCurrentGoal();
    
    case 'UPDATE_GOAL':
      return await goalManager.updateGoal(data.text, data.keywords);
    
    case 'CLEAR_GOAL':
      return await goalManager.clearGoal();
    
    // Detection
    case 'EVALUATE_PAGE':
      const goal = await goalManager.getCurrentGoal();
      if (!goal) {
        return { score: 1.0, label: 'no-goal', reason: 'No active goal' };
      }
      
      const evaluation = await detectionEngine.evaluatePage(data.pageData, goal);
      
      // Check if intervention needed
      if (await interventionManager.shouldIntervene(evaluation, data.pageData)) {
        await interventionManager.showNotification(evaluation, goal);
      }
      
      // Update session
      const session = await storage.getCurrentSession();
      if (session) {
        const pages = session.pagesVisited || [];
        pages.push({
          url: data.pageData.url,
          title: data.pageData.title,
          relevanceScore: evaluation.score,
          timestamp: Date.now()
        });
        
        await storage.updateSession({
          pagesVisited: pages,
          distractions: evaluation.label === 'distracting' ? 
            (session.distractions || 0) + 1 : session.distractions
        });
      }
      
      return evaluation;
    
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
      const activeSession = await storage.getCurrentSession();
      if (activeSession) {
        await storage.updateSession({
          feedbackGiven: (activeSession.feedbackGiven || 0) + 1
        });
      }
      
      return { success: true };
    
    // Session Management
    case 'START_SESSION':
      const sessionGoal = await goalManager.getCurrentGoal();
      if (!sessionGoal) {
        throw new Error('No goal set. Please set a goal first.');
      }
      return await storage.startSession(sessionGoal.id);
    
    case 'END_SESSION':
      const endingSession = await storage.getCurrentSession();
      if (!endingSession) {
        return null;
      }
      
      // Generate review
      const sessionGoalData = await goalManager.getCurrentGoal();
      const review = await reviewGenerator.generateReview(endingSession, sessionGoalData);
      
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
    
    // Storage
    case 'GET_STORAGE_DATA':
      return {
        goal: await storage.getCurrentGoal(),
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
    if (goal && goal.whitelist && goal.whitelist.length > 0) {
      // Open first whitelisted domain or search for goal
      const targetUrl = goal.whitelist[0].startsWith('http') ? 
        goal.whitelist[0] : 
        `https://www.google.com/search?q=${encodeURIComponent(goal.text)}`;
      
      chrome.tabs.create({ url: targetUrl });
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
// TAB CHANGE DETECTION
// ============================================================================

let lastActiveTabId = null;
let tabActivationTime = Date.now();

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
 * Trigger page evaluation
 */
async function triggerPageEvaluation(tabId, url) {
  // Check if should exclude
  if (shouldExcludeUrl(url)) {
    Logger.debug('Excluded URL, skipping evaluation', url);
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
  
  // Record dwell time on previous tab
  if (lastActiveTabId) {
    const dwellTime = Date.now() - tabActivationTime;
    Logger.debug(`Dwelled on tab ${lastActiveTabId} for ${dwellTime}ms`);
  }
  
  lastActiveTabId = activeInfo.tabId;
  tabActivationTime = Date.now();
  
  // Get tab info and trigger evaluation
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
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
    Logger.debug('Tab updated (navigation)', { tabId, url: tab.url });
    await triggerPageEvaluation(tabId, tab.url);
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

