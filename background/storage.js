// Storage manager for Chrome Focus Assistant
// Handles all chrome.storage.local operations with schema validation

import { Logger, CONSTANTS } from './utils.js';

// ============================================================================
// DATA SCHEMAS
// ============================================================================

const SCHEMAS = {
  goal: {
    id: '',
    text: '',              // Human-readable goal description
    keywords: [],          // Key terms related to the goal
    whitelist: [],         // Domains/URLs that are always relevant
    blacklist: [],         // Domains/URLs that are always distracting
    basePageUrl: '',       // The URL where the goal was set
    basePageTitle: '',     // The title of the base page
    createdAt: 0,
    updatedAt: 0,
    isActive: false,       // Whether this goal is currently active/focused
    isDone: false          // Whether this goal is completed
  },
  
  session: {
    id: '',
    goalId: '',
    startTime: 0,
    endTime: 0,
    pagesVisited: [],      // Array of {url, baseUrl, title, domain, relevanceScore, timestamp, lastEvaluationTime, dwellTime, visitCount, lastVisitTime}
    distractions: 0,       // Count of distraction alerts
    interventions: 0,      // Count of interventions taken
    feedbackGiven: 0,      // Count of user feedback
    active: true
  },
  
  feedback: {
    id: '',
    sessionId: '',
    goalId: '',
    url: '',
    title: '',
    userLabel: '',         // 'relevant' or 'distracting'
    systemScore: 0,        // What the system predicted
    pageContent: '',       // Sample of content for learning
    timestamp: 0
  },
  
  profile: {
    role: 'general',       // 'student', 'developer', 'researcher', 'general'
    commonDomains: [],     // Frequently visited work domains
    preferredIntervention: 'notification', // 'notification', 'block', 'none'
    notificationCooldown: CONSTANTS.NOTIFICATION_COOLDOWN,
    enableLearning: true,
    enableReviews: true
  },
  
  settings: {
    enabled: true,
    autoGoalSetting: true,
    detectionEnabled: true,
    interventionEnabled: true,
    relevanceThreshold: CONSTANTS.RELEVANCE_THRESHOLD,
    dwellTimeThreshold: CONSTANTS.DWELL_TIME_THRESHOLD,
    notificationCooldown: CONSTANTS.NOTIFICATION_COOLDOWN
  }
};

// ============================================================================
// STORAGE MANAGER CLASS
// ============================================================================

export class StorageManager {
  constructor() {
    this.cache = new Map();
  }
  
  // --------------------------------------------------------------------------
  // Core Storage Operations
  // --------------------------------------------------------------------------
  
  async get(key, defaultValue = null) {
    try {
      // Check cache first
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      
      const result = await chrome.storage.local.get(key);
      const value = result[key] !== undefined ? result[key] : defaultValue;
      
      // Update cache
      this.cache.set(key, value);
      
      return value;
    } catch (error) {
      Logger.error(`Failed to get ${key} from storage`, error);
      return defaultValue;
    }
  }
  
  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      
      // Update cache
      this.cache.set(key, value);
      
