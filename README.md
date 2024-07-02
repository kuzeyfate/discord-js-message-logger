# Discord Message Logger

A Discord bot that logs messages locally from specified channels using a slash command, with an option to filter by user.

## Features

- Log messages from any channel using a slash command
- Optional user filtering
- Export messages to JSON
- Generate HTML with Discord-style markdown formatting
- Support for Discord markdown (bold, italic, underline, strikethrough, code blocks)

## Prerequisites

- Node.js (v14 or higher)
- Discord Bot Token
- Discord Server (Guild) ID

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

3. Create a `.env` file in the project root:
   ```env
   BOT_TOKEN=your_bot_token_here
   ```

## Usage

1. Start the bot:
   ```bash
   npm start
   ```

2. In Discord, use the slash command:
   ```
   /logmessages channel:#channel-name user:@username
   ```
   The `user` parameter is optional.

3. The bot will:
   - Fetch messages from the specified channel
   - Save messages to `messages.json`
   - Generate `messages.html` with formatted messages

4. Check the generated files:
   - `messages.json`: Raw data of fetched messages
   - `messages.html`: Formatted messages viewable in a web browser

## Customization

- Modify output filenames in `bot.js`
- Adjust HTML styling in the `generateHTML()` function
- Update markdown parsing in the `parseDiscordMarkdown()` function

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.
