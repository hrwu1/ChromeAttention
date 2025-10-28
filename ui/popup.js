// Popup UI controller for Chrome Focus Assistant

let allGoals = [];
let activeGoals = [];
let currentGoal = null;  // Legacy - first active goal
let currentSession = null;
let settings = null;
let sessionUpdateInterval = null;
let editingGoalId = null;  // Track which goal is being edited

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');
  await loadData();
  setupEventListeners();
  startSessionUpdateLoop();
});

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadData() {
  try {
    // Check AI status
    const aiStatus = await sendMessage('CHECK_AI_STATUS');
    updateAIStatus(aiStatus);
    
    // Load all data
    const data = await sendMessage('GET_STORAGE_DATA');
    allGoals = data.goals || [];
    activeGoals = data.activeGoals || [];
    currentGoal = data.goal;  // Legacy - first active goal
    currentSession = data.session;
    settings = data.settings;
    
    // Update UI
    updateGoalsUI();
    updateSessionUI();
    updateMainStatus();
    
  } catch (error) {
    console.error('Failed to load data:', error);
    showError('Failed to load data');
  }
}

// ============================================================================
// UI UPDATES
// ============================================================================

function updateAIStatus(status) {
  const { available, capabilities } = status;
  
  // Update status indicator
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const setupPrompt = document.getElementById('aiSetupPrompt');
  
  if (available) {
    statusIndicator.className = 'status-indicator active';
    statusText.textContent = 'AI Ready';
    setupPrompt.style.display = 'none';
  } else {
    statusIndicator.className = 'status-indicator inactive';
    statusText.textContent = 'AI Not Available';
    // Show setup instructions if no AI is available
    if (!capabilities.languageModel && !capabilities.summarizer && !capabilities.writer) {
      setupPrompt.style.display = 'block';
    }
  }
  
  // Update individual AI components
  document.getElementById('aiLanguageModel').textContent = 
    capabilities.languageModel ? '✓ Ready' : '✗ Not Available';
  document.getElementById('aiSummarizer').textContent = 
    capabilities.summarizer ? '✓ Ready' : '✗ Not Available';
  document.getElementById('aiWriter').textContent = 
    capabilities.writer ? '✓ Ready' : '✗ Not Available';
}

function updateMainStatus() {
  const statusText = document.getElementById('statusText');
  const activeCount = allGoals.filter(g => g.isActive && !g.isDone).length;
  
  if (currentSession) {
    statusText.textContent = 'Active Session';
    document.getElementById('statusIndicator').className = 'status-indicator active';
  } else if (activeCount > 0) {
    statusText.textContent = `${activeCount} Active Goal${activeCount > 1 ? 's' : ''}`;
    document.getElementById('statusIndicator').className = 'status-indicator warning';
  } else {
    statusText.textContent = 'Ready';
    document.getElementById('statusIndicator').className = 'status-indicator';
  }
}

function updateGoalsUI() {
  const noGoals = document.getElementById('noGoals');
  const goalsList = document.getElementById('goalsList');
  const startSessionBtn = document.getElementById('startSessionBtn');
  const activeGoalsSummary = document.getElementById('activeGoalsSummary');
  const activeGoalsCount = document.getElementById('activeGoalsCount');
  
  if (allGoals.length === 0) {
    noGoals.style.display = 'block';
    goalsList.style.display = 'none';
    activeGoalsSummary.style.display = 'none';
    startSessionBtn.disabled = true;
  } else {
    noGoals.style.display = 'none';
    goalsList.style.display = 'block';
    activeGoalsSummary.style.display = 'block';
    
    // Render goals list
    goalsList.innerHTML = '';
    
    // Separate active and completed goals
    const activeGoalsList = allGoals.filter(g => !g.isDone);
    const doneGoalsList = allGoals.filter(g => g.isDone);
    
    // Render active goals
    activeGoalsList.forEach(goal => {
      const goalItem = createGoalElement(goal);
      goalsList.appendChild(goalItem);
    });
    
    // Render completed goals (if any)
    if (doneGoalsList.length > 0) {
      const doneHeader = document.createElement('div');
      doneHeader.className = 'goals-section-header';
      doneHeader.textContent = 'Completed';
      goalsList.appendChild(doneHeader);
      
      doneGoalsList.forEach(goal => {
        const goalItem = createGoalElement(goal);
        goalsList.appendChild(goalItem);
      });
    }
    
    // Update active goals count
    const activeCount = allGoals.filter(g => g.isActive && !g.isDone).length;
    activeGoalsCount.textContent = activeCount;
    startSessionBtn.disabled = activeCount === 0;
  }
}

