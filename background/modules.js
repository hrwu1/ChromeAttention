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
   * Now adds to goals list instead of replacing current goal
   */
  async extractGoalFromPage(pageData, setAsActive = true) {
    try {
      Logger.info('Extracting goal from page', pageData.title);

      // Check if AI is available
      if (!this.aiManager.isAvailable()) {
        Logger.warn('AI not available, using fallback goal extraction');
        return this.fallbackGoalExtraction(pageData, setAsActive);
      }

      // Step 1: Summarize the page content
      Logger.debug('AI Request (Summarize)', { text: pageData.text.substring(0, 500) + '...' });
      const summary = await this.aiManager.summarize(pageData.text);
      Logger.debug('AI Response (Summarize)', summary);

      // Check if summary is empty or too short
      if (!summary || summary.trim().length < 10) {
        Logger.warn('Summary is empty or too short, using page text directly');
        // Fall back to using a truncated version of the page text
        const truncatedText = pageData.text.substring(0, 1000);
        
        const promptText = `Based on this page content, identify the user's likely work or study goal.

Page Title: ${pageData.title}
Page Content: ${truncatedText}

Please respond in this exact JSON format:
{
  "goal": "A clear, one-sentence description of the task or goal",
  "keywords": ["key", "terms", "related", "to", "goal"]
}`;

        Logger.debug('AI Request (Prompt - Extract Goal)', promptText);
        const response = await this.aiManager.prompt(promptText);
        Logger.debug('AI Response (Prompt - Extract Goal)', response);
        const goalData = this.parseGoalResponse(response);
        
        const newGoal = await storage.addGoal({
          text: goalData.goal,
          keywords: goalData.keywords,
          basePageUrl: pageData.url,
          basePageTitle: pageData.title,
          isActive: setAsActive
        });

        Logger.info('Goal extracted and added to list', newGoal);
        return newGoal;
      }

      // Step 2: Use Prompt API to structure the goal
      const promptText = `Based on this page content, identify the user's likely work or study goal.

Page Title: ${pageData.title}
Page Summary: ${summary}

Please respond in this exact JSON format:
{
  "goal": "A clear, one-sentence description of the task or goal",
  "keywords": ["key", "terms", "related", "to", "goal"]
}`;

      Logger.debug('AI Request (Prompt - Extract Goal)', promptText);
      const response = await this.aiManager.prompt(promptText);
      Logger.debug('AI Response (Prompt - Extract Goal)', response);
      const goalData = this.parseGoalResponse(response);

      // Step 3: Add the goal to the goals list
      const newGoal = await storage.addGoal({
        text: goalData.goal,
        keywords: goalData.keywords,
        basePageUrl: pageData.url,
        basePageTitle: pageData.title,
        isActive: setAsActive
      });

      Logger.info('Goal extracted and added to list', newGoal);
      return newGoal;

    } catch (error) {
      Logger.error('Failed to extract goal', error);
      return this.fallbackGoalExtraction(pageData, setAsActive);
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
          keywords: parsed.keywords || []
        };
      }
    } catch (e) {
      Logger.warn('Failed to parse goal response as JSON', e);
    }

    // Fallback: extract what we can from text
    return {
      goal: response.substring(0, 200),
      keywords: []
    };
  }

  /**
   * Fallback goal extraction without AI
   */
  async fallbackGoalExtraction(pageData, setAsActive = true) {
    const goalText = `Working on: ${pageData.title}`;
    const keywords = this.extractKeywordsSimple(pageData.title + ' ' + pageData.text);

    const newGoal = await storage.addGoal({
      text: goalText,
      keywords: keywords,
      basePageUrl: pageData.url,
      basePageTitle: pageData.title,
      isActive: setAsActive
    });

    return newGoal;
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
   * Update a goal manually
   */
  async updateGoal(goalId, updates) {
    return await storage.updateGoal(goalId, updates);
  }

  /**
   * Get all goals
   */
  async getAllGoals() {
    return await storage.getAllGoals();
  }

  /**
   * Get active goals (for backward compatibility, returns first active goal or null)
   */
  async getCurrentGoal() {
    const activeGoals = await storage.getActiveGoals();
    return activeGoals.length > 0 ? activeGoals[0] : null;
  }

  /**
   * Get all active goals
   */
  async getActiveGoals() {
    return await storage.getActiveGoals();
  }

  /**
   * Delete a goal
   */
  async deleteGoal(goalId) {
    return await storage.deleteGoal(goalId);
  }

  /**
   * Mark goal as done
   */
  async markGoalDone(goalId) {
    return await storage.markGoalDone(goalId);
  }

  /**
   * Toggle goal active state
   */
  async toggleGoalActive(goalId) {
    return await storage.toggleGoalActive(goalId);
  }

  /**
   * Clear current goal (legacy - kept for backward compatibility)
   */
  async clearGoal() {
    // Deactivate all goals
    const goals = await storage.getAllGoals();
    const goalIds = goals.map(g => g.id);
    await storage.setActiveGoals([]);
    return true;
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
   * Evaluate if current page is relevant to any active goals
   * Returns: {score, label, reason, matchedGoals}
   */
  async evaluatePage(pageData, goals = null) {
    try {
      Logger.info('Evaluating page relevance', pageData.title);

      // Get active goals if not provided
      if (!goals) {
        goals = await storage.getActiveGoals();
      }

      // Handle array or single goal for backward compatibility
      if (!Array.isArray(goals)) {
        goals = [goals];
      }

      // If no goals, return neutral
      if (goals.length === 0) {
        return {
          score: 1.0,
          label: 'no-goal',
          reason: 'No active goals',
          matchedGoals: []
        };
      }

      // Evaluate against each goal
      const evaluations = [];
      for (const goal of goals) {
        const evaluation = await this.evaluatePageForGoal(pageData, goal);
        evaluations.push({ ...evaluation, goalId: goal.id, goalText: goal.text });
      }

      // Find the best match (highest score)
      const bestMatch = evaluations.reduce((best, current) =>
        current.score > best.score ? current : best
      );

      // Return best evaluation with list of matched goals
      const matchedGoals = evaluations
        .filter(e => e.label === 'relevant')
        .map(e => ({ id: e.goalId, text: e.goalText, score: e.score }));

      return {
        score: bestMatch.score,
        label: bestMatch.label,
        reason: bestMatch.reason,
        matchedGoals: matchedGoals,
        evaluations: evaluations // Include all evaluations for reference
      };

    } catch (error) {
      Logger.error('Failed to evaluate page', error);
      return {
        score: 0.5,
        label: 'error',
        reason: 'Evaluation failed',
        matchedGoals: []
      };
    }
  }

  /**
   * Evaluate page relevance for a single goal
   */
  async evaluatePageForGoal(pageData, goal) {
    try {
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
      Logger.debug('AI Request (Summarize - Page Evaluation)', { text: pageData.text.substring(0, 500) + '...' });
      const pageSummary = await this.aiManager.summarize(pageData.text);
      Logger.debug('AI Response (Summarize - Page Evaluation)', pageSummary);

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

      Logger.debug('AI Request (Prompt - Evaluate Page)', promptText);
      const response = await this.aiManager.prompt(promptText);
      Logger.debug('AI Response (Prompt - Evaluate Page)', response);
      const evaluation = this.parseEvaluationResponse(response);

      Logger.debug('AI evaluation', evaluation);
      return evaluation;

    } catch (error) {
      Logger.error('Failed to evaluate page for goal', error);
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

      // Validate session times
      if (!session.startTime || !session.endTime || session.endTime < session.startTime) {
        Logger.error('Invalid session times', { startTime: session.startTime, endTime: session.endTime });
        // Fix the session times if possible
        if (!session.endTime) {
          session.endTime = Date.now();
        }
        if (!session.startTime || session.startTime > session.endTime) {
          session.startTime = session.endTime - 60000; // Assume 1 minute session
        }
      }

      // Analyze pages by time spent
      const pageAnalysis = this.analyzePagesByTime(session.pagesVisited || []);

      if (!this.aiManager.isAvailable()) {
        return this.fallbackReview(session, goal, pageAnalysis);
      }

      // Build session summary
      const duration = session.endTime - session.startTime;
      const pagesCount = session.pagesVisited?.length || 0;
      const distractionsCount = session.distractions || 0;

      // Build detailed page breakdown for AI
      const topNormalPages = pageAnalysis.topNormalPages.slice(0, 3)
        .map(p => `${p.title} (${this.formatTime(p.dwellTime)})`)
        .join(', ');

      const topDistractionPages = pageAnalysis.topDistractionPages.slice(0, 3)
        .map(p => `${p.title} (${this.formatTime(p.dwellTime)})`)
        .join(', ');

      const promptText = `Generate a brief focus session review in English.

Goal: ${goal.text}
Duration: ${Math.floor(duration / 60000)} minutes
Pages visited: ${pagesCount}
Distractions detected: ${distractionsCount}
Interventions: ${session.interventions || 0}

Time on relevant pages: ${this.formatTime(pageAnalysis.totalRelevantTime)}
Top relevant pages: ${topNormalPages || 'None'}

Time on distracting pages: ${this.formatTime(pageAnalysis.totalDistractionTime)}
Top distracting pages: ${topDistractionPages || 'None'}

Create a review with:
1. A brief summary highlighting productivity (1-2 sentences)
2. Key accomplishment or observation about focus quality
3. One actionable suggestion for the next session

Format as 3 bullet points, clear and motivational.`;

      Logger.debug('AI Request (Write - Generate Review)', promptText);
      const review = await this.aiManager.write(promptText);
      Logger.debug('AI Response (Write - Generate Review)', review);

      Logger.info('Review generated', review);
      return {
        summary: review,
        pageAnalysis: pageAnalysis,
        timestamp: Date.now()
      };

    } catch (error) {
      Logger.error('Failed to generate review', error);
      return this.fallbackReview(session, goal, this.analyzePagesByTime(session.pagesVisited || []));
    }
  }

  /**
   * Analyze pages by time spent and categorize them
   */
  analyzePagesByTime(pages) {
    const settings = CONSTANTS.RELEVANCE_THRESHOLD || 0.6;

    // Separate pages into relevant and distracting
    const relevantPages = pages.filter(p => p.relevanceScore >= settings);
    const distractingPages = pages.filter(p => p.relevanceScore < settings);

    // Sort by dwell time (descending)
    const topNormalPages = relevantPages
      .sort((a, b) => (b.dwellTime || 0) - (a.dwellTime || 0));

    const topDistractionPages = distractingPages
      .sort((a, b) => (b.dwellTime || 0) - (a.dwellTime || 0));

    // Calculate total time spent
    const totalRelevantTime = relevantPages.reduce((sum, p) => sum + (p.dwellTime || 0), 0);
    const totalDistractionTime = distractingPages.reduce((sum, p) => sum + (p.dwellTime || 0), 0);

    return {
      topNormalPages,
      topDistractionPages,
      totalRelevantTime,
      totalDistractionTime,
      focusPercentage: totalRelevantTime + totalDistractionTime > 0
        ? (totalRelevantTime / (totalRelevantTime + totalDistractionTime) * 100).toFixed(1)
        : 100
    };
  }

  /**
   * Format time in milliseconds to human-readable format
   */
  formatTime(ms) {
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
   * Fallback review without AI
   */
  fallbackReview(session, goal, pageAnalysis) {
    // Validate and calculate duration safely
    let duration = 0;
    if (session.startTime && session.endTime && session.endTime > session.startTime) {
      duration = Math.floor((session.endTime - session.startTime) / 60000);
    } else {
      Logger.warn('Invalid session duration in fallback review', {
        startTime: session.startTime,
        endTime: session.endTime
      });
      // Estimate based on page dwell times if available
      if (pageAnalysis && pageAnalysis.totalRelevantTime + pageAnalysis.totalDistractionTime > 0) {
        duration = Math.floor((pageAnalysis.totalRelevantTime + pageAnalysis.totalDistractionTime) / 60000);
      }
    }

    const pagesCount = session.pagesVisited?.length || 0;
    const distractionsCount = session.distractions || 0;

    let summary = `• You worked on "${goal.text}" for ${duration} minutes\n`;
    summary += `• Visited ${pagesCount} pages with ${distractionsCount} distractions detected\n`;

    if (pageAnalysis) {
      summary += `• Focus score: ${pageAnalysis.focusPercentage}% - ${pageAnalysis.focusPercentage >= 70 ? 'Great focus!' : 'Try reducing distractions next time'}`;
    } else {
      summary += `• ${distractionsCount < 3 ? 'Great focus!' : 'Try reducing distractions next time'}`;
    }

    return {
      summary,
      pageAnalysis: pageAnalysis || this.analyzePagesByTime(session.pagesVisited || []),
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

