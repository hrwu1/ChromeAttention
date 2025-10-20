# Quick Start Guide

Get the Chrome Focus Assistant up and running in 5 minutes!

## Prerequisites

- Chrome Canary or Chrome Dev (version 128+)
- Windows, macOS, or Linux

## Step 1: Enable Chrome AI (5 minutes)

1. **Install Chrome Canary** (if not already installed):
   - Download from: https://www.google.com/chrome/canary/

2. **Enable AI Feature Flags**:
   
   Open these URLs in Chrome Canary and set each to **Enabled**:
   
   ```
   chrome://flags/#optimization-guide-on-device-model
   chrome://flags/#prompt-api-for-gemini-nano
   chrome://flags/#summarization-api-for-gemini-nano
   chrome://flags/#writer-api-for-gemini-nano
   chrome://flags/#rewriter-api-for-gemini-nano
   ```

3. **Restart Chrome** when prompted

4. **Download Gemini Nano Model**:
   - Open DevTools (F12) on any page
   - Run in console:
     ```javascript
     await ai.languageModel.create()
     ```
   - Wait for model download (may take 5-10 minutes)
   - You'll see a progress indicator in Chrome

## Step 2: Install Extension (30 seconds)

1. **Navigate to Extensions Page**:
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**:
   - Toggle switch in top-right corner

3. **Load Extension**:
   - Click "Load unpacked"
   - Select the `ChromeAttention` folder
   - Extension should appear in your toolbar

## Step 3: Verify Installation (30 seconds)

1. **Click Extension Icon** in toolbar
2. Check **AI Status** section - should show "✓ Ready" for all components
3. If not ready, review Step 1

## Step 4: First Use (1 minute)

### Set Your First Goal

1. **Open a work-related page** (e.g., documentation, GitHub, project notes)
2. **Click extension icon**
3. Click **"Set Goal from Current Page"**
4. Wait a few seconds - AI will extract your goal

### Start a Focus Session

1. With goal set, click **"Start Session"**
2. Browse normally
3. Extension will monitor your pages and alert if distracted
4. Click **"End Session"** when done to get a review

## Understanding the Interface

### Main Popup

**Status Indicator** (top):
- 🟢 Green = Active session
- 🟡 Yellow = Goal set, no session
- ⚪ White = Ready

**AI Status**:
- Shows which AI components are available
- All should show "✓ Ready"

**Current Goal**:
- Your active focus objective
- Keywords extracted by AI
- Edit or clear as needed

**Focus Session**:
- Duration, pages visited, distractions
- Real-time statistics

### Quick Actions

- **View History**: See past focus sessions
- **Settings**: Customize behavior

## Settings

Click **Settings** to customize:

- ✅ **Enable Focus Assistant**: Master on/off switch
- ✅ **Automatic Goal Setting**: AI extracts goals automatically
- ✅ **Distraction Detection**: Monitor page relevance
- ✅ **Show Interventions**: Get notifications for distractions
- 🎚️ **Relevance Threshold**: Sensitivity (0.3-0.9)

## How It Works

### 1. Automatic Goal Detection
- AI analyzes your current page
- Extracts likely work/study objective
- No manual input required

### 2. Intelligent Monitoring
- Watches pages you visit
- Uses AI to understand content semantically
- Not just URL blocking - understands meaning

### 3. Gentle Interventions
- Non-intrusive notifications
- Only when truly off-track
- Respects cooldown periods

### 4. Learning from Feedback
- Click notification buttons to provide feedback
- System adapts to your preferences
- Fewer false alerts over time

### 5. Session Reviews
- AI generates English summaries
- Key accomplishments
- Actionable next steps

## Tips for Best Results

### 1. Start with Clear Goals
- Use focused, specific pages when setting goals
- Example: Technical documentation, project specs, study materials
- Avoid generic pages like search results

### 2. Provide Feedback
- When you get a notification, click "It's Relevant" if the system is wrong
- This helps the AI learn your patterns
- After 5-10 feedback instances, accuracy improves significantly

### 3. Adjust Threshold
- If too many false alerts: Increase threshold (0.7-0.8)
- If missing distractions: Decrease threshold (0.4-0.5)
- Default 0.6 works for most users

### 4. Use Sessions Intentionally
- Start session when beginning focused work
- End session when taking a break or switching tasks
- Review helps reinforce what you accomplished

### 5. Customize Intervention Style
- Disable interventions if they're disruptive
- Keep detection on to track distractions passively
- Review statistics later to understand patterns

## Troubleshooting

### AI Not Available

**Problem**: AI Status shows "✗ Not Available"

**Solution**:
1. Verify Chrome Canary version 128+
2. Check all flags are enabled
3. Run model download command again
4. Wait for download to complete (check Downloads page)

### No Goal Extracted

**Problem**: "Set Goal from Current Page" doesn't work

**Solution**:
1. Make sure page has loaded completely
2. Try a page with more text content
3. Avoid restricted pages (chrome://, settings, etc.)
4. Check console for errors (F12)

### Notifications Not Showing

**Problem**: No distraction alerts

**Solution**:
1. Check Chrome notification permissions
2. Verify "Show Interventions" is enabled in Settings
3. Check if notification cooldown is active (5 min default)
4. System may be correctly detecting pages as relevant

### Extension Not Loading

**Problem**: Extension shows errors or doesn't appear

**Solution**:
1. Check `chrome://extensions/` for error messages
2. Verify all files are present in the folder
3. Make sure icons exist (`icons/icon16.png`, etc.)
4. Try removing and re-adding the extension

## Examples

### For Students
1. **Set Goal**: Open course syllabus or assignment page
2. **Start Session**: Begin study session
3. **Get Alerts**: System warns if you drift to social media
4. **End Session**: Review shows what you studied

### For Developers
1. **Set Goal**: Open GitHub issue or project documentation
2. **Start Session**: Begin coding
3. **Get Alerts**: System warns if you browse unrelated topics
4. **End Session**: Review summarizes what you worked on

### For Researchers
1. **Set Goal**: Open research paper or notes
2. **Start Session**: Begin reading/writing
3. **Get Alerts**: System warns if browsing gets off-topic
4. **End Session**: Review helps track research progress

## Next Steps

- **Explore Settings**: Customize to your preferences
- **Use for a Week**: Let the AI learn your patterns
- **Check History**: Review your focus trends
- **Adjust Threshold**: Fine-tune for your needs

## Need Help?

- Check `README.md` for detailed documentation
- See `DEVELOPMENT.md` for technical details
- Open an issue on GitHub for bugs
- Review console logs for errors

---

Happy focusing! 🎯

