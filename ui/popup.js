// Popup UI controller for Chrome Focus Assistant

let currentGoal = null;
let currentSession = null;
let settings = null;
let sessionUpdateInterval = null;

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
    currentGoal = data.goal;
    currentSession = data.session;
    settings = data.settings;
    
    // Update UI
    updateGoalUI();
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
  
  if (available) {
    statusIndicator.className = 'status-indicator active';
    statusText.textContent = 'AI Ready';
  } else {
    statusIndicator.className = 'status-indicator inactive';
    statusText.textContent = 'AI Not Available';
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
  
  if (currentSession) {
    statusText.textContent = 'Active Session';
    document.getElementById('statusIndicator').className = 'status-indicator active';
  } else if (currentGoal) {
    statusText.textContent = 'Goal Set';
    document.getElementById('statusIndicator').className = 'status-indicator warning';
  } else {
    statusText.textContent = 'Ready';
    document.getElementById('statusIndicator').className = 'status-indicator';
  }
}

function updateGoalUI() {
  const noGoal = document.getElementById('noGoal');
  const goalDisplay = document.getElementById('goalDisplay');
  const startSessionBtn = document.getElementById('startSessionBtn');
  
  if (currentGoal) {
    noGoal.style.display = 'none';
    goalDisplay.style.display = 'block';
    
    document.getElementById('goalText').textContent = currentGoal.text;
    
    // Show keywords
    const keywordsContainer = document.getElementById('goalKeywords');
    keywordsContainer.innerHTML = '';
    if (currentGoal.keywords && currentGoal.keywords.length > 0) {
      currentGoal.keywords.slice(0, 5).forEach(keyword => {
        const tag = document.createElement('span');
        tag.className = 'keyword-tag';
        tag.textContent = keyword;
        keywordsContainer.appendChild(tag);
      });
    }
    
    startSessionBtn.disabled = false;
  } else {
    noGoal.style.display = 'block';
    goalDisplay.style.display = 'none';
    startSessionBtn.disabled = true;
  }
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
  document.getElementById('setGoalBtn').addEventListener('click', handleSetGoal);
  document.getElementById('editGoalBtn').addEventListener('click', handleEditGoal);
  document.getElementById('clearGoalBtn').addEventListener('click', handleClearGoal);
  
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
  
  // History
  document.getElementById('closeHistoryBtn').addEventListener('click', hideHistory);
  
  // Review
  document.getElementById('closeReviewBtn').addEventListener('click', hideReview);
}

// ============================================================================
// GOAL ACTIONS
// ============================================================================

async function handleSetGoal() {
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
    
    // Extract goal
    const goal = await sendMessage('EXTRACT_GOAL', { pageData: response.data });
    currentGoal = goal;
    
    updateGoalUI();
    updateMainStatus();
    hideLoading();
    
    showSuccess('Goal set successfully!');
    
  } catch (error) {
    console.error('Failed to set goal:', error);
    hideLoading();
    showError('Failed to set goal. Make sure the page is loaded.');
  }
}

async function handleEditGoal() {
  const newGoalText = prompt('Edit your goal:', currentGoal.text);
  
  if (newGoalText && newGoalText.trim()) {
    try {
      await sendMessage('UPDATE_GOAL', {
        text: newGoalText.trim(),
        keywords: currentGoal.keywords
      });
      
      currentGoal.text = newGoalText.trim();
      updateGoalUI();
      showSuccess('Goal updated!');
      
    } catch (error) {
      console.error('Failed to update goal:', error);
      showError('Failed to update goal');
    }
  }
}

async function handleClearGoal() {
  if (!confirm('Are you sure you want to clear the current goal?')) {
    return;
  }
  
  try {
    await sendMessage('CLEAR_GOAL');
    currentGoal = null;
    updateGoalUI();
    updateMainStatus();
    showSuccess('Goal cleared');
    
  } catch (error) {
    console.error('Failed to clear goal:', error);
    showError('Failed to clear goal');
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
}

function hideSettings() {
  document.getElementById('settingsPanel').style.display = 'none';
}

async function saveSettings() {
  try {
    const newSettings = {
      enabled: document.getElementById('enabledCheckbox').checked,
      autoGoalSetting: document.getElementById('autoGoalCheckbox').checked,
      detectionEnabled: document.getElementById('detectionCheckbox').checked,
      interventionEnabled: document.getElementById('interventionCheckbox').checked,
      relevanceThreshold: parseFloat(document.getElementById('thresholdSlider').value)
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
      const duration = Math.floor((session.endTime - session.startTime) / 60000);
      const date = new Date(session.startTime).toLocaleDateString();
      
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
    reviewContent.innerHTML = `
      <div class="review-text">${session.review.summary.replace(/\n/g, '<br>')}</div>
      <div class="review-stats">
        <p><strong>Duration:</strong> ${Math.floor((session.endTime - session.startTime) / 60000)} minutes</p>
        <p><strong>Pages Visited:</strong> ${session.pagesVisited?.length || 0}</p>
        <p><strong>Distractions:</strong> ${session.distractions || 0}</p>
      </div>
    `;
  } else {
    reviewContent.innerHTML = '<p>Session completed successfully!</p>';
  }
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

