# Development Guide

This guide provides detailed information for developers working on the Chrome Focus Assistant extension.

## Project Structure

```
ChromeAttention/
├── manifest.json              # Extension configuration
├── README.md                  # User documentation
├── DEVELOPMENT.md            # This file
├── rules.json                # Dynamic blocking rules
│
├── background/
│   └── service-worker.js     # Background service worker + AI Manager
│
├── content/
│   └── content-script.js     # Content script + page analyzer
│
├── core/
│   ├── modules.js            # All 5 core modules
│   │   ├── GoalManager       # Module 1: Automatic goal setting
│   │   ├── DetectionEngine   # Module 2: Semantic detection
│   │   ├── LearningEngine    # Module 3: Personalized learning
│   │   ├── InterventionManager # Module 4: Gentle interventions
│   │   └── ReviewGenerator   # Module 5: Session reviews
│   └── storage.js            # Storage manager + schemas
│
├── ui/
│   ├── popup.html            # Main popup interface
│   ├── popup.js              # Popup controller
│   ├── popup.css             # Popup styles
│   └── blocked.html          # Blocked site page
│
├── shared/
│   └── utils.js              # Logger, constants, helpers
│
└── icons/
    ├── icon16.png            # Extension icons
    ├── icon48.png
    ├── icon128.png
    └── generate_icons.py     # Icon generation script
```

## Architecture

### Communication Flow

```
┌─────────────────┐
│  Content Script │ ← Extracts page content
└────────┬────────┘
         │ sendMessage
         ↓
┌─────────────────┐
│ Service Worker  │ ← Routes messages
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌──────────┐
│ AI Mgr │ │  Storage │
└────────┘ └──────────┘
    ↓
┌────────────────┐
│ Core Modules   │
│ - Goal         │
│ - Detection    │
│ - Learning     │
│ - Intervention │
│ - Review       │
└────────────────┘
```

### Message Types

All messages follow this structure:
```javascript
{
  type: 'MESSAGE_TYPE',
  data: { /* payload */ }
}
```

**Available message types:**
- `CHECK_AI_STATUS` - Get AI availability status
- `EXTRACT_GOAL` - Extract goal from page
- `GET_CURRENT_GOAL` - Get active goal
- `UPDATE_GOAL` - Update goal text/keywords
- `CLEAR_GOAL` - Clear current goal
- `EVALUATE_PAGE` - Evaluate page relevance
- `SUBMIT_FEEDBACK` - Submit user feedback
- `START_SESSION` - Start focus session
- `END_SESSION` - End focus session
- `GET_CURRENT_SESSION` - Get active session
- `GET_SESSION_HISTORY` - Get past sessions
- `GET_SETTINGS` - Get user settings
- `UPDATE_SETTINGS` - Update settings
- `GET_STORAGE_DATA` - Get all storage data

### Data Schemas

#### Goal
```javascript
{
  id: 'goal-timestamp',
  text: 'Human-readable goal',
  keywords: ['key', 'terms'],
  whitelist: ['allowed.com'],
  blacklist: ['blocked.com'],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### Session
```javascript
{
  id: 'session-timestamp',
  goalId: 'goal-id',
  startTime: timestamp,
  endTime: timestamp,
  pagesVisited: [{url, title, relevanceScore, timestamp}],
  distractions: count,
  interventions: count,
  feedbackGiven: count,
  active: boolean,
  review: { summary, timestamp }
}
```

#### Feedback
```javascript
{
  id: 'feedback-timestamp',
  sessionId: 'session-id',
  goalId: 'goal-id',
  url: 'page-url',
  title: 'page-title',
  userLabel: 'relevant' | 'distracting',
  systemScore: 0.0-1.0,
  pageContent: 'sample...',
  timestamp: timestamp
}
```

## Chrome AI APIs

### 1. Language Model (Prompt API)

```javascript
const session = await ai.languageModel.create({
  systemPrompt: "You are a focus assistant...",
  temperature: 0.7,
  topK: 3
});

