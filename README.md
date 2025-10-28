# Chrome Focus Assistant

Attention is All You Need!

An intelligent focus assistant that leverages Google Chrome's built-in AI (Gemini Nano) to help users stay focused by automatically understanding work goals, detecting distractions, and providing gentle interventions.

## Features

- **Automatic Goal Setting**: AI automatically infers your current task from page content
- **Semantic Detection**: Understands whether pages are relevant to your goals
- **Personalized Learning**: Adapts to your feedback over time
- **Gentle Interventions**: Non-intrusive notifications and optional blocking
- **Session Reviews**: Generates English summaries and action plans
- **Privacy-First**: All AI processing happens locally on your device

## Project Structure

```
ChromeAttention/
├── manifest.json                 # Manifest V3 configuration
├── README.md                     # This file
├── rules.json                    # DeclarativeNetRequest rules
├── background/                   # All extension scripts
│   ├── service-worker.js        # Background service worker + AI Manager
│   ├── modules.js               # All 5 focus modules (Goal, Detection, Learning, Intervention, Review)
│   ├── storage.js               # Storage manager + data schemas
│   ├── content-script.js        # Content script + page analyzer
│   └── utils.js                 # Logger, constants, and helper functions
├── ui/                           # User interface
│   ├── sidebar.html             # Extension sidebar UI
│   ├── sidebar.js               # Sidebar controller
│   ├── sidebar.css              # Sidebar styling
│   ├── popup.html               # Legacy popup UI (deprecated)
│   ├── popup.js                 # Legacy popup controller (deprecated)
│   ├── popup.css                # Legacy popup styling (deprecated)
│   └── blocked.html             # Blocked page display
└── icons/                        # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Architecture Overview

### Background Modules (background/modules.js)

1. **GoalManager**: Automatically extracts and manages work/study goals
   - Uses Summarizer + Prompt APIs to infer goals from page content
   - Maintains goal state and keywords

2. **DetectionEngine**: Evaluates page relevance to current goals
   - Semantic analysis using Summarizer + Prompt APIs
   - Combines with behavioral signals (dwell time, activity)

3. **LearningEngine**: Personalizes detection over time
   - Few-shot learning from user feedback
   - Adapts thresholds based on accuracy

4. **InterventionManager**: Provides gentle reminders and optional blocking
   - Chrome notifications for non-intrusive alerts
   - DeclarativeNetRequest for temporary blocking

5. **ReviewGenerator**: Creates session summaries
   - Uses Writer/Rewriter APIs for English summaries
   - Generates actionable next steps

### Communication Flow

```
User browses page
    ↓
Content Script extracts content → Background Service Worker
    ↓
AI Manager processes with Gemini Nano
    ↓
Detection Engine evaluates relevance
    ↓
Intervention Manager (if distracted) → Notification
    ↓
User provides feedback → Learning Engine
```

## Setup Instructions

### Prerequisites

⚠️ **Hardware Requirements** (IMPORTANT!)

- **Chrome Version**: 128+ minimum, 138+ recommended for stable APIs
- **Storage**: **22 GB free space** on Chrome profile volume (not just model size!)
- **GPU**: **4 GB+ VRAM** (dedicated GPU recommended, integrated GPUs may not work)
- **OS**: Windows 10/11, macOS 13+ (Ventura+), Linux, or ChromeOS 16389+
- **Network**: Unmetered connection for initial download

**Note**: If these requirements aren't met, AI features won't work and the model component won't appear in `chrome://components/`.

### Quick Setup

**For detailed setup instructions, see [AI_SETUP_GUIDE.md](AI_SETUP_GUIDE.md)**

1. **Enable Chrome AI Features**
   - Visit `chrome://flags/#prompt-api-for-gemini-nano` → Enable
   - Visit `chrome://flags/#optimization-guide-on-device-model` → Enable BypassPerfRequirement
   - Restart Chrome

2. **Model Download**
   - **Chrome 138+**: Model downloads automatically on first use (no manual step needed!)
   - **Optional manual check**: Visit `chrome://components/` → "Optimization Guide On Device Model" → "Check for update"
   - **Component not showing?** Check hardware requirements above (especially 22GB free space and 4GB+ VRAM)

3. **Install Extension**
   - Clone this repository
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `ChromeAttention` directory

4. **Verify AI is Working**
   - Open DevTools (F12) and run: `await LanguageModel.availability()`
   - Should return: `"available"` ✅
   - If not, see [AI_SETUP_GUIDE.md](AI_SETUP_GUIDE.md) for force download method