      Logger.debug(`Stored ${key}`, value);
      return true;
    } catch (error) {
      Logger.error(`Failed to set ${key} in storage`, error);
      return false;
    }
  }
  
  async remove(key) {
    try {
      await chrome.storage.local.remove(key);
      this.cache.delete(key);
      Logger.debug(`Removed ${key} from storage`);
      return true;
    } catch (error) {
      Logger.error(`Failed to remove ${key}`, error);
      return false;
    }
  }
  
  async clear() {
    try {
      await chrome.storage.local.clear();
      this.cache.clear();
      Logger.info('Cleared all storage');
      return true;
    } catch (error) {
      Logger.error('Failed to clear storage', error);
      return false;
    }
  }
  
  // --------------------------------------------------------------------------
  // Goal Operations
  // --------------------------------------------------------------------------
  
  async getCurrentGoal() {
    return await this.get(CONSTANTS.STORAGE_KEYS.CURRENT_GOAL);
  }
  
  async setCurrentGoal(goalData) {
    const goal = {
      ...SCHEMAS.goal,
      ...goalData,
      updatedAt: Date.now()
    };
    
    if (!goal.id) {
      goal.id = `goal-${Date.now()}`;
      goal.createdAt = Date.now();
    }
    
    return await this.set(CONSTANTS.STORAGE_KEYS.CURRENT_GOAL, goal);
  }
  
  async clearCurrentGoal() {
    return await this.remove(CONSTANTS.STORAGE_KEYS.CURRENT_GOAL);
  }
  
  // --------------------------------------------------------------------------
  // Goals List Operations (New Multi-Goal System)
  // --------------------------------------------------------------------------
  
  async getAllGoals() {
    const goals = await this.get(CONSTANTS.STORAGE_KEYS.GOALS_LIST, []);
    return goals;
  }
  
  async getActiveGoals() {
    const goals = await this.getAllGoals();
    return goals.filter(goal => goal.isActive && !goal.isDone);
  }
  
  async getGoalById(goalId) {
    const goals = await this.getAllGoals();
    return goals.find(goal => goal.id === goalId);
  }
  
  async addGoal(goalData) {
    const goals = await this.getAllGoals();
    
    const newGoal = {
      ...SCHEMAS.goal,
      ...goalData,
      id: goalData.id || `goal-${Date.now()}`,
      createdAt: goalData.createdAt || Date.now(),
      updatedAt: Date.now(),
      isActive: goalData.isActive !== undefined ? goalData.isActive : false,
      isDone: false
    };
    
    goals.push(newGoal);
    await this.set(CONSTANTS.STORAGE_KEYS.GOALS_LIST, goals);
    
    Logger.info('Added new goal', newGoal);
    return newGoal;
  }
  
  async updateGoal(goalId, updates) {
    const goals = await this.getAllGoals();
    const goalIndex = goals.findIndex(goal => goal.id === goalId);
    
    if (goalIndex === -1) {
      Logger.warn('Goal not found for update', goalId);
      return null;
    }
    
    goals[goalIndex] = {
      ...goals[goalIndex],
      ...updates,
      updatedAt: Date.now()
    };
    
    await this.set(CONSTANTS.STORAGE_KEYS.GOALS_LIST, goals);
    Logger.debug('Updated goal', goals[goalIndex]);
    
    return goals[goalIndex];
  }
  
  async deleteGoal(goalId) {
    const goals = await this.getAllGoals();
    const filteredGoals = goals.filter(goal => goal.id !== goalId);
    
    if (filteredGoals.length === goals.length) {
      Logger.warn('Goal not found for deletion', goalId);
      return false;
    }
    
    await this.set(CONSTANTS.STORAGE_KEYS.GOALS_LIST, filteredGoals);
    Logger.info('Deleted goal', goalId);
    
    return true;
  }
  
  async markGoalDone(goalId) {
    return await this.updateGoal(goalId, { isDone: true, isActive: false });
  }
  
  async setActiveGoals(goalIds) {
    const goals = await this.getAllGoals();
    
    // Deactivate all goals first
    const updatedGoals = goals.map(goal => ({
      ...goal,
      isActive: goalIds.includes(goal.id) && !goal.isDone
    }));
    
    await this.set(CONSTANTS.STORAGE_KEYS.GOALS_LIST, updatedGoals);
    Logger.info('Set active goals', goalIds);
    
    return updatedGoals.filter(goal => goal.isActive);
  }
  
  async toggleGoalActive(goalId) {
    const goal = await this.getGoalById(goalId);
    if (!goal) {
      Logger.warn('Goal not found for toggle', goalId);
      return null;
    }
    
    if (goal.isDone) {
      Logger.warn('Cannot activate a completed goal', goalId);
      return goal;
    }
    
    return await this.updateGoal(goalId, { isActive: !goal.isActive });
  }
  
  // --------------------------------------------------------------------------
  // Session Operations
  // --------------------------------------------------------------------------
  
  async getCurrentSession() {
    const sessionData = await this.get(CONSTANTS.STORAGE_KEYS.SESSION_DATA, {});
    return sessionData.current || null;
  }
  
  async startSession(goalId) {
    const sessionData = await this.get(CONSTANTS.STORAGE_KEYS.SESSION_DATA, {
      current: null,
      history: []
    });
    
    const newSession = {
      ...SCHEMAS.session,
      id: `session-${Date.now()}`,
      goalId,
      startTime: Date.now(),
      active: true
    };
    
    sessionData.current = newSession;
    await this.set(CONSTANTS.STORAGE_KEYS.SESSION_DATA, sessionData);
    
    Logger.info('Started new session', newSession);
    return newSession;
  }
  
  async updateSession(updates) {
    const sessionData = await this.get(CONSTANTS.STORAGE_KEYS.SESSION_DATA, {});
    
    if (!sessionData.current) {
      Logger.warn('No active session to update');
      return null;
    }
    
    sessionData.current = {
      ...sessionData.current,
      ...updates
    };
    
    await this.set(CONSTANTS.STORAGE_KEYS.SESSION_DATA, sessionData);
    return sessionData.current;
  }
  
  async endSession(reviewData = null) {
    const sessionData = await this.get(CONSTANTS.STORAGE_KEYS.SESSION_DATA, {});
    
    if (!sessionData.current) {
      Logger.warn('No active session to end');
      return null;
    }
    
    const endedSession = {
      ...sessionData.current,
      endTime: Date.now(),
      active: false,
      review: reviewData
    };
    
    // Move to history
    if (!sessionData.history) {
      sessionData.history = [];
    }
    sessionData.history.unshift(endedSession);
    
    // Keep only last 50 sessions
    if (sessionData.history.length > 50) {
      sessionData.history = sessionData.history.slice(0, 50);
    }
    
    sessionData.current = null;
    
    await this.set(CONSTANTS.STORAGE_KEYS.SESSION_DATA, sessionData);
    Logger.info('Ended session', endedSession);
    
    return endedSession;
  }
  
  async getSessionHistory(limit = 10) {
    const sessionData = await this.get(CONSTANTS.STORAGE_KEYS.SESSION_DATA, {});
    return (sessionData.history || []).slice(0, limit);
  }
  
  // --------------------------------------------------------------------------
  // Feedback Operations
  // --------------------------------------------------------------------------
  
  async addFeedback(feedbackData) {
    const history = await this.get(CONSTANTS.STORAGE_KEYS.FEEDBACK_HISTORY, []);
    
    const feedback = {
      ...SCHEMAS.feedback,
      ...feedbackData,
      id: `feedback-${Date.now()}`,
      timestamp: Date.now()
    };
    
    history.unshift(feedback);
    
    // Keep only recent feedback (for few-shot learning)
    if (history.length > CONSTANTS.MAX_FEEDBACK_SAMPLES) {
      history.splice(CONSTANTS.MAX_FEEDBACK_SAMPLES);
    }
    
    await this.set(CONSTANTS.STORAGE_KEYS.FEEDBACK_HISTORY, history);
    Logger.debug('Added feedback', feedback);
    
    return feedback;
  }
  
  async getFeedbackHistory(limit = null) {
    const history = await this.get(CONSTANTS.STORAGE_KEYS.FEEDBACK_HISTORY, []);
    return limit ? history.slice(0, limit) : history;
  }
  
  async clearFeedbackHistory() {
    return await this.set(CONSTANTS.STORAGE_KEYS.FEEDBACK_HISTORY, []);
  }
  
  // --------------------------------------------------------------------------
  // Profile Operations
  // --------------------------------------------------------------------------
  
  async getUserProfile() {
    const profile = await this.get(CONSTANTS.STORAGE_KEYS.USER_PROFILE);
    return profile || SCHEMAS.profile;
  }
  
  async updateUserProfile(updates) {
    const currentProfile = await this.getUserProfile();
    const updatedProfile = {
      ...currentProfile,
      ...updates
    };
    
    await this.set(CONSTANTS.STORAGE_KEYS.USER_PROFILE, updatedProfile);
    Logger.debug('Updated user profile', updatedProfile);
    
    return updatedProfile;
  }
  
  // --------------------------------------------------------------------------
  // Whitelist/Blacklist Operations
  // --------------------------------------------------------------------------
  
  async getWhitelist() {
    return await this.get(CONSTANTS.STORAGE_KEYS.WHITELIST, []);
  }
  
  async addToWhitelist(domain) {
    const whitelist = await this.getWhitelist();
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      await this.set(CONSTANTS.STORAGE_KEYS.WHITELIST, whitelist);
    }
    return whitelist;
  }
  
  async removeFromWhitelist(domain) {
    const whitelist = await this.getWhitelist();
    const filtered = whitelist.filter(d => d !== domain);
    await this.set(CONSTANTS.STORAGE_KEYS.WHITELIST, filtered);
    return filtered;
  }
  
  async getBlacklist() {
    return await this.get(CONSTANTS.STORAGE_KEYS.BLACKLIST, []);
  }
  
  async addToBlacklist(domain) {
    const blacklist = await this.getBlacklist();
    if (!blacklist.includes(domain)) {
      blacklist.push(domain);
      await this.set(CONSTANTS.STORAGE_KEYS.BLACKLIST, blacklist);
    }
    return blacklist;
  }
  
  async removeFromBlacklist(domain) {
    const blacklist = await this.getBlacklist();
    const filtered = blacklist.filter(d => d !== domain);
    await this.set(CONSTANTS.STORAGE_KEYS.BLACKLIST, filtered);
    return filtered;
  }
  
  // --------------------------------------------------------------------------
  // Settings Operations
  // --------------------------------------------------------------------------
  
  async getSettings() {
    const settings = await this.get(CONSTANTS.STORAGE_KEYS.SETTINGS);
    return settings || SCHEMAS.settings;
  }
  
  async updateSettings(updates) {
    const currentSettings = await this.getSettings();
    const updatedSettings = {
      ...currentSettings,
      ...updates
    };
    
    await this.set(CONSTANTS.STORAGE_KEYS.SETTINGS, updatedSettings);
    Logger.info('Updated settings', updatedSettings);
    
    return updatedSettings;
  }
  
  // --------------------------------------------------------------------------
  // Migration & Initialization
  // --------------------------------------------------------------------------
  
  async initialize() {
    Logger.info('Initializing storage...');
    
    // Ensure default settings exist
    const settings = await this.getSettings();
    if (!settings.enabled === undefined) {
      await this.updateSettings(SCHEMAS.settings);
    }
    
    // Ensure profile exists
    const profile = await this.getUserProfile();
    if (!profile.role) {
      await this.updateUserProfile(SCHEMAS.profile);
    }
    
    Logger.info('Storage initialized');
  }
}

// Export singleton instance
export const storage = new StorageManager();

