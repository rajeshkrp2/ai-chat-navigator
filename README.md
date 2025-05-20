# AI Chat Navigator

A Chrome extension that enhances your AI chat experience by providing easy navigation, bookmarking, and search capabilities for your conversations.

## Features

- 📚 **Message Navigation**: Easily browse through all your user messages in a convenient sidebar
- ⭐ **Bookmarking**: Save important messages for quick access later
- 🔍 **Search**: Quickly find specific messages using the search functionality
- 📋 **Export**: Export your conversation history for backup or analysis
- 🎯 **Platform Support**: Works with multiple AI chat platforms:
  - ChatGPT (chat.openai.com)
  - Claude (claude.ai)
  - Gemini (gemini.google.com)
  - Perplexity (perplexity.ai)
  - Anthropic (console.anthropic.com)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/ai-chat-navigator.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the `ai-chat-navigator` directory

## Usage

1. Visit any supported AI chat platform
2. Click the AI Chat Navigator extension icon in your browser toolbar
3. Use the sidebar to:
   - Browse your messages
   - Bookmark important messages
   - Search through your conversation
   - Export your chat history

## Development

### Project Structure

```
ai-chat-navigator/
├── manifest.json      # Extension configuration
├── content.js         # Main extension logic
├── styles.css         # Extension styles
├── platforms/         # Platform-specific adapters
│   ├── chatgpt.js
│   ├── claude.js
│   ├── gemini.js
│   ├── perplexity.js
│   └── anthropic.js
└── icons/            # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Building from Source

1. Clone the repository
2. Make your changes
3. Load the extension in Chrome using "Load unpacked"

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all the AI chat platforms for providing great services
- Inspired by the need for better conversation management in AI chats 