function createGoalElement(goal) {
  const goalItem = document.createElement('div');
  goalItem.className = 'goal-item' + (goal.isDone ? ' goal-done' : '');
  goalItem.dataset.goalId = goal.id;
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'goal-checkbox';
  checkbox.checked = goal.isActive && !goal.isDone;
  checkbox.disabled = goal.isDone;
  checkbox.addEventListener('change', () => handleToggleGoalActive(goal.id));
  
  const goalContent = document.createElement('div');
  goalContent.className = 'goal-content';
  
  const goalText = document.createElement('div');
  goalText.className = 'goal-text';
  goalText.textContent = goal.text;
  goalContent.appendChild(goalText);
  
  // Show base page info if available
  if (goal.basePageTitle && goal.basePageUrl) {
    const basePageInfo = document.createElement('div');
    basePageInfo.className = 'goal-base-page';
    basePageInfo.innerHTML = `📄 <a href="${goal.basePageUrl}" target="_blank" title="${goal.basePageUrl}">${goal.basePageTitle}</a>`;
    goalContent.appendChild(basePageInfo);
  }
  
  const goalKeywords = document.createElement('div');
  goalKeywords.className = 'goal-keywords';
  if (goal.keywords && goal.keywords.length > 0) {
    goal.keywords.slice(0, 5).forEach(keyword => {
      const tag = document.createElement('span');
      tag.className = 'keyword-tag';
      tag.textContent = keyword;
      goalKeywords.appendChild(tag);
    });
  }
  goalContent.appendChild(goalKeywords);
  
  const goalActions = document.createElement('div');
  goalActions.className = 'goal-actions';
  
  if (!goal.isDone) {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', () => handleEditGoal(goal.id));
    goalActions.appendChild(editBtn);
    
    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn-icon';
    doneBtn.textContent = '✓';
    doneBtn.title = 'Mark as done';
    doneBtn.addEventListener('click', () => handleMarkGoalDone(goal.id));
    goalActions.appendChild(doneBtn);
  }
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-icon';
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', () => handleDeleteGoal(goal.id));
  goalActions.appendChild(deleteBtn);
  
  goalItem.appendChild(checkbox);
  goalItem.appendChild(goalContent);
  goalItem.appendChild(goalActions);
  
  return goalItem;
}

function updateSessionUI() {
  const noSession = document.getElementById('noSession');
  const sessionDisplay = document.getElementById('sessionDisplay');
  
  if (currentSession) {
    noSession.style.display = 'none';
    sessionDisplay.style.display = 'block';
    
    // Update stats
    const duration = Date.now() - currentSession.startTime;
    const minutes = Math.floor(duration / 60000);
    const hours = Math.floor(minutes / 60);
    
    document.getElementById('sessionDuration').textContent = 
      hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
    
    document.getElementById('sessionPages').textContent = 
      (currentSession.pagesVisited?.length || 0).toString();
    
    document.getElementById('sessionDistractions').textContent = 
      (currentSession.distractions || 0).toString();
    
  } else {
    noSession.style.display = 'block';
    sessionDisplay.style.display = 'none';
  }
}

function startSessionUpdateLoop() {
  // Update session stats every second if active
  sessionUpdateInterval = setInterval(() => {
    if (currentSession) {
      updateSessionUI();
    }
  }, 1000);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Goal actions
  document.getElementById('addGoalBtn').addEventListener('click', showAddGoalModal);
  document.getElementById('setGoalFromPageBtn').addEventListener('click', handleSetGoalFromPage);
  document.getElementById('saveGoalBtn').addEventListener('click', handleSaveGoal);
  document.getElementById('cancelGoalBtn').addEventListener('click', hideGoalModal);
  
  // Session actions
  document.getElementById('startSessionBtn').addEventListener('click', handleStartSession);
  document.getElementById('endSessionBtn').addEventListener('click', handleEndSession);
  
  // Quick actions
  document.getElementById('viewHistoryBtn').addEventListener('click', showHistory);
  document.getElementById('settingsBtn').addEventListener('click', showSettings);
  
  // Settings
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('cancelSettingsBtn').addEventListener('click', hideSettings);
  document.getElementById('thresholdSlider').addEventListener('input', (e) => {
    document.getElementById('thresholdValue').textContent = e.target.value;
  });
  document.getElementById('cooldownSlider').addEventListener('input', (e) => {
    document.getElementById('cooldownValue').textContent = e.target.value;
  });
  
  // History
  document.getElementById('closeHistoryBtn').addEventListener('click', hideHistory);
  
  // Review
  document.getElementById('closeReviewBtn').addEventListener('click', hideReview);
}

