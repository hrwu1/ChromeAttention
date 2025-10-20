// Core modules for Chrome Focus Assistant
// All 5 functional modules in one file for easy maintenance

import { Logger, CONSTANTS, calculateSimilarity } from './utils.js';
import { storage } from './storage.js';

// ============================================================================
// MODULE 1: GOAL MANAGER
// ============================================================================

export class GoalManager {
  constructor(aiManager) {
    this.aiManager = aiManager;
  }
  
  /**
   * Automatically extract goal from current page content
   * Uses Summarizer to get key points, then Prompt to structure the goal
   */
  async extractGoalFromPage(pageData) {
    try {
      Logger.info('Extracting goal from page', pageData.title);
      
      // Check if AI is available
      if (!this.aiManager.isAvailable()) {
        Logger.warn('AI not available, using fallback goal extraction');
        return this.fallbackGoalExtraction(pageData);
      }
      
      // Step 1: Summarize the page content
      const summary = await this.aiManager.summarize(pageData.text);
      Logger.debug('Page summary', summary);
      
      // Step 2: Use Prompt API to structure the goal
      const promptText = `Based on this page content, identify the user's likely work or study goal.

Page Title: ${pageData.title}
Page Summary: ${summary}

Please respond in this exact JSON format:
{
  "goal": "A clear, one-sentence description of the task or goal",
  "keywords": ["key", "terms", "related", "to", "goal"],
  "suggestedWhitelist": ["domain1.com", "domain2.com"],
  "suggestedBlacklist": ["socialmedia.com", "entertainment.com"]
}`;

      const response = await this.aiManager.prompt(promptText);
      const goalData = this.parseGoalResponse(response);
      
      // Step 3: Save the goal
      await storage.setCurrentGoal({
        text: goalData.goal,
        keywords: goalData.keywords,
        whitelist: goalData.suggestedWhitelist || [],
        blacklist: goalData.suggestedBlacklist || []
      });
      
      Logger.info('Goal extracted successfully', goalData);
      return goalData;
      
    } catch (error) {
      Logger.error('Failed to extract goal', error);
      return this.fallbackGoalExtraction(pageData);
    }
  }
  
  /**
   * Parse AI response into structured goal data
   */
  parseGoalResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          goal: parsed.goal || 'Focus on current task',
          keywords: parsed.keywords || [],
          suggestedWhitelist: parsed.suggestedWhitelist || [],
          suggestedBlacklist: parsed.suggestedBlacklist || []
        };
      }
    } catch (e) {
      Logger.warn('Failed to parse goal response as JSON', e);
    }
    
    // Fallback: extract what we can from text
    return {
      goal: response.substring(0, 200),
      keywords: [],
      suggestedWhitelist: [],
      suggestedBlacklist: []
    };
  }
  
  /**
   * Fallback goal extraction without AI
   */
  fallbackGoalExtraction(pageData) {
    const goal = {
      goal: `Working on: ${pageData.title}`,
      keywords: this.extractKeywordsSimple(pageData.title + ' ' + pageData.text),
      suggestedWhitelist: [pageData.domain],
      suggestedBlacklist: []
    };
    
    storage.setCurrentGoal({
      text: goal.goal,
      keywords: goal.keywords,
      whitelist: goal.suggestedWhitelist,
      blacklist: goal.suggestedBlacklist
    });
    
    return goal;
  }
  
  /**
   * Simple keyword extraction (most frequent words)
   */
  extractKeywordsSimple(text) {
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const frequency = {};
    
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
  
  /**
   * Update current goal manually
   */
  async updateGoal(goalText, keywords = []) {
    return await storage.setCurrentGoal({
      text: goalText,
      keywords: keywords
    });
  }
  
  /**
   * Get current goal
   */
  async getCurrentGoal() {
    return await storage.getCurrentGoal();
  }
  
  /**
   * Clear current goal
   */
  async clearGoal() {
    return await storage.clearCurrentGoal();
  }
}

// ============================================================================
// MODULE 2: DETECTION ENGINE
// ============================================================================

export class DetectionEngine {
  constructor(aiManager) {
    this.aiManager = aiManager;
  }
  
