// Sidebar UI controller for Chrome Focus Assistant

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
    console.log('Sidebar loaded');
    await loadData();
    setupEventListeners();
    startSessionUpdateLoop();
    setupCollapsibleSections();
    setupTabs();
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
// TABS
// ============================================================================

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    // Load settings when switching to settings tab
    if (tabName === 'settings') {
        loadSettingsIntoTab();
    }

    // Load analytics when switching to analytics tab
    if (tabName === 'analytics') {
        loadAnalytics();
    }
}

// ============================================================================
// COLLAPSIBLE SECTIONS
// ============================================================================

function setupCollapsibleSections() {
    const aiStatusHeader = document.getElementById('aiStatusHeader');
    if (aiStatusHeader) {
        // Check if it's the new collapsible design or old section design
        const aiStatusCollapsible = document.getElementById('aiStatusCollapsible');
        const aiStatusSection = aiStatusHeader.closest('.section');

        aiStatusHeader.addEventListener('click', () => {
            if (aiStatusCollapsible) {
                aiStatusCollapsible.classList.toggle('collapsed');
            } else if (aiStatusSection) {
                aiStatusSection.classList.toggle('collapsed');
            }
        });

        // Start collapsed by default
        if (aiStatusCollapsible) {
            aiStatusCollapsible.classList.add('collapsed');
        } else if (aiStatusSection) {
            aiStatusSection.classList.add('collapsed');
        }
    }
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
    document.getElementById('closeGoalModalBtn').addEventListener('click', hideGoalModal);

    // Session actions
    document.getElementById('startSessionBtn').addEventListener('click', handleStartSession);
    document.getElementById('endSessionBtn').addEventListener('click', handleEndSession);

    // Quick actions
    document.getElementById('viewHistoryBtn').addEventListener('click', showHistory);

    // Settings (in tab)
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
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

    // Close overlays on background click
    document.getElementById('historyPanel').addEventListener('click', (e) => {
        if (e.target.id === 'historyPanel') hideHistory();
    });
    document.getElementById('goalModal').addEventListener('click', (e) => {
        if (e.target.id === 'goalModal') hideGoalModal();
    });
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
        console.log('[Sidebar] Current tab:', tab.id, tab.url);

        // Extract page data
        console.log('[Sidebar] Sending EXTRACT_PAGE_DATA to tab', tab.id);
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'EXTRACT_PAGE_DATA'
        });

        console.log('[Sidebar] Received response:', response);

        if (!response || !response.success) {
            throw new Error('Failed to extract page data');
        }

        console.log('[Sidebar] Page data:', {
            title: response.data.title,
            textLength: response.data.text?.length || 0
        });

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
        showError('Failed to set goal. Make sure the page is loaded and not a chrome:// page.');
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

async function loadSettingsIntoTab() {
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

    // Set intensity selector if it exists
    const intensitySelect = document.getElementById('intensitySelect');
    if (intensitySelect) {
        // Map settings to intensity level (you can customize this logic)
        if (currentSettings.relevanceThreshold >= 0.7) {
            intensitySelect.value = 'strict';
        } else if (currentSettings.relevanceThreshold <= 0.4) {
            intensitySelect.value = 'light';
        } else {
            intensitySelect.value = 'balanced';
        }
    }
}

