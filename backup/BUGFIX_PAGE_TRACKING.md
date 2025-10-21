# Bug Fix: Page Tracking and Distraction Detection

## Issues Fixed

### 1. **Content Script Not Injected in Existing Tabs**
**Problem**: Content scripts only load automatically in new pages. If you loaded the extension and then switched to an already-open tab, the content script wasn't present.

**Solution**: Added `ensureContentScript()` function that:
- Pings the content script to check if it's loaded
- If not present, programmatically injects it using `chrome.scripting.executeScript()`

### 2. **Page Navigation Not Tracked**
**Problem**: The extension only listened for tab switches (`chrome.tabs.onActivated`) but not for page navigation within the same tab.

**Solution**: Added `chrome.tabs.onUpdated` listener that:
- Detects when a page finishes loading (`status === 'complete'`)
- Triggers evaluation for the new page

### 3. **Content Script Created Throwaway Analyzers**
**Problem**: When receiving `START_EVALUATION` message, the content script created a new `PageAnalyzer` instance that immediately went out of scope.

**Solution**: 
- Store a global `PageAnalyzer` instance (`globalAnalyzer`)
- Reuse the same analyzer across evaluations
- Reset evaluation state when a new page is loaded

### 4. **Dwell Time Check Too Strict**
**Problem**: Manually triggered evaluations (from tab switching) would fail the 5-second dwell time check.

**Solution**:
- Reduced dwell time threshold to 3 seconds
- Added `skipDwellCheck` parameter to `performEvaluation()`
- Skip dwell time check for manually triggered evaluations

## Files Modified

1. **manifest.json**
   - Added `"scripting"` permission for dynamic content script injection

2. **background/service-worker.js**
   - Added `ensureContentScript()` function
   - Added `triggerPageEvaluation()` function
   - Enhanced `chrome.tabs.onActivated` listener
   - Added `chrome.tabs.onUpdated` listener for page navigation

3. **background/content-script.js**
   - Added global `globalAnalyzer` variable
   - Added `PING` message handler
   - Fixed `START_EVALUATION` to reuse analyzer
   - Added `skipDwellCheck` parameter to `performEvaluation()`
   - Improved logging with URL and dwell time

## Testing Instructions

### 1. Reload the Extension
1. Go to `chrome://extensions/`
2. Find "Chrome Focus Assistant"
3. Click the reload icon

### 2. Test Page Tracking
1. **Set a Goal**:
   - Open the extension popup
   - Click "Set Goal from Current Page"
   - Make sure AI status shows "AI Ready"

2. **Start a Session**:
   - Click "Start Focus Session"
   - Verify session stats show "0 pages" and "0 distractions"

3. **Test Tab Switching**:
   - Open a new tab with a distracting website (e.g., YouTube, social media)
   - Switch to that tab
   - Wait 2-3 seconds
   - Check browser console (F12) for `[Focus Assistant] Evaluating page...`
   - Open the extension popup to verify page count increased

4. **Test Page Navigation**:
   - Stay in the same tab
   - Navigate to a different page
   - Wait for page to finish loading
   - Check console for evaluation messages
   - Verify page count increases in popup

5. **Test Distraction Detection**:
   - Navigate to a clearly distracting site
   - If the AI determines it's distracting, you should see:
     - Console log with evaluation result
     - Possible notification (if intervention is enabled)
     - Orange "⚠️ Possible distraction" indicator on the page
     - Distraction count increased in popup

### 3. Debug Information
Open the browser console in any tab to see detailed logs:
- `[Focus Assistant] Content script initialized`
- `[Focus Assistant] Evaluating page...`
- `[Focus Assistant] Evaluation result: {...}`

Open the service worker console (`chrome://extensions/` → "Inspect views: service worker"):
- `Tab activated: <tabId>`
- `Tab updated (navigation): {...}`
- `Triggered evaluation for tab: <tabId>`

## Known Limitations

1. **Chrome-specific URLs are excluded**: Extension pages, settings, and chrome:// URLs won't be tracked (by design)
2. **AI Availability**: Requires Chrome Canary with AI APIs enabled
3. **Initial delay**: First evaluation after tab switch has a 1-second delay to let page settle

## Next Steps

If pages are still not being tracked:
1. Check that detection is enabled in settings
2. Verify AI status shows "AI Ready" in popup
3. Check browser console for error messages
4. Make sure you have an active goal and session