  /**
   * Evaluate if current page is relevant to the goal
   * Returns: {score, label, reason}
   */
  async evaluatePage(pageData, goal) {
    try {
      Logger.info('Evaluating page relevance', pageData.title);
      
      // Quick checks first
      const quickCheck = await this.quickRelevanceCheck(pageData, goal);
      if (quickCheck.confident) {
        return quickCheck.result;
      }
      
      // Use AI for semantic evaluation
      if (!this.aiManager.isAvailable()) {
        Logger.warn('AI not available, using fallback detection');
        return this.fallbackDetection(pageData, goal);
      }
      
      // Summarize current page
      const pageSummary = await this.aiManager.summarize(pageData.text);
      
      // Use Prompt API to evaluate relevance
      const promptText = `You are a focus assistant. Determine if this webpage is relevant to the user's current goal.

Current Goal: ${goal.text}
Goal Keywords: ${goal.keywords.join(', ')}

Current Page Title: ${pageData.title}
Current Page Summary: ${pageSummary}
Current Page Domain: ${pageData.domain}

Is this page relevant to the goal? Rate from 0.0 (completely unrelated) to 1.0 (highly relevant).

Respond in this exact JSON format:
{
  "score": 0.0-1.0,
  "label": "relevant" or "distracting",
  "reason": "Brief explanation"
}`;

      const response = await this.aiManager.prompt(promptText);
      const evaluation = this.parseEvaluationResponse(response);
      
      Logger.debug('AI evaluation', evaluation);
      return evaluation;
      
    } catch (error) {
      Logger.error('Failed to evaluate page', error);
      return this.fallbackDetection(pageData, goal);
    }
  }
  
  /**
   * Quick relevance check using whitelist/blacklist and keyword matching
   */
  async quickRelevanceCheck(pageData, goal) {
    // Check whitelist
    const whitelist = await storage.getWhitelist();
    if (whitelist.some(domain => pageData.domain.includes(domain))) {
      return {
        confident: true,
        result: {
          score: 1.0,
          label: 'relevant',
          reason: 'Domain is whitelisted'
        }
      };
    }
    
    // Check blacklist
    const blacklist = await storage.getBlacklist();
    if (blacklist.some(domain => pageData.domain.includes(domain))) {
      return {
        confident: true,
        result: {
          score: 0.0,
          label: 'distracting',
          reason: 'Domain is blacklisted'
        }
      };
    }
    
    // Check if keywords match strongly
    const keywordScore = this.calculateKeywordOverlap(pageData, goal);
    if (keywordScore > 0.8) {
      return {
        confident: true,
        result: {
          score: keywordScore,
          label: 'relevant',
          reason: 'Strong keyword match'
        }
      };
    }
    
    return { confident: false };
  }
  
  /**
   * Calculate keyword overlap between page and goal
   */
  calculateKeywordOverlap(pageData, goal) {
    const pageText = (pageData.title + ' ' + pageData.text).toLowerCase();
    const goalKeywords = goal.keywords || [];
    
    if (goalKeywords.length === 0) return 0.5; // Neutral if no keywords
    
    const matchCount = goalKeywords.filter(keyword => 
      pageText.includes(keyword.toLowerCase())
    ).length;
    
    return matchCount / goalKeywords.length;
  }
  
  /**
   * Parse AI evaluation response
   */
  parseEvaluationResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parseFloat(parsed.score) || 0.5,
          label: parsed.label || 'unknown',
          reason: parsed.reason || 'No reason provided'
        };
      }
    } catch (e) {
      Logger.warn('Failed to parse evaluation response', e);
    }
    
    // Try to extract score from text
    const scoreMatch = response.match(/(\d+\.?\d*)/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5;
    
    return {
      score: score > 1 ? score / 10 : score, // Normalize if out of 10
      label: score > 0.6 ? 'relevant' : 'distracting',
      reason: response.substring(0, 100)
    };
  }
  
  /**
   * Fallback detection using simple keyword matching
   */
  fallbackDetection(pageData, goal) {
    const score = calculateSimilarity(
      pageData.title + ' ' + pageData.text,
      goal.text + ' ' + (goal.keywords || []).join(' ')
    );
    
    return {
      score,
      label: score > CONSTANTS.RELEVANCE_THRESHOLD ? 'relevant' : 'distracting',
      reason: 'Fallback keyword matching'
    };
  }
}

// ============================================================================
// MODULE 3: LEARNING ENGINE
// ============================================================================

export class LearningEngine {
  constructor(aiManager) {
    this.aiManager = aiManager;
  }
  
