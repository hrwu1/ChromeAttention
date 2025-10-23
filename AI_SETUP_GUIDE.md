# Chrome AI (Gemini Nano) Setup Guide

This extension uses Chrome's built-in AI capabilities powered by Gemini Nano. To use these features, you need to enable them in your Chrome browser.

## Requirements

- **Chrome Version**: 127 or higher (Check your version at `chrome://version/`)
- **Operating System**: Windows, macOS, or Linux
- **Disk Space**: ~1-2 GB for the AI model download

## Setup Steps

### Step 1: Enable Chrome Flags

1. Open a new tab and navigate to: `chrome://flags/`

2. Search for and enable the following flags:
   - **Prompt API for Gemini Nano**: `chrome://flags/#prompt-api-for-gemini-nano`
     - Set to: **Enabled**
   
   - **Optimization Guide On Device Model**: `chrome://flags/#optimization-guide-on-device-model`
     - Set to: **Enabled BypassPerfRequirement**

3. Click **Relaunch** button at the bottom to restart Chrome

### Step 2: Download the AI Model

1. After Chrome restarts, navigate to: `chrome://components/`

2. Find "**Optimization Guide On Device Model**" in the list

3. Click the **Check for update** button next to it

4. Wait for the model to download (this may take several minutes, ~1-2 GB)
   - The version number should update when download is complete
   - You can check the status in the component details

### Step 3: Verify AI Availability

1. Open Chrome DevTools (F12) in any tab

2. Run the following command in the Console:
   ```javascript
   await ai.languageModel.capabilities()
   ```

3. If successful, you should see:
   ```javascript
   { available: "readily" }
   ```

4. If you see `{ available: "after-download" }`, wait a bit longer for the download to complete

### Step 4: Enable in Extension

1. Click on the Focus Assistant extension icon

2. Check the **AI Status** section in the popup

3. You should see:
   - ✓ Language Model: Ready
   - ✓ Summarizer: Ready
   - ✓ Writer: Ready

## Troubleshooting

### AI Shows as "Not Available"

1. **Check Chrome Version**: Ensure you're running Chrome 127+
   - Visit `chrome://version/`

2. **Verify Flags are Enabled**:
   - Visit `chrome://flags/` and confirm both flags are enabled
   - Make sure you restarted Chrome after enabling

3. **Check Model Download**:
   - Visit `chrome://components/`
   - Look for "Optimization Guide On Device Model"
   - If version shows "0.0.0.0", the model hasn't downloaded yet
   - Click "Check for update" and wait

4. **Check Debug Logs**:
   - Visit `chrome://on-device-internals/`
   - Select "Event Logs" to see debug information
   - Look for any error messages related to Gemini Nano

5. **System Requirements**:
   - Ensure you have enough disk space (~2 GB free)
   - Some features may require specific hardware capabilities

### Model Download is Stuck

1. Restart Chrome completely (close all windows)
2. Visit `chrome://components/` again
3. Try "Check for update" again
4. If still stuck, try clearing browser cache and restart

### Features Not Working After Setup

1. **Reload the Extension**:
   - Visit `chrome://extensions/`
   - Find "Chrome Focus Assistant"
   - Click the refresh/reload icon

2. **Check Extension Console**:
   - Visit `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Inspect views: service worker" under the extension
   - Look for AI-related error messages in the console

3. **Try a Simple Test**:
   - Open the extension popup
   - Try the "From Page" button to extract a goal from the current page
   - Check if AI features work

## What Features Use AI?

Once enabled, the following features will use on-device AI:

1. **Automatic Goal Extraction**: Uses AI to understand the current page and suggest a goal
2. **Page Relevance Detection**: Evaluates if pages are relevant to your goals
3. **Session Review Generation**: Creates intelligent summaries of your focus sessions
4. **Smart Suggestions**: Provides personalized recommendations

## Privacy Note

All AI processing happens **locally on your device** using Gemini Nano. Your data is:
- ✓ Processed entirely offline
- ✓ Never sent to external servers
- ✓ Kept private and secure

## Additional Resources

- [Chrome AI Documentation](https://developer.chrome.com/docs/ai/)
- [Gemini Nano Debug Guide](https://developer.chrome.com/docs/ai/debug-gemini-nano)
- [Chrome AI Help](https://chromeai.org/help)

## Still Having Issues?

If you've followed all steps and AI features still don't work:

1. Check if your Chrome build supports AI (some builds may not have it enabled)
2. Try Chrome Canary or Chrome Dev channel
3. Report the issue on the extension's GitHub page with:
   - Chrome version
   - Operating system
   - Console error messages (from extension service worker)