async function saveSettings() {
    try {
        // Convert notification cooldown from minutes to milliseconds
        const cooldownMinutes = parseInt(document.getElementById('cooldownSlider').value);
        const cooldownMs = cooldownMinutes * 60000;

        // Get intensity level and adjust threshold accordingly
        const intensitySelect = document.getElementById('intensitySelect');
        let threshold = parseFloat(document.getElementById('thresholdSlider').value);

        if (intensitySelect) {
            const intensity = intensitySelect.value;
            if (intensity === 'strict') {
                threshold = Math.max(threshold, 0.7);
            } else if (intensity === 'light') {
                threshold = Math.min(threshold, 0.4);
            }
        }

        const newSettings = {
            enabled: document.getElementById('enabledCheckbox').checked,
            autoGoalSetting: document.getElementById('autoGoalCheckbox').checked,
            detectionEnabled: document.getElementById('detectionCheckbox').checked,
            interventionEnabled: document.getElementById('interventionCheckbox').checked,
            relevanceThreshold: threshold,
            notificationCooldown: cooldownMs
        };

        await sendMessage('UPDATE_SETTINGS', { settings: newSettings });
        settings = newSettings;

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
    document.getElementById('historyPanel').style.display = 'flex';

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
            console.warn('Invalid session times', { startTime: session.startTime, endTime: session.endTime });
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
                <div class="page-title" title="${displayUrl}">${truncateText(page.title, 50)}</div>
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
                <div class="page-title" title="${displayUrl}">${truncateText(page.title, 50)}</div>
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
      `;
        } else {
            html += '</div>';
        }

        reviewContent.innerHTML = html;
    } else {
        reviewContent.innerHTML = '<p>Session completed successfully!</p>';
    }

    // Scroll to review section
    document.getElementById('reviewSection').scrollIntoView({ behavior: 'smooth' });
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
// ANALYTICS
// ============================================================================

async function loadAnalytics() {
    try {
        const history = await sendMessage('GET_SESSION_HISTORY', { limit: 50 });

        // Calculate analytics data
        const analytics = calculateAnalytics(history);

        // Update UI
        updateLastSessionCard(analytics.lastSession);
        updateTodayStats(analytics.today);
        renderWeekChart(analytics.week);
        renderDistractionsChart(analytics.distractions);
        updateSummary(analytics.summary);

    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

function calculateAnalytics(history) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - (6 * 24 * 60 * 60 * 1000); // 7 days ago

    // Last session
    const lastSession = history[0] || null;

    // Today's sessions
    const todaySessions = history.filter(s => s.startTime >= todayStart);
    const todayTime = todaySessions.reduce((sum, s) => {
        if (s.endTime && s.startTime) {
            return sum + (s.endTime - s.startTime);
        }
        return sum;
    }, 0);
    const todayTasks = todaySessions.length;
    const todayNudges = todaySessions.reduce((sum, s) => sum + (s.distractions || 0), 0);

    // Week data (last 7 days)
    const weekSessions = history.filter(s => s.startTime >= weekStart);
    const weekByDay = {};
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // Initialize all days
    for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart + (i * 24 * 60 * 60 * 1000));
        const dayKey = dayDate.toDateString();
        weekByDay[dayKey] = 0;
    }

    // Fill in actual data
    weekSessions.forEach(session => {
        if (session.endTime && session.startTime) {
            const dayKey = new Date(session.startTime).toDateString();
            const hours = (session.endTime - session.startTime) / (1000 * 60 * 60);
            weekByDay[dayKey] = (weekByDay[dayKey] || 0) + hours;
        }
    });

    const weekData = Object.keys(weekByDay).sort().map(key => weekByDay[key]);

    // Distractions by category
    const distractionCategories = {};
    weekSessions.forEach(session => {
        if (session.pagesVisited) {
            session.pagesVisited.forEach(page => {
                if (page.isDistraction) {
                    // Simple categorization based on URL
                    let category = 'other';
                    const url = page.url.toLowerCase();
                    if (url.includes('news') || url.includes('reddit') || url.includes('twitter')) {
                        category = 'news';
                    } else if (url.includes('facebook') || url.includes('instagram') || url.includes('social')) {
                        category = 'social';
                    } else if (url.includes('youtube') || url.includes('video')) {
                        category = 'video';
                    }

                    const time = page.dwellTime || 0;
                    distractionCategories[category] = (distractionCategories[category] || 0) + time;
                }
            });
        }
    });

    // Week total time
    const weekTotal = weekSessions.reduce((sum, s) => {
        if (s.endTime && s.startTime) {
            return sum + (s.endTime - s.startTime);
        }
        return sum;
    }, 0);

    return {
        lastSession: lastSession,
        today: {
            time: todayTime,
            tasks: todayTasks,
            nudges: todayNudges
        },
        week: weekData,
        distractions: distractionCategories,
        summary: {
            weekTotal: weekTotal,
            sessions: weekSessions.length,
            activeTasks: allGoals.filter(g => g.isActive && !g.isDone).length
        }
    };
}

function updateLastSessionCard(session) {
    const card = document.getElementById('lastSessionCard');

    if (!session || !session.endTime) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';

    // Goal name
    const goalText = session.goals && session.goals.length > 0
        ? session.goals[0].text
        : 'Focus Session';
    document.getElementById('lastSessionGoal').textContent = goalText;

    // Calculate times
    const totalTime = session.endTime - session.startTime;
    const distractionTime = (session.pagesVisited || [])
        .filter(p => p.isDistraction)
        .reduce((sum, p) => sum + (p.dwellTime || 0), 0);
    const focusTime = totalTime - distractionTime;
    const efficiency = totalTime > 0 ? Math.round((focusTime / totalTime) * 100) : 100;

    document.getElementById('lastSessionTime').textContent = formatDwellTime(totalTime);
    document.getElementById('lastSessionFocus').textContent = formatDwellTime(focusTime);
    document.getElementById('lastSessionDistractions').textContent =
        `Total distraction time: ${formatDwellTime(distractionTime)}`;
    document.getElementById('lastSessionInterruptions').textContent =
        `${session.distractions || 0} interruptions`;
    document.getElementById('lastSessionEfficiency').textContent = `${efficiency}%`;
}

function updateTodayStats(today) {
    document.getElementById('todayTime').textContent = formatDwellTime(today.time);
    document.getElementById('todayTasks').textContent = today.tasks.toString();
    document.getElementById('todayNudges').textContent = today.nudges.toString();
}

function renderWeekChart(weekData) {
    const canvas = document.getElementById('weekChart');
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 40;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    const maxValue = Math.max(...weekData, 0.3); // Minimum scale
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // Draw axes
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = '#f5f5f5';
    for (let i = 0; i <= 4; i++) {
        const y = padding + (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + width, y);
        ctx.stroke();
    }

    // Draw line chart
    ctx.strokeStyle = '#667eea';
    ctx.fillStyle = 'rgba(102, 126, 234, 0.1)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(padding, padding + height);

    weekData.forEach((value, index) => {
        const x = padding + (width / (weekData.length - 1)) * index;
        const y = padding + height - (value / maxValue) * height;

        if (index === 0) {
            ctx.lineTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.lineTo(padding + width, padding + height);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.beginPath();
    weekData.forEach((value, index) => {
        const x = padding + (width / (weekData.length - 1)) * index;
        const y = padding + height - (value / maxValue) * height;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#667eea';
    weekData.forEach((value, index) => {
        const x = padding + (width / (weekData.length - 1)) * index;
        const y = padding + height - (value / maxValue) * height;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = '#666';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'center';

    days.forEach((day, index) => {
        const x = padding + (width / (weekData.length - 1)) * index;
        ctx.fillText(day, x, padding + height + 20);
    });

    // Draw y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const value = (maxValue / 4) * (4 - i);
        const y = padding + (height / 4) * i;
        ctx.fillText(value.toFixed(1), padding - 10, y + 4);
    }
}

function renderDistractionsChart(distractions) {
    const canvas = document.getElementById('distractionsChart');
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const categories = Object.keys(distractions);

    if (categories.length === 0) {
        // Show "no data" message
        ctx.fillStyle = '#999';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('No distractions tracked', canvas.width / 2, canvas.height / 2);
        return;
    }

    const padding = 40;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    const maxValue = Math.max(...Object.values(distractions));
    const barWidth = width / categories.length - 20;

    // Draw bars
    categories.forEach((category, index) => {
        const value = distractions[category];
        const barHeight = (value / maxValue) * height;
        const x = padding + (width / categories.length) * index + 10;
        const y = padding + height - barHeight;

        // Draw bar
        ctx.fillStyle = '#667eea';
        ctx.fillRect(x, y, barWidth, barHeight);

        // Draw label
        ctx.fillStyle = '#666';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        ctx.textAlign = 'center';
        ctx.fillText(category, x + barWidth / 2, padding + height + 20);
    });

    // Draw y-axis
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();
}

function updateSummary(summary) {
    document.getElementById('summaryWeekTotal').textContent = formatDwellTime(summary.weekTotal);
    document.getElementById('summarySessions').textContent = summary.sessions.toString();
    document.getElementById('summaryActiveTasks').textContent = summary.activeTasks.toString();
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
    console.log('Loading:', message);
    // Could add a loading overlay in the future
}

function hideLoading() {
    console.log('Loading complete');
}

function showSuccess(message) {
    console.log('Success:', message);
    // Simple toast notification
    showToast(message, 'success');
}

function showError(message) {
    console.error('Error:', message);
    showToast('Error: ' + message, 'error');
}

function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#667eea'};
    color: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-size: 14px;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;
    toast.textContent = message;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (sessionUpdateInterval) {
        clearInterval(sessionUpdateInterval);
    }
});