  /**
   * Learn from user feedback to improve future predictions
   */
  async learnFromFeedback(pageData, goalId, userLabel, systemScore) {
    try {
      Logger.info('Learning from feedback', { userLabel, systemScore });
      
      // Store feedback
      await storage.addFeedback({
        goalId,
        url: pageData.url,
        title: pageData.title,
        userLabel,
        systemScore,
        pageContent: pageData.text.substring(0, 500) // Store sample
      });
      
      // Adjust threshold if there's a pattern of misclassification
      await this.adjustThreshold();
      
      Logger.info('Feedback recorded and learned');
      return true;
      
    } catch (error) {
      Logger.error('Failed to learn from feedback', error);
      return false;
    }
  }
  
  /**
   * Adjust detection threshold based on feedback accuracy
   */
  async adjustThreshold() {
    const recentFeedback = await storage.getFeedbackHistory(20);
    
    if (recentFeedback.length < 10) {
      return; // Not enough data yet
    }
    
    // Calculate misclassification rate
    let falsePositives = 0; // System said relevant, user said distracting
    let falseNegatives = 0; // System said distracting, user said relevant
    
    recentFeedback.forEach(feedback => {
      const systemLabel = feedback.systemScore > CONSTANTS.RELEVANCE_THRESHOLD ? 'relevant' : 'distracting';
      
      if (systemLabel === 'relevant' && feedback.userLabel === 'distracting') {
        falsePositives++;
      } else if (systemLabel === 'distracting' && feedback.userLabel === 'relevant') {
        falseNegatives++;
      }
    });
    
    // Adjust threshold
    const settings = await storage.getSettings();
    let newThreshold = settings.relevanceThreshold;
    
    if (falsePositives > falseNegatives * 2) {
      // Too many false positives, increase threshold
      newThreshold = Math.min(0.9, newThreshold + CONSTANTS.LEARNING_RATE);
      Logger.info('Increasing relevance threshold', newThreshold);
    } else if (falseNegatives > falsePositives * 2) {
      // Too many false negatives, decrease threshold
      newThreshold = Math.max(0.3, newThreshold - CONSTANTS.LEARNING_RATE);
      Logger.info('Decreasing relevance threshold', newThreshold);
    }
    
    if (newThreshold !== settings.relevanceThreshold) {
      await storage.updateSettings({ relevanceThreshold: newThreshold });
    }
  }
  
  /**
   * Get few-shot examples for prompt enhancement
   */
  async getFewShotExamples(limit = 5) {
    const feedback = await storage.getFeedbackHistory(limit * 2);
    
    // Balance positive and negative examples
    const relevant = feedback.filter(f => f.userLabel === 'relevant').slice(0, limit);
    const distracting = feedback.filter(f => f.userLabel === 'distracting').slice(0, limit);
    
    return [...relevant, ...distracting];
  }
  
  /**
   * Build few-shot prompt with examples
   */
  async buildEnhancedPrompt(basePrompt) {
    const examples = await this.getFewShotExamples(3);
    
    if (examples.length === 0) {
      return basePrompt;
    }
    
    let enhancedPrompt = basePrompt + '\n\nHere are some examples of past evaluations:\n\n';
    
    examples.forEach((example, index) => {
      enhancedPrompt += `Example ${index + 1}:\n`;
      enhancedPrompt += `Page: ${example.title}\n`;
      enhancedPrompt += `User feedback: ${example.userLabel}\n\n`;
    });
    
    enhancedPrompt += 'Now evaluate the current page:\n';
    
    return enhancedPrompt;
  }
}

// ============================================================================
// MODULE 4: INTERVENTION MANAGER
// ============================================================================

export class InterventionManager {
  constructor() {
    this.lastNotificationTime = 0;
  }
  
  /**
   * Decide if intervention is needed based on evaluation
   */
  async shouldIntervene(evaluation, pageData) {
    const settings = await storage.getSettings();
    
    if (!settings.interventionEnabled) {
      return false;
    }
    
    // Check if page is distracting
    if (evaluation.label !== 'distracting') {
      return false;
    }
    
    // Check cooldown period
    const timeSinceLastNotification = Date.now() - this.lastNotificationTime;
    if (timeSinceLastNotification < settings.notificationCooldown) {
      Logger.debug('Intervention on cooldown');
      return false;
    }
    
    return true;
  }
  