const response = await session.prompt("Your question here");
```

**Use cases:**
- Goal structuring
- Page relevance evaluation
- Decision making

### 2. Summarizer API

```javascript
const summarizer = await ai.summarizer.create({
  type: 'key-points',    // or 'tl;dr', 'teaser', 'headline'
  length: 'medium',      // or 'short', 'long'
  sharedContext: ''      // Optional context
});

const summary = await summarizer.summarize(text);
```

**Use cases:**
- Page content summarization
- Quick content analysis

### 3. Writer API

```javascript
const writer = await ai.writer.create({
  tone: 'neutral',       // or 'formal', 'casual'
  length: 'short',       // or 'medium', 'long'
  format: 'plain-text'   // or 'markdown'
});

const result = await writer.write("Write a summary of...");
```

**Use cases:**
- Session review generation
- Motivational messages

### 4. Rewriter API

```javascript
const rewriter = await ai.rewriter.create({
  tone: 'as-is',         // or 'more-formal', 'more-casual'
  length: 'as-is',       // or 'shorter', 'longer'
  format: 'as-is'        // or 'plain-text', 'markdown'
});

const result = await rewriter.rewrite(text);
```

**Use cases:**
- Refining generated content
- Adjusting tone

## Module Implementation Status

### ✅ Implemented (Structure)
- Project scaffolding
- Storage layer
- AI Manager wrapper
- Message routing
- Basic UI

### 🚧 To Implement

#### Module 1: Goal Manager
- [x] Basic structure
- [ ] Enhanced goal extraction
- [ ] User profile integration
- [ ] Common patterns recognition

#### Module 2: Detection Engine
- [x] Basic structure
- [ ] Behavioral signals integration
- [ ] Confidence scoring
- [ ] Real-time evaluation

#### Module 3: Learning Engine
- [x] Basic structure
- [ ] Few-shot prompt building
- [ ] Threshold optimization
- [ ] Pattern recognition

#### Module 4: Intervention Manager
- [x] Basic structure
- [ ] Notification system
- [ ] Blocking implementation
- [ ] User preference handling

#### Module 5: Review Generator
- [x] Basic structure
- [ ] Enhanced review formatting
- [ ] Progress tracking
- [ ] Gamification elements

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone and enter directory
cd ChromeAttention

# Install Python dependencies (for icon generation)
pip install Pillow

# Generate icons (already done)
cd icons && python generate_icons.py && cd ..
```

### 2. Load Extension in Chrome

1. Open Chrome Canary/Dev
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `ChromeAttention` directory

### 3. Enable Chrome AI

Follow the steps in README.md to enable all required Chrome AI flags.

### 4. Development Cycle

```bash
# 1. Make changes to code

# 2. Reload extension
# - Go to chrome://extensions/
# - Click reload button on your extension

# 3. Test changes
# - Open DevTools on extension pages
# - Check console logs

# 4. Debug issues
# - Background: Right-click extension → Inspect service worker
# - Content: Open DevTools on any page
# - Popup: Right-click popup → Inspect
```

### 5. Testing

#### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] AI APIs are available
- [ ] Can extract goal from page
- [ ] Can start/end session
- [ ] Can provide feedback
- [ ] Settings persist
- [ ] Notifications work
- [ ] Session reviews generate

#### Testing Individual Modules

```javascript
// Open background service worker console
// Access managers via the global 'managers' object

// Test AI Manager
const status = await managers.aiManager.checkAvailability();
console.log('AI Status:', status);

// Test Goal Manager
const goal = await managers.goalManager.extractGoalFromPage({
  title: 'Test Page',
  text: 'Some test content...',
  domain: 'test.com'
});
console.log('Extracted Goal:', goal);

// Test Detection Engine
const currentGoal = await managers.goalManager.getCurrentGoal();
const evaluation = await managers.detectionEngine.evaluatePage(
  { title: 'Test', text: 'Test content', domain: 'test.com' },
  currentGoal
);
console.log('Evaluation:', evaluation);
```

## Debugging

### Common Issues

#### 1. AI APIs Not Available

