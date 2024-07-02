const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const { Client, GatewayIntentBits, ApplicationCommandOptionType } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.BOT_TOKEN;
const BASE_DIR = path.join(__dirname, 'logs');

const logger = new Client({
    intents: [
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});


async function fetchMessages(channel, userId = null) {
    let messages = [];
    let lastId;

    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const fetchedMessages = await channel.messages.fetch(options);
        const filteredMessages = userId 
            ? fetchedMessages.filter(msg => msg.author.id === userId)
            : fetchedMessages;

        messages.push(...filteredMessages.map(msg => ({
            id: msg.id,
            author: {
                id: msg.author.id,
                username: msg.author.username,
                discriminator: msg.author.discriminator
            },
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
            attachments: msg.attachments.map(att => ({
                name: att.name,
                url: att.url
            }))
        })));

        if (fetchedMessages.size < 100) break;
        lastId = fetchedMessages.last().id;
    }

    return messages.reverse(); // Reverse the order of messages
}

function parseDiscordMarkdown(content) {
    const renderer = new marked.Renderer();

    renderer.code = (code, language) => {
        return `<pre><code class="language-${language}">${sanitizeHtml(code)}</code></pre>`;
    };

    renderer.codespan = (code) => {
        return `<code>${sanitizeHtml(code)}</code>`;
    };

    const parsed = marked(content, { renderer });

    return parsed
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\_\_(.*?)\_\_/g, '<u>$1</u>')
        .replace(/\~\~(.*?)\~\~/g, '<s>$1</s>');
}

async function downloadAttachment(attachment, messageId, attachmentsDir) {
    const filePath = path.join(attachmentsDir, `${messageId}_${attachment.name}`);
    const writer = fs.createWriteStream(filePath);

    const response = await axios({
        url: attachment.url,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
    });
}

async function ensureDirectoryStructure(guildId, channelId) {
    const guildDir = path.join(BASE_DIR, `guild-${guildId}`);
    const channelDir = path.join(guildDir, `channel-${channelId}`);
    const attachmentsDir = path.join(channelDir, 'attachments');
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
            ? fetchedMessages.filter(msg => msg.author.id === userId)
            : fetchedMessages;

            for (const msg of filteredMessages.values()) {
        const messageData = {
            id: msg.id,
            author: {
                id: msg.author.id,
                username: msg.author.username
            },
            content: msg.content,
            createdAt: msg.createdAt.toISOString(),
            attachments: []
        };

        for (const attachment of msg.attachments.values()) {
            try {
                const localPath = await downloadAttachment(attachment, msg.id, attachmentsDir);
                messageData.attachments.push({
                    name: attachment.name,
                    url: attachment.url,
                    localPath: path.relative(path.join(BASE_DIR, `guild-${channel.guild.id}`), localPath)
                });
            } catch (error) {
                console.error(`Failed to download attachment: ${attachment.name}`, error);
            }
        }

        messages.push(messageData);
    }

        if (fetchedMessages.size < 100) break;
        lastId = fetchedMessages.last().id;
    }

    return messages.reverse();
}

function generateHTML(messages, targetUser = null) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Discord Messages Log</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
            .message { border: 1px solid #ddd; margin-bottom: 10px; padding: 10px; border-radius: 5px; }
            .author { font-weight: bold; }
            .timestamp, .user-id { color: #666; font-size: 0.8em; }
            .user-id { font-size: 0.6em; } /* 0.2em smaller than timestamp */
            .content { margin-top: 5px; }
            .attachment { margin-top: 5px; }
            .attachment a { color: #0066cc; }
            code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
            pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
            img { max-width: 100%; height: auto; }
        </style>
    </head>
    <body>
        <h1>Discord Messages Log ${targetUser ? `for ${targetUser.username}` : ''}</h1>
        ${messages.map(msg => `
            <div class="message">
                <div class="author">${msg.author.username}</div>
                <div class="timestamp">${new Date(msg.createdAt).toLocaleString()}</div>
                <div class="user-id">ID:${msg.author.id}</div>
                <div class="content">${parseDiscordMarkdown(msg.content)}</div>
                ${msg.attachments.map(att => `
                    <div class="attachment">
                        <a href="${att.localPath}" target="_blank">${att.name}</a>
                        ${att.name.match(/\.(jpg|jpeg|png|gif)$/i) ? `<br><img src="${att.localPath}" alt="${att.name}">` : ''}
                    </div>
                `).join('')}
            </div>
        `).join('')}
    </body>
    </html>
    `;
}

logger.once('ready', async () => {
    console.log(`Logged in as ${logger.user.tag}!`);

    await logger.application.commands.create({
        name: 'logmessages',
        description: 'Log messages from a channel',
        options: [
            {
                name: 'channel',
                type: ApplicationCommandOptionType.Channel,
                description: 'The channel to log messages from',
                required: true
            },
            {
                name: 'user',
                type: ApplicationCommandOptionType.User,
                description: 'The user to filter messages by (optional)',
                required: false
            }
        ]
    });
});

logger.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'logmessages') {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const user = interaction.options.getUser('user');
        const guildId = interaction.guildId;

        try {
            console.log(`Fetching messages from channel ${channel.name} in guild ${guildId}`);
            const { channelDir, attachmentsDir } = await ensureDirectoryStructure(guildId, channel.id);
            const messages = await fetchMessages(channel, user ? user.id : null, attachmentsDir);

            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const jsonFilename = `${timestamp}.json`;
            const htmlFilename = `${timestamp}.html`;

            // Save as JSON
            await fsPromises.writeFile(path.join(channelDir, jsonFilename), JSON.stringify(messages, null, 2));
            console.log(`Logged ${messages.length} messages to ${jsonFilename}`);

            // Generate and save HTML
            const htmlContent = generateHTML(messages, user);
            await fsPromises.writeFile(path.join(channelDir, htmlFilename), htmlContent);
            console.log(`Generated ${htmlFilename}`);

            await interaction.editReply(`Logged ${messages.length} messages to ${jsonFilename} and generated ${htmlFilename}. Attachments have been saved in the 'attachments' directory.`);
        } catch (error) {
            console.error("Error:", error);
            await interaction.editReply('An error occurred while logging messages.');
        }
    }
});

logger.login(TOKEN);