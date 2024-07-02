# Discord.js Message Logger

A powerful Discord bot that logs messages from specified channels, with options to filter by user and generate both JSON and HTML logs.

## Features

- Log messages from any channel using a slash command
- Optional user filtering
- Export messages to JSON format
- Generate HTML logs with Discord-style markdown formatting
- Support for Discord markdown (bold, italic, underline, strikethrough, code blocks)
- Timezone-aware logging with configurable timezone
- Attachment downloading and linking in HTML logs
- Customizable via TOML configuration file

## Prerequisites

- Node.js (v14 or higher)
- Discord Bot Token
- Discord Server (Guild) with necessary permissions

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kuzeyfate/discord-js-message-logger.git
   cd discord-js-message-logger
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `config.toml` file in the project root:
   ```toml
   # Bot configuration
   bot_token = "your_bot_token_here"

   # Timezone configuration (optional)
   # Uncomment and set the desired timezone, e.g.:
   # timezone = "UTC+3"
   ```

   Replace `your_bot_token_here` with your actual Discord bot token.

## Usage

1. Start the bot:
   ```bash
   npm start
   ```

2. In Discord, use the slash command:
   ```
   /logmessages channel:#channel-name user:@username
   ```
   The `user` parameter is optional. If omitted, the bot will log all messages in the channel.

3. The bot will:
   - Fetch messages from the specified channel
   - Save messages to a JSON file
   - Generate an HTML file with formatted messages
   - Download and save attachments

4. Check the generated files in the `logs` directory:
   - `YYYY-MM-DD_HH-mm-ss.json`: Raw data of fetched messages
   - `YYYY-MM-DD_HH-mm-ss.html`: Formatted messages viewable in a web browser
   - `attachments/`: Directory containing downloaded attachments

## Customization

- Modify the HTML styling in the `generateHTML()` function in `logger.js`
- Adjust markdown parsing in the `parseDiscordMarkdown()` function
- Update the bot's slash command in the `logger.once('ready', ...)` event handler

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [Discord.js](https://discord.js.org/) for the Discord API wrapper
- [marked](https://marked.js.org/) for Markdown parsing
- [sanitize-html](https://github.com/apostrophecms/sanitize-html) for HTML sanitization
- [axios](https://axios-http.com/) for HTTP requests
- [toml](https://github.com/BinaryMuse/toml-node) for TOML parsing