**Problem:** AI status shows "Not Available"

**Solutions:**
- Ensure using Chrome Canary/Dev 128+
- Check all flags are enabled at `chrome://flags`
- Run `await ai.languageModel.create()` in console to trigger download
- Wait for Gemini Nano model download to complete

#### 2. Content Script Not Injecting

**Problem:** Content script not running on pages

**Solutions:**
- Check page URL isn't restricted (chrome://, edge://, etc.)
- Verify `host_permissions` in manifest.json
- Check console for injection errors
- Try reloading the extension

#### 3. Storage Not Persisting

**Problem:** Data lost after closing browser

**Solutions:**
- Check `chrome.storage.local` permissions
- Verify storage.js is properly imported
- Check for storage quota errors
- Use DevTools → Application → Storage to inspect

#### 4. Module Import Errors

**Problem:** "Cannot use import outside a module"

**Solutions:**
- Ensure `type: "module"` in service worker registration
- Use `type="module"` in HTML script tags
- Check all import/export statements

### Logging

The extension uses a built-in logger with levels:

```javascript
import { Logger } from '../shared/utils.js';

Logger.debug('Debug message', data);
Logger.info('Info message', data);
Logger.warn('Warning message', data);
Logger.error('Error message', error);

// Set log level
Logger.setLevel(Logger.LOG_LEVELS.DEBUG); // Show all
Logger.setLevel(Logger.LOG_LEVELS.INFO);  // Hide debug
Logger.setLevel(Logger.LOG_LEVELS.ERROR); // Only errors
```

### DevTools Locations

- **Background Service Worker**: `chrome://extensions/` → "Inspect service worker"
- **Content Script**: Regular DevTools on any webpage
- **Popup**: Right-click popup → "Inspect"
- **Storage**: DevTools → Application → Storage → Local Storage

## Performance Considerations

### 1. AI API Rate Limiting

- AI APIs have token limits
- Implement debouncing for frequent calls
- Cache results when possible
- Use quick checks before AI evaluation

### 2. Storage Optimization

- Limit feedback history to 100 items
- Limit session history to 50 sessions
- Clean up old data periodically
- Use efficient data structures

### 3. Content Script Efficiency

- Extract text efficiently (limit to 10,000 chars)
- Debounce activity monitoring
- Avoid excessive DOM manipulation
- Remove event listeners when done

## Security & Privacy

### Data Handling

1. **No Cloud Upload**: All AI processing is local
2. **Minimal Storage**: Only essential data stored
3. **User Control**: All features can be disabled
4. **Transparent**: All data operations logged

### Permissions Justification

- `storage`: Store goals, sessions, feedback
- `tabs`: Access page information
- `notifications`: Show focus reminders
- `declarativeNetRequest`: Block distracting sites
- `alarms`: Schedule unblocking
- `activeTab`: Read current page content
- `host_permissions`: Inject content script

## Contributing

### Code Style

- Use ES6+ features
- Prefer `const` over `let`
- Use async/await over promises
- Add JSDoc comments for functions
- Keep functions small and focused
- Handle errors gracefully

### Commit Guidelines

- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Keep commits focused on single changes

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Update documentation
5. Submit PR with clear description

## Future Enhancements

### Planned Features

- [ ] Options page for advanced settings
- [ ] Statistics dashboard
- [ ] Export/import goals
- [ ] Sync across devices
- [ ] Custom intervention styles
- [ ] Time-based goal switching
- [ ] Integration with productivity tools
- [ ] Dark mode
- [ ] Localization

### Technical Improvements

- [ ] Unit tests
- [ ] Integration tests
- [ ] Build system (webpack/rollup)
- [ ] TypeScript migration
- [ ] Performance monitoring
- [ ] Error reporting
- [ ] Analytics (privacy-preserving)

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome AI APIs](https://developer.chrome.com/docs/ai/)
- [DeclarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/)

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check existing documentation
- Review console logs for errors
- Test with Chrome AI APIs in isolation

---

Happy coding! 🎯

