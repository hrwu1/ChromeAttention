# Chrome AI (Gemini Nano) Setup Guide

This extension uses Chrome's built-in AI capabilities powered by Gemini Nano. To use these features, you need to enable them in your Chrome browser.

## Requirements

⚠️ **IMPORTANT: Hardware Requirements**

The AI features will NOT work if your system doesn't meet these requirements:

- **Chrome Version**: 128+ (138+ recommended for stable APIs)
- **Operating System**: 
  - Windows 10 or 11
  - macOS 13+ (Ventura or newer)
  - Linux
  - ChromeOS (Platform 16389.0.0+) on Chromebook Plus
- **Storage**: **22 GB free space** on the volume containing your Chrome profile
  - This is MORE than the model size (~1-2 GB)
  - Chrome needs this space for model management
- **GPU**: **4 GB+ VRAM required**
  - Integrated GPUs may not work
  - Dedicated GPU recommended
- **Network**: Unmetered internet connection for initial download

**🔴 If these requirements aren't met, the "Optimization Guide On Device Model" component will NOT appear in `chrome://components/`**

## Setup Steps

> **Good News for Chrome 138+ Users!** 🎉  
> If you're using Chrome 138 or higher, the Prompt API for Extensions is **stable** and may work without enabling flags. However, we still recommend enabling flags for the best experience and to ensure all AI features work properly.

### Step 1: Enable Chrome Flags

1. Open a new tab and navigate to: `chrome://flags/`

2. Search for and enable the following flags:
   - **Prompt API for Gemini Nano**: `chrome://flags/#prompt-api-for-gemini-nano`
     - Set to: **Enabled**
   
   - **Optimization Guide On Device Model**: `chrome://flags/#optimization-guide-on-device-model`
     - Set to: **Enabled BypassPerfRequirement**

3. Click **Relaunch** button at the bottom to restart Chrome

### Step 2: Model Download

**📌 Important Note About Chrome 138+**

In Chrome 138+, the model downloads **automatically** when you first use an AI feature. You don't need to manually check `chrome://components/`!

**If you want to verify manually** (optional):

1. Navigate to: `chrome://components/`

2. Look for "**Optimization Guide On Device Model**" in the list

3. **If you DON'T see it:**
   - ⚠️ Your system may not meet hardware requirements (see Requirements section above)
   - Check: 22GB free space? 4GB+ VRAM? Correct OS?
   - The component only appears if requirements are met

4. **If you DO see it:**
   - Click "Check for update" to download manually
   - Wait for download (~1-2 GB, may take several minutes)
   - Version number should update when complete

**Alternative Verification Method** (recommended):
- The extension will trigger automatic download on first use
- Check the extension's service worker console for download status
- The model will download in the background when needed

### Step 3: Verify AI Availability

1. Open Chrome DevTools (F12) in any tab

2. Run the following command in the Console:
   ```javascript
   // Try direct API access (most common)
   await LanguageModel.availability()
   
   // OR try namespace access (alternative)
   await window.ai.languageModel.capabilities()
   ```
   
   **Note:** Direct API classes use `availability()`, namespace APIs use `capabilities()`

3. Possible responses:
   - **Direct API**: Returns string directly: `"available"` ✅
   - **Namespace API**: Returns object: `{ available: "readily" }` ✅
   - `"no"` or `{ available: "no" }` - ❌ Hardware requirements not met

**Important Discovery:** The AI APIs are available as **direct global classes** (`LanguageModel`, `Summarizer`, etc.) rather than under a namespace object (`ai.languageModel`). Both access methods may work depending on your Chrome version.

4. **If the command works:**
   - ✅ AI is enabled and working!
   - The extension will now detect and use the AI APIs
   - You can proceed to use the extension

5. If you see `"after-download"`:
   - This is **NORMAL** in Chrome 138+
   - The model downloads automatically when you first use the extension
   - Just start using the AI features, download happens in background

6. If you see `"no"` or get an error:
   - Check hardware requirements (22GB free space, 4GB+ VRAM)
   - Verify your OS is supported
   - Check if you have enough disk space in your Chrome profile directory
   - Try: `await LanguageModel.availability()` (alternative method)