5. **Install & Test Extension**
   - Click the extension icon to open the sidebar
   - Check "AI Status" section - should show "✓ Ready" for Language Model and Summarizer
   - Try "From Page" button to test AI goal extraction
   - If not available, check extension service worker console for detailed logs

## Development Workflow

### Incremental Implementation Plan

The project is designed for incremental development:

1. **Phase 1 - Foundation** (Current)
   - Project structure ✓
   - AI API integration
   - Storage layer
   - Basic popup UI

2. **Phase 2 - Module 1: Goal Setting**
   - Implement automatic goal extraction
   - Test with Summarizer + Prompt APIs

3. **Phase 3 - Module 2: Detection**
   - Implement semantic relevance checking
   - Integrate behavioral signals

4. **Phase 4 - Module 4: Intervention**
   - Add notification system
   - Implement optional blocking

5. **Phase 5 - Module 3: Learning**
   - Add feedback collection
   - Implement few-shot learning

6. **Phase 6 - Module 5: Review**
   - Session tracking
   - Summary generation with Writer API

### Testing

Each module can be tested independently:

```javascript
// In popup or background console
const goalManager = new GoalManager();
await goalManager.extractGoalFromPage(tabId);

const detectionEngine = new DetectionEngine();
const score = await detectionEngine.evaluatePage(pageContent, currentGoal);
```

### Debugging

Use the built-in logger:

```javascript
// In any module
Logger.info('Module initialized');
Logger.debug('Processing content', { content });
Logger.error('API call failed', error);
```

View logs in:
- Background: Right-click extension icon → "Inspect service worker"
- Content: Regular DevTools console
- Popup: Right-click popup → "Inspect"

## Chrome AI API Usage

**Note:** The AI APIs are available as **direct global classes** (`LanguageModel`, `Summarizer`, etc.) in Chrome extensions. The extension automatically detects and uses the correct access pattern.

### Example: Language Model (Prompt API)

```javascript
// Check availability
const status = await LanguageModel.availability();  // Returns: "available", "no"

// Create session
const session = await LanguageModel.create({
  systemPrompt: "You are a focus assistant...",
  temperature: 0.7
});

// Use it
const response = await session.prompt("Is this page relevant to goal X?");
```

### Example: Summarizer API

```javascript
// Check availability
const status = await Summarizer.availability();

// Create summarizer
const summarizer = await Summarizer.create();
const summary = await summarizer.summarize(pageText);
```

### Example: Writer API

```javascript
// Check availability
const status = await Writer.availability();

// Create writer
const writer = await Writer.create({
  tone: "neutral",
  length: "short"
});
const summary = await writer.write("Summarize this focus session...");
```

### Force Model Download

If the model won't download automatically, use this in DevTools console:

```javascript
const session = await LanguageModel.create({
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${e.loaded} of ${e.total} bytes`);
    });
  },
});
```

## Privacy & Security

- **100% Local Processing**: All AI inference runs on-device via Gemini Nano
- **No Cloud Uploads**: Page content never leaves your machine
- **Minimal Permissions**: Only accesses tabs when actively analyzing
- **User Control**: All features can be toggled on/off
- **Data Storage**: All data stored locally using chrome.storage.local

## Troubleshooting

### AI APIs Not Available

**See [AI_SETUP_GUIDE.md](AI_SETUP_GUIDE.md) for detailed troubleshooting steps.**

Quick checks:
1. **Check Chrome Version**: 128+ (138+ recommended) at `chrome://version/`
2. **Verify Flags**: Both flags enabled at `chrome://flags/` and Chrome restarted
3. **Check Hardware**: 22GB free space, 4GB+ GPU VRAM
4. **Test API**: Run `await LanguageModel.availability()` in console
   - Should return: `"available"` (if ready)
   - If returns: `"no"` → Check hardware requirements
5. **Check Component** (optional): `chrome://components/` → "Optimization Guide On Device Model"
6. **Force Download** (if needed): Use the LanguageModel.create() code with monitor callback (see AI API examples)
7. **Debug Logs**: Check `chrome://on-device-internals/` for errors

### Extension Not Loading

- Check for errors in `chrome://extensions`
- Click "Inspect views: service worker" to see background console logs
- Look for AI-related errors in service worker console
- Reload the extension after enabling AI features

### Content Script Not Running

- Check the page URL is not restricted (chrome://, edge://, etc.)
- Look for errors in page DevTools console
- Verify host_permissions in manifest.json
- Try injecting manually from service worker console

## Contributing

This is a modular architecture designed for incremental development. Each module in `background/modules.js` can be implemented and tested independently.

## License

MIT License - See LICENSE file for details