// ============================================================================
// GOAL ACTIONS
// ============================================================================

function showAddGoalModal() {
  editingGoalId = null;
  document.getElementById('goalModalTitle').textContent = 'Add New Goal';
  document.getElementById('goalTextInput').value = '';
  document.getElementById('goalKeywordsInput').value = '';
  document.getElementById('goalModal').style.display = 'flex';
}

function hideGoalModal() {
  document.getElementById('goalModal').style.display = 'none';
  editingGoalId = null;
}

async function handleSetGoalFromPage() {
  try {
    showLoading('Extracting goal from current page...');
    
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Extract page data
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_PAGE_DATA'
    });
    
    if (!response.success) {
      throw new Error('Failed to extract page data');
    }
    
    // Extract goal and add to list
    const newGoal = await sendMessage('EXTRACT_GOAL', { 
      pageData: response.data,
      setAsActive: true 
    });
    
    // Reload data and update UI
    await loadData();
    hideLoading();
    
    showSuccess('Goal added successfully!');
    
  } catch (error) {
    console.error('Failed to set goal:', error);
    hideLoading();
    showError('Failed to set goal. Make sure the page is loaded.');
  }
}

async function handleSaveGoal() {
  const goalText = document.getElementById('goalTextInput').value.trim();
  const keywordsInput = document.getElementById('goalKeywordsInput').value.trim();
  const keywords = keywordsInput ? keywordsInput.split(',').map(k => k.trim()) : [];
  
  if (!goalText) {
    showError('Please enter a goal description');
    return;
  }
  
  try {
    if (editingGoalId) {
      // Update existing goal
      await sendMessage('UPDATE_GOAL', {
        goalId: editingGoalId,
        updates: { text: goalText, keywords: keywords }
      });
      showSuccess('Goal updated!');
    } else {
      // Add new goal
      await sendMessage('ADD_GOAL', {
        goalData: { text: goalText, keywords: keywords, isActive: false }
      });
      showSuccess('Goal added!');
    }
    
    hideGoalModal();
    await loadData();
    
  } catch (error) {
    console.error('Failed to save goal:', error);
    showError('Failed to save goal');
  }
}

async function handleEditGoal(goalId) {
  const goal = allGoals.find(g => g.id === goalId);
  if (!goal) return;
  
  editingGoalId = goalId;
  document.getElementById('goalModalTitle').textContent = 'Edit Goal';
  document.getElementById('goalTextInput').value = goal.text;
  document.getElementById('goalKeywordsInput').value = goal.keywords ? goal.keywords.join(', ') : '';
  document.getElementById('goalModal').style.display = 'flex';
}

async function handleDeleteGoal(goalId) {
  if (!confirm('Are you sure you want to delete this goal?')) {
    return;
  }
  
  try {
    await sendMessage('DELETE_GOAL', { goalId });
    await loadData();
    showSuccess('Goal deleted');
  } catch (error) {
    console.error('Failed to delete goal:', error);
    showError('Failed to delete goal');
  }
}

async function handleMarkGoalDone(goalId) {
  try {
    await sendMessage('MARK_GOAL_DONE', { goalId });
    await loadData();
    showSuccess('Goal marked as done!');
  } catch (error) {
    console.error('Failed to mark goal as done:', error);
    showError('Failed to mark goal as done');
  }
}

async function handleToggleGoalActive(goalId) {
  try {
    await sendMessage('TOGGLE_GOAL_ACTIVE', { goalId });
    await loadData();
  } catch (error) {
    console.error('Failed to toggle goal:', error);
    showError('Failed to toggle goal');
  }
}