### Step 4: Enable in Extension

1. Click on the Focus Assistant extension icon

2. Check the **AI Status** section in the popup

3. You should see:
   - ✓ Language Model: Ready
   - ✓ Summarizer: Ready
   - ✓ Writer: Ready

## Troubleshooting

### "Optimization Guide On Device Model" Component Not Showing

**This is the #1 issue users face!**

If you don't see the component in `chrome://components/`, it's usually because:

1. **❌ Insufficient Disk Space**
   - You need **22 GB free** on the drive with your Chrome profile
   - Not just 1-2 GB for the model - Chrome needs extra space for management
   - Check: Right-click drive → Properties → See free space
   - **Solution**: Free up disk space to at least 22 GB

2. **❌ Insufficient GPU VRAM**
   - You need **4 GB+ VRAM**
   - Integrated GPUs (Intel HD Graphics) often don't have enough
   - Check your GPU: Task Manager → Performance → GPU → Dedicated GPU Memory
   - **Solution**: Use a system with a dedicated GPU

3. **❌ Unsupported OS**
   - Windows 9 and below: Not supported
   - macOS 12 and below: Not supported
   - **Solution**: Update your OS or use a supported system

4. **✅ Chrome 138+ Automatic Download**
   - In Chrome 138+, you don't need to see the component
   - The model downloads automatically when you first use AI
   - Just enable flags and start using the extension

### AI Shows as "Not Available"

1. **Check Hardware Requirements FIRST** ⚠️
   - 22 GB free disk space on Chrome profile volume
   - 4 GB+ GPU VRAM
   - This is the most common reason for failure

2. **Check Chrome Version**: Ensure you're running Chrome 128+ (138+ recommended)
   - Visit `chrome://version/`
   - For stable APIs without flags, you need Chrome 138+

3. **Verify Flags are Enabled**:
   - Visit `chrome://flags/` and confirm both flags are enabled
   - Make sure you restarted Chrome after enabling

3. **Check Model Download** (Optional in Chrome 138+):
   - Visit `chrome://components/`
   - Look for "Optimization Guide On Device Model"
   - **If you don't see it**: Check hardware requirements above
   - If version shows "0.0.0.0", the model hasn't downloaded yet
   - Click "Check for update" and wait
   - **In Chrome 138+**: Model auto-downloads, component may not appear

4. **Check Debug Logs**:
   - Visit `chrome://on-device-internals/`
   - Select "Event Logs" to see debug information
   - Look for any error messages related to Gemini Nano

5. **System Requirements**:
   - Ensure you have enough disk space (~2 GB free)
   - Some features may require specific hardware capabilities

### Model Download is Stuck or Component Not Appearing

**If hardware requirements are met, flags are enabled, but model still won't download:**

1. **Force Download via Console** (Recommended):
   - Open DevTools (F12) on any page
   - Paste this code in the Console:
   ```javascript
   const session = await LanguageModel.create({
     monitor(m) {
       m.addEventListener('downloadprogress', (e) => {
         console.log(`Downloaded ${e.loaded} of ${e.total} bytes (${(e.loaded/e.total*100).toFixed(1)}%)`);
       });
     },
   });
   ```
   - This will trigger the model download and show progress
   - Wait for download to complete (may take several minutes for ~1-2 GB)
   - Once complete, the extension should detect AI availability

2. **Alternative Methods**:
   - Restart Chrome completely (close all windows)
   - Visit `chrome://components/` and click "Check for update"
   - Clear browser cache and restart
   - Try using the extension's AI features (triggers auto-download)

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
   - Open DevTools console and run: `await LanguageModel.availability()`
   - Should return: `"available"` (not `"no"`)
   - Open the extension popup
   - Try the "From Page" button to extract a goal from the current page
   - Check if AI features work

4. **Force Download if Needed**:
   - If requirements are met but model won't download automatically
   - Use the force download method above (see "Model Download is Stuck")

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

