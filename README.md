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
│   ├── popup.html               # Extension popup UI
│   ├── popup.js                 # Popup controller
│   ├── popup.css                # Popup styling
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

- **Chrome Version**: 127 or higher (Stable, Dev, or Canary)
- **Disk Space**: ~1-2 GB for Gemini Nano model
- **OS**: Windows, macOS, or Linux

### Quick Setup

**For detailed setup instructions, see [AI_SETUP_GUIDE.md](AI_SETUP_GUIDE.md)**

1. **Enable Chrome AI Features**
   - Visit `chrome://flags/#prompt-api-for-gemini-nano` → Enable
   - Visit `chrome://flags/#optimization-guide-on-device-model` → Enable BypassPerfRequirement
   - Restart Chrome

2. **Download AI Model**
   - Visit `chrome://components/`
   - Find "Optimization Guide On Device Model"
   - Click "Check for update" and wait for download (~1-2 GB)

3. **Install Extension**
   - Clone this repository
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `ChromeAttention` directory

4. **Verify Installation**
   - Click the extension icon
   - Check "AI Status" section - should show "✓ Ready" for all components
   - If not available, see troubleshooting guide in [AI_SETUP_GUIDE.md](AI_SETUP_GUIDE.md)

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

### Example: Summarizer API

```javascript
const summarizer = await ai.summarizer.create();
const summary = await summarizer.summarize(pageText);
```

### Example: Prompt API

```javascript
const session = await ai.languageModel.create({
  systemPrompt: "You are a focus assistant...",
  temperature: 0.7
});
const response = await session.prompt("Is this page relevant to goal X?");
```

### Example: Writer API

```javascript
const writer = await ai.writer.create({
  tone: "neutral",
  length: "short"
});
const summary = await writer.write("Summarize this focus session...");
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
1. Ensure Chrome 127+ (`chrome://version/`)
2. Verify flags enabled at `chrome://flags`
3. Check model downloaded at `chrome://components/`
4. Test in console: `await ai.languageModel.capabilities()` should return `{ available: "readily" }`
5. Check debug logs at `chrome://on-device-internals/`

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