// ============================================================================
// SESSION ACTIONS
// ============================================================================

async function handleStartSession() {
  try {
    const session = await sendMessage('START_SESSION');
    currentSession = session;
    updateSessionUI();
    updateMainStatus();
    showSuccess('Focus session started!');
    
  } catch (error) {
    console.error('Failed to start session:', error);
    showError(error.message || 'Failed to start session');
  }
}

async function handleEndSession() {
  if (!confirm('End current focus session?')) {
    return;
  }
  
  try {
    showLoading('Generating session review...');
    
    const endedSession = await sendMessage('END_SESSION');
    currentSession = null;
    
    updateSessionUI();
    updateMainStatus();
    hideLoading();
    
    // Show review
    if (endedSession && endedSession.review) {
      showReview(endedSession);
    } else {
      showSuccess('Session ended');
    }
    
  } catch (error) {
    console.error('Failed to end session:', error);
    hideLoading();
    showError('Failed to end session');
  }
}

// ============================================================================
// SETTINGS
// ============================================================================

async function showSettings() {
  document.getElementById('settingsPanel').style.display = 'block';
  
  // Load current settings
  const currentSettings = await sendMessage('GET_SETTINGS');
  
  document.getElementById('enabledCheckbox').checked = currentSettings.enabled;
  document.getElementById('autoGoalCheckbox').checked = currentSettings.autoGoalSetting;
  document.getElementById('detectionCheckbox').checked = currentSettings.detectionEnabled;
  document.getElementById('interventionCheckbox').checked = currentSettings.interventionEnabled;
  document.getElementById('thresholdSlider').value = currentSettings.relevanceThreshold;
  document.getElementById('thresholdValue').textContent = currentSettings.relevanceThreshold;
  
  // Convert notification cooldown from milliseconds to minutes for display
  const cooldownMinutes = Math.round(currentSettings.notificationCooldown / 60000);
  document.getElementById('cooldownSlider').value = cooldownMinutes;
  document.getElementById('cooldownValue').textContent = cooldownMinutes;
}

function hideSettings() {
  document.getElementById('settingsPanel').style.display = 'none';
}

async function saveSettings() {
  try {
    // Convert notification cooldown from minutes to milliseconds
    const cooldownMinutes = parseInt(document.getElementById('cooldownSlider').value);
    const cooldownMs = cooldownMinutes * 60000;
    
    const newSettings = {
      enabled: document.getElementById('enabledCheckbox').checked,
      autoGoalSetting: document.getElementById('autoGoalCheckbox').checked,
      detectionEnabled: document.getElementById('detectionCheckbox').checked,
      interventionEnabled: document.getElementById('interventionCheckbox').checked,
      relevanceThreshold: parseFloat(document.getElementById('thresholdSlider').value),
      notificationCooldown: cooldownMs
    };
    
    await sendMessage('UPDATE_SETTINGS', { settings: newSettings });
    settings = newSettings;
    
    hideSettings();
    showSuccess('Settings saved!');
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    showError('Failed to save settings');
  }
}

// ============================================================================
// HISTORY
// ============================================================================