  /**
   * Show notification to user
   */
  async showNotification(evaluation, goal) {
    try {
      const profile = await storage.getUserProfile();
      
      const notificationOptions = {
        type: 'basic',
        iconUrl: '../icons/icon128.png',
        title: 'Focus Assistant',
        message: `This page might be distracting from your goal: "${goal.text}"\n\n${evaluation.reason}`,
        buttons: [
          { title: 'Back to Goal' },
          { title: "It's Relevant" }
        ],
        priority: 1
      };
      
      await chrome.notifications.create(`focus-${Date.now()}`, notificationOptions);
      
      this.lastNotificationTime = Date.now();
      
      // Update session stats
      const session = await storage.getCurrentSession();
      if (session) {
        await storage.updateSession({
          interventions: (session.interventions || 0) + 1
        });
      }
      
      Logger.info('Notification shown');
      return true;
      
    } catch (error) {
      Logger.error('Failed to show notification', error);
      return false;
    }
  }
  
  /**
   * Temporarily block a domain using DeclarativeNetRequest
   */
  async blockDomain(domain, durationMs = CONSTANTS.BLOCK_DURATION) {
    try {
      // Get current rules
      const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
      const nextRuleId = currentRules.length > 0 
        ? Math.max(...currentRules.map(r => r.id)) + 1 
        : 1;
      
      // Add blocking rule
      const newRule = {
        id: nextRuleId,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            url: chrome.runtime.getURL('ui/blocked.html')
          }
        },
        condition: {
          urlFilter: `*://${domain}/*`,
          resourceTypes: ['main_frame']
        }
      };
      
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [newRule],
        removeRuleIds: []
      });
      
      // Schedule unblock
      chrome.alarms.create(`unblock-${nextRuleId}`, {
        delayInMinutes: durationMs / 60000
      });
      
      Logger.info(`Blocked domain: ${domain}`, newRule);
      return true;
      
    } catch (error) {
      Logger.error('Failed to block domain', error);
      return false;
    }
  }
  
  /**
   * Unblock a domain
   */
  async unblockDomain(ruleId) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: [ruleId]
      });
      
      Logger.info(`Unblocked rule: ${ruleId}`);
      return true;
      
    } catch (error) {
      Logger.error('Failed to unblock domain', error);
      return false;
    }
  }
}

// ============================================================================
// MODULE 5: REVIEW GENERATOR
// ============================================================================

export class ReviewGenerator {
  constructor(aiManager) {
    this.aiManager = aiManager;
  }
  
  /**
   * Generate session review with AI
   */
  async generateReview(session, goal) {
    try {
      Logger.info('Generating session review', session.id);
      
      if (!this.aiManager.isAvailable()) {
        return this.fallbackReview(session, goal);
      }
      
      // Build session summary
      const duration = session.endTime - session.startTime;
      const pagesCount = session.pagesVisited?.length || 0;
      const distractionsCount = session.distractions || 0;
      
      const promptText = `Generate a brief focus session review in English.

Goal: ${goal.text}
Duration: ${Math.floor(duration / 60000)} minutes
Pages visited: ${pagesCount}
Distractions detected: ${distractionsCount}
Interventions: ${session.interventions || 0}

Create a review with:
1. A brief summary of the session (1-2 sentences)
2. Key accomplishment or observation
3. One actionable suggestion for the next session

Format as 3 bullet points, clear and motivational.`;

      const review = await this.aiManager.write(promptText);
      
      Logger.info('Review generated', review);
      return {
        summary: review,
        timestamp: Date.now()
      };
      
    } catch (error) {
      Logger.error('Failed to generate review', error);
      return this.fallbackReview(session, goal);
    }
  }
  
  /**
   * Fallback review without AI
   */
  fallbackReview(session, goal) {
    const duration = Math.floor((session.endTime - session.startTime) / 60000);
    const pagesCount = session.pagesVisited?.length || 0;
    const distractionsCount = session.distractions || 0;
    
    const summary = `• You worked on "${goal.text}" for ${duration} minutes\n` +
                   `• Visited ${pagesCount} pages with ${distractionsCount} distractions detected\n` +
                   `• ${distractionsCount < 3 ? 'Great focus!' : 'Try reducing distractions next time'}`;
    
    return {
      summary,
      timestamp: Date.now()
    };
  }
  
  /**
   * Generate motivational message
   */
  async generateMotivation(sessionHistory) {
    const totalSessions = sessionHistory.length;
    const totalTime = sessionHistory.reduce((sum, s) => 
      sum + (s.endTime - s.startTime), 0
    );
    
    const hours = Math.floor(totalTime / 3600000);
    
    return `You've completed ${totalSessions} focus sessions totaling ${hours} hours of focused work. Keep it up!`;
  }
}

