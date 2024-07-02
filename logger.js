const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const axios = require("axios");
const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");
const {
  Client,
  GatewayIntentBits,
  ApplicationCommandOptionType,
} = require("discord.js");
const toml = require("toml");

// Load configuration
const config = toml.parse(fs.readFileSync("config.toml", "utf-8"));
const TOKEN = config.bot_token;
const BASE_DIR = path.join(__dirname, "logs");

// Get timezone from config or use system default
const timezone =
  config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

const logger = new Client({
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

function parseDiscordMarkdown(content) {
  const renderer = new marked.Renderer();

  renderer.code = (code, language) => {
    return `<pre><code class="language-${language}">${sanitizeHtml(
      code
    )}</code></pre>`;
  };

  renderer.codespan = (code) => {
    return `<code>${sanitizeHtml(code)}</code>`;
  };

  const parsed = marked(content, { renderer });

  return parsed
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\_\_(.*?)\_\_/g, "<u>$1</u>")
    .replace(/\~\~(.*?)\~\~/g, "<s>$1</s>");
}

async function downloadAttachment(attachment, messageId, attachmentsDir) {
  const filePath = path.join(attachmentsDir, `${messageId}_${attachment.name}`);
  const writer = fs.createWriteStream(filePath);

  const response = await axios({
    url: attachment.url,
    method: "GET",
    responseType: "stream",
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
}

async function ensureDirectoryStructure(guildId, channelId) {
  const guildDir = path.join(BASE_DIR, `guild-${guildId}`);
  const channelDir = path.join(guildDir, `channel-${channelId}`);
  const attachmentsDir = path.join(channelDir, "attachments");
  await fsPromises.mkdir(guildDir, { recursive: true });
  await fsPromises.mkdir(channelDir, { recursive: true });
  await fsPromises.mkdir(attachmentsDir, { recursive: true });
  return { channelDir, attachmentsDir };
}

async function fetchMessages(channel, userId = null, attachmentsDir) {
  let messages = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const fetchedMessages = await channel.messages.fetch(options);
    const filteredMessages = userId
      ? fetchedMessages.filter((msg) => msg.author.id === userId)
      : fetchedMessages;

    for (const msg of filteredMessages.values()) {
      const messageData = {
        id: msg.id,
        author: {
          id: msg.author.id,
          username: msg.author.username,
        },
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        attachments: [],
      };

      if (!userId || msg.author.id === userId) {
        for (const attachment of msg.attachments.values()) {
          try {
            const localPath = await downloadAttachment(
              attachment,
              msg.id,
              attachmentsDir
            );
            messageData.attachments.push({
              name: attachment.name,
              url: attachment.url,
              localPath: path.basename(localPath),
            });
          } catch (error) {
            console.error(
              `Failed to download attachment: ${attachment.name}`,
              error
            );
          }
        }
      }

      messages.push(messageData);
    }

    if (fetchedMessages.size < 100) break;
    lastId = fetchedMessages.last().id;
  }

  return messages.reverse();
}

function generateHTML(messages, targetUser = null, guildName, channelName) {
  const currentTimestamp = new Date().toLocaleString("en-US", {
    timeZone: timezone,
  });
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Discord Message Logger</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin-bottom: 5px; }
            .header .author { font-size: 0.9em; color: #666; }
            .header .info { margin-top: 10px; }
            .message { border: 1px solid #ddd; margin-bottom: 10px; padding: 10px; border-radius: 5px; }
            .author { font-weight: bold; }
            .timestamp, .ids { color: #666; font-size: 0.8em; }
            .content { margin-top: 5px; }
            .attachment { margin-top: 5px; }
            .attachment a { color: #0066cc; }
            code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
            pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
            img { max-width: 100%; height: auto; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1><a href="https://github.com/kuzeyfate/discord-js-message-logger" target="_blank">Discord Message Logger</a></h1>
            <div class="author">by kuzeyfate</div>
            <div class="info">
                <p>Guild: ${guildName}</p>
                <p>Channel: ${channelName}</p>
                <p>Timezone: ${timezone}</p>
                ${
                  targetUser
                    ? `<p>Filtered for user: ${targetUser.username}</p>`
                    : ""
                }
                <p>Generated: ${currentTimestamp}</p>
            </div>
        </div>
        ${messages
          .map(
            (msg) => `
            <div class="message">
                <div class="author">${msg.author.username}</div>
                <div class="timestamp">${new Date(msg.createdAt).toLocaleString(
                  "en-US",
                  { timeZone: timezone }
                )}</div>
                <div class="ids">USER ID: ${msg.author.id} | MESSAGE ID: ${
              msg.id
            }</div>
                <div class="content">${parseDiscordMarkdown(msg.content)}</div>
                ${msg.attachments
                  .map(
                    (att) => `
                    <div class="attachment">
                        <a href="attachments/${
                          att.localPath
                        }" target="_blank">${att.name}</a>
                        ${
                          att.name.match(/\.(jpg|jpeg|png|gif)$/i)
                            ? `<br><img src="attachments/${att.localPath}" alt="${att.name}">`
                            : ""
                        }
                    </div>
                `
                  )
                  .join("")}
            </div>
        `
          )
          .join("")}
    </body>
    </html>
    `;
}

logger.once("ready", async () => {
  console.log(`Logged in as ${logger.user.tag}!`);

  await logger.application.commands.create({
    name: "logmessages",
    description: "Log messages from a channel",
    options: [
      {
        name: "channel",
        type: ApplicationCommandOptionType.Channel,
        description: "The channel to log messages from",
        required: true,
      },
      {
        name: "user",
        type: ApplicationCommandOptionType.User,
        description: "The user to filter messages by (optional)",
        required: false,
      },
    ],
  });
});

logger.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "logmessages") {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel("channel");
    const user = interaction.options.getUser("user");
    const guildId = interaction.guildId;
    const guildName = interaction.guild.name;

    try {
      console.log(
        `Fetching messages from channel ${channel.name} in guild ${guildId}`
      );
      const { channelDir, attachmentsDir } = await ensureDirectoryStructure(
        guildId,
        channel.id
      );
      const messages = await fetchMessages(
        channel,
        user ? user.id : null,
        attachmentsDir
      );

      // Generate timestamp in the correct timezone
      const timestamp = new Date()
        .toLocaleString("en-US", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
        .replace(/[/:]/g, "-")
        .replace(", ", "_");

      const jsonFilename = `${timestamp}.json`;
      const htmlFilename = `${timestamp}.html`;

      // Save as JSON
      await fsPromises.writeFile(
        path.join(channelDir, jsonFilename),
        JSON.stringify(messages, null, 2)
      );
      console.log(`Logged ${messages.length} messages to ${jsonFilename}`);

      // Generate and save HTML
      const htmlContent = generateHTML(messages, user, guildName, channel.name);
      await fsPromises.writeFile(
        path.join(channelDir, htmlFilename),
        htmlContent
      );
      console.log(`Generated ${htmlFilename}`);

      await interaction.editReply(
        `Logged ${messages.length} messages to ${jsonFilename} and generated ${htmlFilename}. Attachments have been saved in the 'attachments' directory.`
      );
    } catch (error) {
      console.error("Error:", error);
      await interaction.editReply("An error occurred while logging messages.");
    }
  }
});

logger.login(TOKEN);