async function showHistory() {
  document.getElementById('historyPanel').style.display = 'block';
  
  try {
    const history = await sendMessage('GET_SESSION_HISTORY', { limit: 10 });
    const historyContent = document.getElementById('historyContent');
    
    if (history.length === 0) {
      historyContent.innerHTML = '<p class="no-data">No session history yet</p>';
      return;
    }
    
    historyContent.innerHTML = history.map(session => {
      // Safely calculate duration
      let duration = 0;
      if (session.startTime && session.endTime && session.endTime > session.startTime) {
        duration = Math.floor((session.endTime - session.startTime) / 60000);
      }
      
      const date = session.startTime ? new Date(session.startTime).toLocaleDateString() : 'Unknown date';
      
      return `
        <div class="history-item">
          <div class="history-date">${date}</div>
          <div class="history-stats">
            <span>${duration}m</span>
            <span>${session.pagesVisited?.length || 0} pages</span>
            <span>${session.distractions || 0} distractions</span>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Failed to load history:', error);
    document.getElementById('historyContent').innerHTML = 
      '<p class="error">Failed to load history</p>';
  }
}

function hideHistory() {
  document.getElementById('historyPanel').style.display = 'none';
}

// ============================================================================
// REVIEW
// ============================================================================

function showReview(session) {
  document.getElementById('reviewSection').style.display = 'block';
  
  const reviewContent = document.getElementById('reviewContent');
  
  if (session.review) {
    // Safely calculate duration
    let duration = 0;
    if (session.startTime && session.endTime && session.endTime > session.startTime) {
      duration = Math.floor((session.endTime - session.startTime) / 60000);
    } else {
      console.warn('Invalid session times in popup', { 
        startTime: session.startTime, 
        endTime: session.endTime,
        sessionId: session.id 
      });
    }
    
    const pageAnalysis = session.review.pageAnalysis;
    
    let html = `
      <div class="review-text">${session.review.summary.replace(/\n/g, '<br>')}</div>
      <div class="review-stats">
        <p><strong>Duration:</strong> ${duration} minutes</p>
        <p><strong>Pages Visited:</strong> ${session.pagesVisited?.length || 0}</p>
        <p><strong>Distractions:</strong> ${session.distractions || 0}</p>
    `;
    
    // Add page analysis if available
    if (pageAnalysis) {
      html += `
        <p><strong>Focus Score:</strong> ${pageAnalysis.focusPercentage}%</p>
      </div>
      
      <div class="review-section">
        <h4>⭐ Top Relevant Pages</h4>
        <div class="page-list">
      `;
      
      if (pageAnalysis.topNormalPages.length > 0) {
        pageAnalysis.topNormalPages.slice(0, 5).forEach(page => {
          const timeSpent = formatDwellTime(page.dwellTime);
          const displayUrl = page.baseUrl || page.url;
          const visitInfo = page.visitCount > 1 ? ` (${page.visitCount} visits)` : '';
          html += `
            <div class="page-item">
              <div class="page-info">
                <div class="page-title" title="${displayUrl}">${truncateText(page.title, 40)}</div>
                ${visitInfo ? `<div class="page-visits">${visitInfo}</div>` : ''}
              </div>
              <div class="page-time">${timeSpent}</div>
            </div>
          `;
        });
      } else {
        html += '<p class="no-data">No relevant pages tracked</p>';
      }
      
      html += `
        </div>
      </div>
      
      <div class="review-section">
        <h4>⚠️ Top Distraction Pages</h4>
        <div class="page-list">
      `;
      
      if (pageAnalysis.topDistractionPages.length > 0) {
        pageAnalysis.topDistractionPages.slice(0, 5).forEach(page => {
          const timeSpent = formatDwellTime(page.dwellTime);
          const displayUrl = page.baseUrl || page.url;
          const visitInfo = page.visitCount > 1 ? ` (${page.visitCount} visits)` : '';
          html += `
            <div class="page-item distraction">
              <div class="page-info">
                <div class="page-title" title="${displayUrl}">${truncateText(page.title, 40)}</div>
                ${visitInfo ? `<div class="page-visits">${visitInfo}</div>` : ''}
              </div>
              <div class="page-time">${timeSpent}</div>
            </div>
          `;
        });
      } else {
        html += '<p class="no-data">No distractions! Great job! 🎉</p>';
      }
      
      html += `
        </div>
      </div>
      `;
    } else {
      html += '</div>';
    }
    
    reviewContent.innerHTML = html;
  } else {
    reviewContent.innerHTML = '<p>Session completed successfully!</p>';
  }
}

function formatDwellTime(ms) {
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

function truncateText(text, maxLength) {
  if (!text) return 'Untitled';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function hideReview() {
  document.getElementById('reviewSection').style.display = 'none';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function sendMessage(type, data = {}) {
  const response = await chrome.runtime.sendMessage({ type, data });
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data;
}

function showLoading(message) {
  // Simple loading indication - could be enhanced
  console.log('Loading:', message);
}

function hideLoading() {
  console.log('Loading complete');
}

function showSuccess(message) {
  // Simple success message - could be enhanced with a toast
  console.log('Success:', message);
  alert(message);
}

function showError(message) {
  console.error('Error:', message);
  alert('Error: ' + message);
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (sessionUpdateInterval) {
    clearInterval(sessionUpdateInterval);
  }
});

