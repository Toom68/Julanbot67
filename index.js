import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { access, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client, GatewayIntentBits, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { google } from 'googleapis';

dotenv.config();

const requiredEnvVars = [
  'DISCORD_BOT_TOKEN',
  'GOOGLE_SHEET_ID'
];

const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const sheetName = process.env.GOOGLE_SHEET_NAME || 'Messages';
const peopleSheetName = process.env.GOOGLE_PEOPLE_SHEET_NAME || 'People';
const knowledgeSheetName = process.env.GOOGLE_KNOWLEDGE_SHEET_NAME || 'Knowledge';
const julianScansSheetName = process.env.GOOGLE_JULIAN_SCANS_SHEET_NAME || 'JulianScans';
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetHeaders = ['Timestamp', 'Sender', 'Message', 'Images', 'Videos', 'GIFs'];
const peopleSheetHeaders = [
  'User ID',
  'Username',
  'Display Name',
  'Avatar URL',
  'First Seen At',
  'Last Seen At',
  'Last Message',
  'Message Count',
  'Fact Count',
  'Last Channel',
  'Last Server'
];
const knowledgeSheetHeaders = [
  'User ID',
  'Username',
  'Category',
  'Fact',
  'Source Message',
  'Observed At',
  'Channel',
  'Server'
];
const julianScansSheetHeaders = [
  'Scan ID',
  'Triggered By User ID',
  'Triggered By Username',
  'Triggered At',
  'Channel',
  'Server',
  'Total Messages',
  'Total Facts Added',
  'Messages JSON'
];
const defaultRedirectUri = 'http://127.0.0.1:3000/oauth2callback';
let redirectUri = process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri;
const tokenFilePath = new URL('./google-oauth-token.json', import.meta.url);
let auth;
let sheets;
const ensuredSheets = new Set();
const peopleRowIndexByUserId = new Map();
const peopleDataByUserId = new Map();
const knowledgeSignatures = new Set();
const recentlyProcessedMessageIds = new Map();
let googleInitializationPromise;
const dashboardPort = Number(process.env.PORT || process.env.DASHBOARD_PORT || 3001);
const dashboardHost = process.env.DASHBOARD_HOST || '0.0.0.0';
const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const julianAllowedUserIds = new Set(
  (process.env.JULIAN_ALLOWED_USER_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const julianCommand = new SlashCommandBuilder()
  .setName('julian')
  .setDescription('Scan the last 10 messages in this channel and store useful knowledge.')
  .setDMPermission(false);

function getCredentialsFilePath() {
  const credentialsPath = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH;

  if (!credentialsPath) {
    return null;
  }

  return pathToFileURL(resolve(credentialsPath));
}

async function loadGoogleOAuthConfig() {
  const credentialsFromEnv = parseJsonEnv('GOOGLE_OAUTH_CREDENTIALS_JSON');

  if (credentialsFromEnv) {
    const oauthClient = credentialsFromEnv.installed || credentialsFromEnv.web;

    if (!oauthClient?.client_id || !oauthClient?.client_secret) {
      throw new Error('GOOGLE_OAUTH_CREDENTIALS_JSON is missing client_id or client_secret.');
    }

    redirectUri = process.env.GOOGLE_REDIRECT_URI || oauthClient.redirect_uris?.[0] || defaultRedirectUri;

    return {
      clientId: oauthClient.client_id,
      clientSecret: oauthClient.client_secret
    };
  }

  const credentialsFilePath = getCredentialsFilePath();

  if (credentialsFilePath) {
    const credentialsFileContents = await readFile(credentialsFilePath, 'utf8');
    const parsedCredentials = JSON.parse(credentialsFileContents);
    const oauthClient = parsedCredentials.installed || parsedCredentials.web;

    if (!oauthClient?.client_id || !oauthClient?.client_secret) {
      throw new Error('Google OAuth credentials file is missing client_id or client_secret.');
    }

    redirectUri = process.env.GOOGLE_REDIRECT_URI || oauthClient.redirect_uris?.[0] || defaultRedirectUri;

    return {
      clientId: oauthClient.client_id,
      clientSecret: oauthClient.client_secret
    };
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Set GOOGLE_OAUTH_CREDENTIALS_PATH or both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }

  redirectUri = process.env.GOOGLE_REDIRECT_URI || defaultRedirectUri;

  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  };
}

async function initializeGoogleClient() {
  if (auth && sheets) {
    return;
  }

  const { clientId, clientSecret } = await loadGoogleOAuthConfig();

  auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  sheets = google.sheets({ version: 'v4', auth });
}

async function waitForAuthorizationCode() {
  const redirectUrl = new URL(redirectUri);

  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url || '/', redirectUri);
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      if (requestUrl.pathname !== redirectUrl.pathname) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }

      if (error) {
        response.statusCode = 400;
        response.end('Google authorization failed. You can close this window.');
        server.close(() => reject(new Error(`Google authorization failed: ${error}`)));
        return;
      }

      if (!code) {
        response.statusCode = 400;
        response.end('Missing authorization code. You can close this window.');
        server.close(() => reject(new Error('Missing authorization code from Google callback.')));
        return;
      }

      response.statusCode = 200;
      response.end('Google authorization complete. You can close this window and return to the bot.');
      server.close(() => resolve(code));
    });

    server.on('error', reject);
    server.listen(Number(redirectUrl.port || 80), redirectUrl.hostname);
  });
}

async function authorizeGoogleSheets() {
  await initializeGoogleClient();

  const tokenFromEnv = parseJsonEnv('GOOGLE_OAUTH_TOKEN_JSON');

  if (tokenFromEnv) {
    auth.setCredentials(tokenFromEnv);
    return;
  }

  try {
    await access(tokenFilePath);
    const savedToken = await readFile(tokenFilePath, 'utf8');
    auth.setCredentials(JSON.parse(savedToken));
    return;
  } catch {
  }

  const authorizationUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
    prompt: 'consent'
  });

  console.log('Open this URL to authorize Google Sheets access:');
  console.log(authorizationUrl);

  const code = await waitForAuthorizationCode();
  const { tokens } = await auth.getToken(code);

  auth.setCredentials(tokens);
  await writeFile(tokenFilePath, JSON.stringify(tokens, null, 2), 'utf8');
}

async function initializeGoogleSheets() {
  if (!googleInitializationPromise) {
    googleInitializationPromise = (async () => {
      await authorizeGoogleSheets();
      await ensureSheetReady();
      await ensurePeopleSheetReady();
      await ensureKnowledgeSheetReady();
      await ensureJulianScansSheetReady();
    })().catch((error) => {
      googleInitializationPromise = null;
      throw error;
    });
  }

  return googleInitializationPromise;
}

function hasFileExtension(url, extensions) {
  const lowerUrl = url.toLowerCase();

  return extensions.some((extension) => lowerUrl.includes(extension));
}

function classifyMediaUrl(url, contentType = '') {
  const lowerContentType = contentType.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (
    lowerContentType === 'image/gif' ||
    lowerUrl.includes('tenor.com') ||
    lowerUrl.includes('giphy.com') ||
    hasFileExtension(lowerUrl, ['.gif'])
  ) {
    return 'gifs';
  }

  if (
    lowerContentType.startsWith('image/') ||
    hasFileExtension(lowerUrl, ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.svg'])
  ) {
    return 'images';
  }

  if (
    lowerContentType.startsWith('video/') ||
    hasFileExtension(lowerUrl, ['.mp4', '.mov', '.webm', '.mkv', '.avi'])
  ) {
    return 'videos';
  }

  return null;
}

function extractMediaUrls(message) {
  const media = {
    images: [],
    videos: [],
    gifs: []
  };

  for (const attachment of message.attachments.values()) {
    const mediaType = classifyMediaUrl(attachment.url, attachment.contentType || '');

    if (mediaType) {
      media[mediaType].push(attachment.url);
    }
  }

  for (const embed of message.embeds) {
    const embedCandidates = [
      { url: embed.url, contentType: embed.type === 'gifv' ? 'image/gif' : '' },
      { url: embed.image?.url, contentType: embed.type === 'gifv' ? 'image/gif' : 'image/*' },
      { url: embed.thumbnail?.url, contentType: 'image/*' },
      { url: embed.video?.url, contentType: embed.type === 'gifv' ? 'image/gif' : 'video/*' }
    ].filter((candidate) => candidate.url);

    for (const candidate of embedCandidates) {
      const mediaType = classifyMediaUrl(candidate.url, candidate.contentType);

      if (mediaType && !media[mediaType].includes(candidate.url)) {
        media[mediaType].push(candidate.url);
      }
    }
  }

  return media;
}

function sanitizeFactValue(value) {
  return value
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/\b(?:right now|rn|currently|at the moment|for now|lol|lmao|haha|tbh|btw|tho|though)$/gi, '')
    .trim()
    .replace(/[.!?]+$/g, '');
}

function createKnowledgeEntry(category, fact) {
  const cleanedFact = sanitizeFactValue(fact);

  if (!cleanedFact || cleanedFact.length < 2 || cleanedFact.length > 160) {
    return null;
  }

  return {
    category,
    fact: cleanedFact
  };
}

function addKnowledgeFact(extractedEntries, seenFacts, category, fact) {
  const knowledgeEntry = createKnowledgeEntry(category, fact);

  if (!knowledgeEntry) {
    return;
  }

  const localSignature = `${knowledgeEntry.category}|${knowledgeEntry.fact.toLowerCase()}`;

  if (!seenFacts.has(localSignature)) {
    extractedEntries.push(knowledgeEntry);
    seenFacts.add(localSignature);
  }
}

function isLikelyRoleFact(value) {
  const roleText = sanitizeFactValue(value).toLowerCase();

  if (!roleText || roleText.split(' ').length > 8) {
    return false;
  }

  return [
    'developer',
    'engineer',
    'designer',
    'student',
    'founder',
    'owner',
    'manager',
    'artist',
    'writer',
    'teacher',
    'producer',
    'creator',
    'marketer',
    'admin',
    'moderator',
    'freelancer',
    'consultant'
  ].some((keyword) => roleText.includes(keyword));
}

function buildKnowledgeSignature(userId, category, fact) {
  return `${userId}|${category}|${fact.toLowerCase()}`;
}

function normalizeKnowledgeCategory(category) {
  const normalizedCategory = (category || '').trim().toLowerCase();
  const categoryMap = {
    identity: 'identity',
    profile: 'profile',
    bio: 'profile',
    pronouns: 'profile',
    pronoun: 'profile',
    location: 'location',
    work: 'work',
    career: 'work',
    education: 'education',
    preference: 'preference',
    preferences: 'preference',
    likes: 'preference',
    project: 'project',
    projects: 'project',
    tooling: 'tooling',
    tools: 'tooling',
    tech: 'tooling',
    stack: 'tooling',
    contact: 'contact'
  };

  return categoryMap[normalizedCategory] || 'profile';
}

function isMeaningfulKnowledgeFact(fact) {
  const cleanedFact = sanitizeFactValue(fact);
  const normalizedFact = cleanedFact.toLowerCase().replace(/^[a-z ]+:\s*/i, '');

  if (!cleanedFact || cleanedFact.length < 6 || cleanedFact.length > 160) {
    return false;
  }

  if ([
    'unknown',
    'n/a',
    'none',
    'nothing',
    'idk',
    'not sure',
    'maybe',
    'unsure'
  ].includes(normalizedFact)) {
    return false;
  }

  return true;
}

function extractJsonObjectFromText(value) {
  if (!value) {
    return null;
  }

  const fencedJsonMatch = value.match(/```json\s*([\s\S]*?)```/i) || value.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedJsonMatch?.[1] || value;
  const firstBraceIndex = candidate.indexOf('{');
  const lastBraceIndex = candidate.lastIndexOf('}');

  if (firstBraceIndex === -1 || lastBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(firstBraceIndex, lastBraceIndex + 1));
  } catch {
    return null;
  }
}

function getGeminiModelCandidates() {
  return [...new Set([
    geminiModel,
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro'
  ].filter(Boolean))];
}

async function extractKnowledgeEntriesWithGemini(messages, context) {
  if (!geminiApiKey) {
    return [];
  }

  console.log(`[julian] Gemini extraction requested for ${messages.length} messages in ${context.serverName} / #${context.channelName}`);

  const transcript = messages
    .map((message, index) => [
      `Message ${index + 1}`,
      `messageId: ${message.messageId}`,
      `timestamp: ${message.timestamp}`,
      `authorUserId: ${message.authorUserId}`,
      `authorUsername: ${message.authorUsername}`,
      `threadId: ${message.threadId || ''}`,
      `text: ${message.message || '[no text]'}`
    ].join('\n'))
    .join('\n\n');
  const prompt = [
    'Extract durable, person-specific knowledge for a CRM knowledge bank from the Discord messages below.',
    'Return JSON only with the shape {"facts":[{"messageId":"string","authorUserId":"string","authorUsername":"string","category":"identity|profile|location|work|education|preference|project|tooling|contact","fact":"string"}]}',
    'Rules:',
    '- Only extract facts about the speaker themselves.',
    '- Only include durable, useful facts that help identify or understand the person later.',
    '- Ignore jokes, filler, hype, uncertainty, temporary status, questions, requests, and facts about other people.',
    '- Keep each fact short and specific.',
    '- Do not invent facts.',
    `Server: ${context.serverName}`,
    `Channel: ${context.channelName}`,
    'Messages:',
    transcript
  ].join('\n');
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };
  let lastError;

  for (const modelName of getGeminiModelCandidates()) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastError = new Error(`Gemini request failed for ${modelName}: ${response.status} ${errorText}`);

      if (response.status === 404) {
        console.warn(`[julian] Gemini model ${modelName} is unavailable, trying next fallback`);
        continue;
      }

      throw lastError;
    }

    const payload = await response.json();
    const responseText = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('\n') || '';
    const parsed = extractJsonObjectFromText(responseText);
    const facts = Array.isArray(parsed?.facts) ? parsed.facts : [];

    console.log(`[julian] Gemini model ${modelName} returned ${facts.length} candidate fact(s)`);

    return facts.filter((fact) => fact && typeof fact === 'object');
  }

  throw lastError || new Error('Gemini request failed for all configured models.');
}

function extractKnowledgeEntries(message) {
  const content = (message.cleanContent?.trim() || message.content?.trim() || '');

  if (!content) {
    return [];
  }

  const segments = content
    .split(/\r?\n|(?<=[.!?])\s+|;\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const extractedEntries = [];
  const seenFacts = new Set();

  for (const segment of segments) {
    const rules = [
      {
        category: 'identity',
        regex: /\bmy name is\s+(.{1,80})$/i,
        format: (match) => `Name: ${match[1]}`
      },
      {
        category: 'identity',
        regex: /\b(?:call me|i go by)\s+(.{1,80})$/i,
        format: (match) => `Preferred name: ${match[1]}`
      },
      {
        category: 'profile',
        regex: /\b(?:my pronouns are|pronouns:? )\s*(.{1,40})$/i,
        format: (match) => `Pronouns: ${match[1]}`
      },
      {
        category: 'location',
        regex: /\b(?:i live in|i am from|i'm from|im from|i am based in|i'm based in|im based in|based in)\s+(.{1,80})$/i,
        format: (match) => `Location: ${match[1]}`
      },
      {
        category: 'work',
        regex: /\b(?:i work at|i work for|working at|working for)\s+(.{1,80})$/i,
        format: (match) => `Workplace: ${match[1]}`
      },
      {
        category: 'work',
        regex: /\b(?:i work as|my job is|i am a|i'm a|im a|i am an|i'm an|im an)\s+(.{1,80})$/i,
        format: (match) => `Role: ${match[1]}`,
        validate: (match) => isLikelyRoleFact(match[1])
      },
      {
        category: 'education',
        regex: /\b(?:i study at|i go to|i'm studying at|im studying at)\s+(.{1,80})$/i,
        format: (match) => `Education: ${match[1]}`
      },
      {
        category: 'preference',
        regex: /\bmy favou?rite ([a-z ][a-z ]{1,28}) is\s+(.{1,80})$/i,
        format: (match) => `Favorite ${match[1]}: ${match[2]}`
      },
      {
        category: 'preference',
        regex: /\bi(?: like| love| enjoy| prefer)\s+(.{1,100})$/i,
        format: (match) => `Likes ${match[1]}`
      },
      {
        category: 'project',
        regex: /\b(?:i am working on|i'm working on|im working on|working on|i am building|i'm building|im building|building|i built|i have built|i made|i am making|i'm making|im making)\s+(.{1,120})$/i,
        format: (match) => `Project: ${match[1]}`
      },
      {
        category: 'tooling',
        regex: /\b(?:i use|i'm using|im using|we use|built with|made with)\s+(.{1,120})$/i,
        format: (match) => `Uses ${match[1]}`
      }
    ];

    for (const rule of rules) {
      const match = segment.match(rule.regex);

      if (!match) {
        continue;
      }

      if (typeof rule.validate === 'function' && !rule.validate(match)) {
        continue;
      }

      addKnowledgeFact(extractedEntries, seenFacts, rule.category, rule.format(match));
    }
  }

  const emailMatches = [...content.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)];

  for (const emailMatch of emailMatches) {
    addKnowledgeFact(extractedEntries, seenFacts, 'contact', `Email: ${emailMatch[0]}`);
  }

  return extractedEntries;
}

async function ensureSheetExists(targetSheetName) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheet = spreadsheet.data.sheets?.find(
    (sheet) => sheet.properties?.title === targetSheetName
  );

  if (existingSheet) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: targetSheetName
            }
          }
        }
      ]
    }
  });
}

async function ensureKnowledgeSheetReady() {
  const knowledgeSheetCacheKey = `${spreadsheetId}:${knowledgeSheetName}`;

  if (ensuredSheets.has(knowledgeSheetCacheKey)) {
    return;
  }

  await ensureSheetExists(knowledgeSheetName);

  const headerRange = `${knowledgeSheetName}!A1:H1`;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange
  });
  const firstRow = headerResponse.data.values?.[0] || [];

  if (knowledgeSheetHeaders.some((header, index) => firstRow[index] !== header)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [knowledgeSheetHeaders]
      }
    });
  }

  const knowledgeRowsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${knowledgeSheetName}!A2:D`
  });
  const knowledgeRows = knowledgeRowsResponse.data.values || [];

  knowledgeSignatures.clear();

  for (const row of knowledgeRows) {
    const [userId, , category, fact] = row;

    if (!userId || !category || !fact) {
      continue;
    }

    knowledgeSignatures.add(buildKnowledgeSignature(userId, category, fact));
  }

  ensuredSheets.add(knowledgeSheetCacheKey);
  console.log(`Knowledge bank ready: ${knowledgeSheetName}`);
}

async function ensurePeopleSheetReady() {
  const peopleSheetCacheKey = `${spreadsheetId}:${peopleSheetName}`;

  if (ensuredSheets.has(peopleSheetCacheKey)) {
    return;
  }

  await ensureSheetExists(peopleSheetName);

  const headerRange = `${peopleSheetName}!A1:K1`;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange
  });
  const firstRow = headerResponse.data.values?.[0] || [];

  if (peopleSheetHeaders.some((header, index) => firstRow[index] !== header)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [peopleSheetHeaders]
      }
    });
  }

  const peopleRowsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${peopleSheetName}!A2:K`
  });
  const peopleRows = peopleRowsResponse.data.values || [];

  peopleRowIndexByUserId.clear();
  peopleDataByUserId.clear();

  for (const [index, row] of peopleRows.entries()) {
    const userId = row[0];

    if (!userId) {
      continue;
    }

    peopleRowIndexByUserId.set(userId, index + 2);
    peopleDataByUserId.set(userId, {
      userId: row[0] || '',
      username: row[1] || '',
      displayName: row[2] || '',
      avatarUrl: row[3] || '',
      firstSeenAt: row[4] || '',
      lastSeenAt: row[5] || '',
      lastMessage: row[6] || '',
      messageCount: Number(row[7] || 0),
      factCount: Number(row[8] || 0),
      lastChannel: row[9] || '',
      lastServer: row[10] || ''
    });
  }

  ensuredSheets.add(peopleSheetCacheKey);
  console.log(`People directory ready: ${peopleSheetName}`);
}

async function ensureJulianScansSheetReady() {
  const julianScansSheetCacheKey = `${spreadsheetId}:${julianScansSheetName}`;

  if (ensuredSheets.has(julianScansSheetCacheKey)) {
    return;
  }

  await ensureSheetExists(julianScansSheetName);

  const headerRange = `${julianScansSheetName}!A1:I1`;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange
  });
  const firstRow = headerResponse.data.values?.[0] || [];

  if (julianScansSheetHeaders.some((header, index) => firstRow[index] !== header)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [julianScansSheetHeaders]
      }
    });
  }

  ensuredSheets.add(julianScansSheetCacheKey);
  console.log(`Julian scans ready: ${julianScansSheetName}`);
}

function getChannelName(message) {
  return message.channel?.isTextBased() && 'name' in message.channel ? message.channel.name : 'unknown';
}

function buildPersonRow(message, existingPerson = null, factIncrement = 0) {
  const lastMessage = (message.cleanContent?.trim() || message.content?.trim() || '').slice(0, 500);
  const avatarUrl = message.author.displayAvatarURL({ extension: 'png', size: 256 });
  const now = message.createdAt.toISOString();

  return {
    userId: message.author.id,
    username: message.author.username,
    displayName: message.member?.displayName || message.author.globalName || message.author.username,
    avatarUrl,
    firstSeenAt: existingPerson?.firstSeenAt || now,
    lastSeenAt: now,
    lastMessage,
    messageCount: (existingPerson?.messageCount || 0) + 1,
    factCount: (existingPerson?.factCount || 0) + factIncrement,
    lastChannel: getChannelName(message),
    lastServer: message.guild?.name || 'DM'
  };
}

function toPeopleSheetRow(person) {
  return [[
    person.userId,
    person.username,
    person.displayName,
    person.avatarUrl,
    person.firstSeenAt,
    person.lastSeenAt,
    person.lastMessage,
    String(person.messageCount),
    String(person.factCount),
    person.lastChannel,
    person.lastServer
  ]];
}

async function upsertPersonRecord(message, factIncrement = 0) {
  await ensurePeopleSheetReady();

  const existingPerson = peopleDataByUserId.get(message.author.id) || null;
  const person = buildPersonRow(message, existingPerson, factIncrement);
  const existingRowIndex = peopleRowIndexByUserId.get(message.author.id);

  if (existingRowIndex) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${peopleSheetName}!A${existingRowIndex}:K${existingRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: toPeopleSheetRow(person)
      }
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${peopleSheetName}!A:K`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: toPeopleSheetRow(person)
      }
    });

    const newRowIndex = peopleDataByUserId.size + 2;
    peopleRowIndexByUserId.set(message.author.id, newRowIndex);
  }

  peopleDataByUserId.set(message.author.id, person);
}

async function ensureSheetReady() {
  const messageSheetCacheKey = `${spreadsheetId}:${sheetName}`;

  if (ensuredSheets.has(messageSheetCacheKey)) {
    return;
  }

  await ensureSheetExists(sheetName);

  const headerRange = `${sheetName}!A1:F1`;
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange
  });

  const firstRow = headerResponse.data.values?.[0] || [];

  if (sheetHeaders.some((header, index) => firstRow[index] !== header)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [sheetHeaders]
      }
    });
  }

  ensuredSheets.add(messageSheetCacheKey);
  console.log(`Google Sheets ready: ${sheetName} (${spreadsheetId})`);
}

async function appendMessageRow(message) {
  const textContent = message.cleanContent?.trim() || message.content?.trim() || '';
  const media = extractMediaUrls(message);

  await ensureSheetReady();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:F`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        message.createdAt.toISOString(),
        message.author.username,
        textContent,
        media.images.join('\n'),
        media.videos.join('\n'),
        media.gifs.join('\n')
      ]]
    }
  });

  console.log(`Appended row to ${sheetName} for ${message.author.tag}`);
}

async function appendKnowledgeEntries(message) {
  const textContent = message.cleanContent?.trim() || message.content?.trim() || '';
  const knowledgeEntries = extractKnowledgeEntries(message);

  if (!knowledgeEntries.length) {
    return 0;
  }

  await ensureKnowledgeSheetReady();

  const channelName = getChannelName(message);
  const serverName = message.guild?.name || 'DM';
  const newRows = [];

  for (const knowledgeEntry of knowledgeEntries) {
    const signature = buildKnowledgeSignature(
      message.author.id,
      knowledgeEntry.category,
      knowledgeEntry.fact
    );

    if (knowledgeSignatures.has(signature)) {
      continue;
    }

    newRows.push([
      message.author.id,
      message.author.username,
      knowledgeEntry.category,
      knowledgeEntry.fact,
      textContent,
      message.createdAt.toISOString(),
      channelName,
      serverName
    ]);
    knowledgeSignatures.add(signature);
  }

  if (!newRows.length) {
    return 0;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${knowledgeSheetName}!A:H`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: newRows
    }
  });

  console.log(`Updated knowledge bank for ${message.author.tag} with ${newRows.length} fact(s)`);
  return newRows.length;
}

async function appendStructuredKnowledgeFacts(knowledgeFacts, messageLookup, context) {
  if (!knowledgeFacts.length) {
    console.log(`[julian] No structured AI facts to append for ${context.serverName} / #${context.channelName}`);
    return {
      totalFactsAdded: 0,
      factsAddedByUserId: new Map(),
      factsAddedByMessageId: new Map()
    };
  }

  await ensureKnowledgeSheetReady();

  const newRows = [];
  const factsAddedByUserId = new Map();
  const factsAddedByMessageId = new Map();

  for (const knowledgeFact of knowledgeFacts) {
    const messageRecord = messageLookup.get(knowledgeFact.messageId);

    if (!messageRecord) {
      continue;
    }

    const category = normalizeKnowledgeCategory(knowledgeFact.category);
    const fact = sanitizeFactValue(knowledgeFact.fact || '');

    if (!isMeaningfulKnowledgeFact(fact)) {
      continue;
    }

    const signature = buildKnowledgeSignature(messageRecord.authorUserId, category, fact);

    if (knowledgeSignatures.has(signature)) {
      continue;
    }

    newRows.push([
      messageRecord.authorUserId,
      messageRecord.authorUsername,
      category,
      fact,
      (messageRecord.message || '').slice(0, 500),
      messageRecord.timestamp,
      context.channelName,
      context.serverName
    ]);
    knowledgeSignatures.add(signature);
    factsAddedByUserId.set(
      messageRecord.authorUserId,
      (factsAddedByUserId.get(messageRecord.authorUserId) || 0) + 1
    );
    factsAddedByMessageId.set(
      messageRecord.messageId,
      (factsAddedByMessageId.get(messageRecord.messageId) || 0) + 1
    );
  }

  if (!newRows.length) {
    console.log(`[julian] Structured AI facts were all filtered or already known for ${context.serverName} / #${context.channelName}`);
    return {
      totalFactsAdded: 0,
      factsAddedByUserId,
      factsAddedByMessageId
    };
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${knowledgeSheetName}!A:H`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: newRows
    }
  });

  console.log(`[julian] Appended ${newRows.length} AI knowledge fact(s) to ${knowledgeSheetName}`);

  return {
    totalFactsAdded: newRows.length,
    factsAddedByUserId,
    factsAddedByMessageId
  };
}

async function persistJulianScanRun(scanRun) {
  await ensureJulianScansSheetReady();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${julianScansSheetName}!A:I`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        scanRun.scanId,
        scanRun.triggeredByUserId,
        scanRun.triggeredByUsername,
        scanRun.triggeredAt,
        scanRun.channel,
        scanRun.server,
        String(scanRun.totalMessages),
        String(scanRun.totalFactsAdded),
        JSON.stringify(scanRun.messages)
      ]]
    }
  });
}

async function getSheetRows(range) {
  await initializeGoogleSheets();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });

  return response.data.values || [];
}

function getThreadStartTitle(messages) {
  const firstMessageWithText = messages.find((message) => message.message);

  if (firstMessageWithText?.message) {
    return firstMessageWithText.message.slice(0, 72);
  }

  const participants = [...new Set(messages.map((message) => message.sender).filter(Boolean))];
  return participants.length ? participants.slice(0, 3).join(', ') : 'Conversation';
}

function buildConversationThreads(messages) {
  const sortedMessages = [...messages].sort((left, right) => {
    const leftValue = getTimestampValue(left.timestamp) || 0;
    const rightValue = getTimestampValue(right.timestamp) || 0;
    return leftValue - rightValue;
  });
  const threadGapMs = 30 * 60 * 1000;
  const threads = [];
  let currentThread = null;

  for (const message of sortedMessages) {
    const messageTimestamp = getTimestampValue(message.timestamp);
    const currentEndValue = currentThread ? getTimestampValue(currentThread.endedAt) : null;
    const shouldStartNewThread = !currentThread
      || messageTimestamp === null
      || currentEndValue === null
      || (messageTimestamp - currentEndValue) > threadGapMs;

    if (shouldStartNewThread) {
      currentThread = {
        threadId: `thread-${threads.length + 1}-${message.timestamp || 'undated'}`,
        title: '',
        startedAt: message.timestamp,
        endedAt: message.timestamp,
        messageCount: 0,
        participants: [],
        messages: []
      };
      threads.push(currentThread);
    }

    currentThread.messages.push({ ...message });
    currentThread.endedAt = message.timestamp || currentThread.endedAt;
    currentThread.messageCount += 1;

    if (message.sender && !currentThread.participants.includes(message.sender)) {
      currentThread.participants.push(message.sender);
    }
  }

  const threadByMessageKey = new Map();

  for (const thread of threads) {
    thread.title = getThreadStartTitle(thread.messages);

    for (const message of thread.messages) {
      const key = JSON.stringify([
        message.timestamp || '',
        message.sender || '',
        message.message || ''
      ]);
      threadByMessageKey.set(key, {
        threadId: thread.threadId,
        threadStartedAt: thread.startedAt,
        threadEndedAt: thread.endedAt,
        threadMessageCount: thread.messageCount
      });
    }
  }

  const messagesWithThreads = sortedMessages
    .map((message) => {
      const key = JSON.stringify([
        message.timestamp || '',
        message.sender || '',
        message.message || ''
      ]);
      return {
        ...message,
        ...(threadByMessageKey.get(key) || {})
      };
    })
    .reverse();

  return {
    messages: messagesWithThreads,
    threads: threads
      .map((thread) => ({
        ...thread,
        messages: thread.messages.map((message) => {
          const key = JSON.stringify([
            message.timestamp || '',
            message.sender || '',
            message.message || ''
          ]);

          return {
            ...message,
            ...(threadByMessageKey.get(key) || {})
          };
        })
      }))
      .reverse()
  };
}

async function getMessagesForDashboard() {
  const rows = await getSheetRows(`${sheetName}!A2:F`);
  const seenSignatures = new Set();

  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => ({
      timestamp: row[0] || '',
      sender: row[1] || '',
      message: row[2] || '',
      images: row[3] ? row[3].split('\n').filter(Boolean) : [],
      videos: row[4] ? row[4].split('\n').filter(Boolean) : [],
      gifs: row[5] ? row[5].split('\n').filter(Boolean) : []
    }))
    .filter((row) => {
      const signature = buildMessageRowSignature(row);

      if (seenSignatures.has(signature)) {
        return false;
      }

      seenSignatures.add(signature);
      return true;
    })
    .reverse();
}

async function getThreadedMessagesForDashboard() {
  const messages = await getMessagesForDashboard();
  return buildConversationThreads(messages);
}

function createLegacyPersonId(username) {
  return `message-log:${username.toLowerCase()}`;
}

function getTimestampValue(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function pickLatestIso(left, right) {
  const leftValue = getTimestampValue(left);
  const rightValue = getTimestampValue(right);

  if (leftValue === null) {
    return right || left;
  }

  if (rightValue === null) {
    return left;
  }

  return rightValue > leftValue ? right : left;
}

function pickEarliestIso(left, right) {
  const leftValue = getTimestampValue(left);
  const rightValue = getTimestampValue(right);

  if (leftValue === null) {
    return right || left;
  }

  if (rightValue === null) {
    return left;
  }

  return rightValue < leftValue ? right : left;
}

function mergePersonRecords(existingPerson, inferredPerson) {
  const latestSeenAt = pickLatestIso(existingPerson.lastSeenAt, inferredPerson.lastSeenAt);

  return {
    userId: existingPerson.userId,
    username: existingPerson.username || inferredPerson.username,
    displayName: existingPerson.displayName || inferredPerson.displayName,
    avatarUrl: existingPerson.avatarUrl || inferredPerson.avatarUrl,
    firstSeenAt: pickEarliestIso(existingPerson.firstSeenAt, inferredPerson.firstSeenAt),
    lastSeenAt: latestSeenAt,
    lastMessage: latestSeenAt === inferredPerson.lastSeenAt ? inferredPerson.lastMessage : existingPerson.lastMessage,
    messageCount: Math.max(existingPerson.messageCount || 0, inferredPerson.messageCount || 0),
    factCount: Math.max(existingPerson.factCount || 0, inferredPerson.factCount || 0),
    lastChannel: existingPerson.lastChannel || inferredPerson.lastChannel,
    lastServer: existingPerson.lastServer || inferredPerson.lastServer
  };
}

function buildMessageRowSignature(message) {
  return JSON.stringify([
    message.timestamp || '',
    message.sender || '',
    message.message || '',
    message.images || [],
    message.videos || [],
    message.gifs || []
  ]);
}

function shouldProcessDiscordMessage(message) {
  const now = Date.now();

  for (const [messageId, processedAt] of recentlyProcessedMessageIds.entries()) {
    if (now - processedAt > 5 * 60 * 1000) {
      recentlyProcessedMessageIds.delete(messageId);
    }
  }

  if (recentlyProcessedMessageIds.has(message.id)) {
    return false;
  }

  recentlyProcessedMessageIds.set(message.id, now);
  return true;
}

function isJulianUserAllowed(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  return julianAllowedUserIds.has(interaction.user.id);
}

async function registerJulianCommand(readyClient) {
  const commandData = julianCommand.toJSON();

  for (const guild of readyClient.guilds.cache.values()) {
    const existingCommands = await guild.commands.fetch();
    const existingCommand = existingCommands.find((command) => command.name === commandData.name);

    if (existingCommand) {
      await existingCommand.edit(commandData);
      continue;
    }

    await guild.commands.create(commandData);
  }
}

async function scanRecentMessagesForKnowledge(channel) {
  const fetchedMessages = await channel.messages.fetch({ limit: 10 });
  const messages = [...fetchedMessages.values()]
    .filter((message) => !message.author.bot)
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp);
  const channelName = channel?.name || 'unknown';
  const serverName = channel?.guild?.name || 'DM';
  console.log(`[julian] Scanning ${messages.length} recent message(s) in ${serverName} / #${channelName}`);
  const addedFactsByUserId = new Map();
  const collectedMessages = [];
  let totalFactsAdded = 0;

  for (const message of messages) {
    const media = extractMediaUrls(message);

    collectedMessages.push({
      messageId: message.id,
      timestamp: message.createdAt.toISOString(),
      authorUserId: message.author.id,
      authorUsername: message.author.username,
      message: message.cleanContent?.trim() || message.content?.trim() || '',
      images: media.images,
      videos: media.videos,
      gifs: media.gifs,
      factsAdded: 0
    });
  }

  const messageLookup = new Map(collectedMessages.map((message) => [message.messageId, message]));

  if (geminiApiKey) {
    try {
      const aiFacts = await extractKnowledgeEntriesWithGemini(collectedMessages, { channelName, serverName });
      const aiSummary = await appendStructuredKnowledgeFacts(aiFacts, messageLookup, { channelName, serverName });

      totalFactsAdded = aiSummary.totalFactsAdded;
      console.log(`[julian] Gemini flow added ${totalFactsAdded} fact(s)`);

      for (const message of collectedMessages) {
        message.factsAdded = aiSummary.factsAddedByMessageId.get(message.messageId) || 0;
      }

      for (const message of collectedMessages) {
        const userFactCount = aiSummary.factsAddedByUserId.get(message.authorUserId) || 0;

        if (!userFactCount) {
          continue;
        }

        if (!addedFactsByUserId.has(message.authorUserId)) {
          addedFactsByUserId.set(message.authorUserId, {
            username: message.authorUsername,
            count: userFactCount
          });
        }
      }
    } catch (error) {
      console.error('Gemini extraction failed for /julian, falling back to rules:', error);
    }
  } else {
    console.log('[julian] GEMINI_API_KEY not set, using fallback rule extraction');
  }

  if (!totalFactsAdded) {
    console.log('[julian] Falling back to rule-based extraction');
    for (const message of messages) {
      const factsAdded = await appendKnowledgeEntries(message);
      const collectedMessage = messageLookup.get(message.id);

      if (collectedMessage) {
        collectedMessage.factsAdded = factsAdded;
      }

      if (!factsAdded) {
        continue;
      }

      totalFactsAdded += factsAdded;
      const existingSummary = addedFactsByUserId.get(message.author.id) || {
        username: message.author.username,
        count: 0
      };

      existingSummary.count += factsAdded;
      addedFactsByUserId.set(message.author.id, existingSummary);
    }

    console.log(`[julian] Rule-based fallback added ${totalFactsAdded} fact(s)`);
  }

  const threadedScanMessages = buildConversationThreads(
    collectedMessages.map((message) => ({
      timestamp: message.timestamp,
      sender: message.authorUsername,
      message: message.message,
      images: message.images,
      videos: message.videos,
      gifs: message.gifs
    }))
  );
  const threadMetaByMessageKey = new Map(
    threadedScanMessages.messages.map((message) => [
      JSON.stringify([message.timestamp || '', message.sender || '', message.message || '']),
      message
    ])
  );

  return {
    scannedMessages: messages.length,
    totalFactsAdded,
    addedFactsByUser: [...addedFactsByUserId.values()].sort((left, right) => right.count - left.count),
    threads: threadedScanMessages.threads,
    messages: collectedMessages.map((message) => ({
      ...message,
      ...(threadMetaByMessageKey.get(
        JSON.stringify([message.timestamp || '', message.authorUsername || '', message.message || ''])
      ) || {})
    }))
  };
}

async function getDiscordMembersForDashboard(factCountByUserId) {
  const memberPeopleByUserId = new Map();

  for (const guild of client.guilds.cache.values()) {
    try {
      const members = await guild.members.fetch();

      for (const member of members.values()) {
        if (member.user.bot) {
          continue;
        }

        const existingMember = memberPeopleByUserId.get(member.user.id);
        const memberProfile = {
          userId: member.user.id,
          username: member.user.username,
          displayName: member.displayName || member.user.globalName || member.user.username,
          avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
          firstSeenAt: existingMember?.firstSeenAt || '',
          lastSeenAt: existingMember?.lastSeenAt || '',
          lastMessage: existingMember?.lastMessage || '',
          messageCount: existingMember?.messageCount || 0,
          factCount: Math.max(existingMember?.factCount || 0, factCountByUserId.get(member.user.id) || 0),
          lastChannel: existingMember?.lastChannel || '',
          lastServer: existingMember?.lastServer || guild.name
        };

        memberPeopleByUserId.set(member.user.id, memberProfile);
      }
    } catch (error) {
      console.warn(`Unable to fetch members for guild ${guild.name}:`, error.message || error);
    }
  }

  return [...memberPeopleByUserId.values()];
}

async function getPeopleForDashboard() {
  await ensurePeopleSheetReady();

  const [messages, knowledge] = await Promise.all([
    getMessagesForDashboard(),
    getKnowledgeForDashboard()
  ]);

  const existingPeople = [...peopleDataByUserId.values()].map((person) => ({ ...person }));
  const factCountByUserId = new Map();
  const factCountByUsername = new Map();

  for (const fact of knowledge) {
    if (fact.userId) {
      factCountByUserId.set(fact.userId, (factCountByUserId.get(fact.userId) || 0) + 1);
    }

    if (fact.username) {
      const usernameKey = fact.username.toLowerCase();
      factCountByUsername.set(usernameKey, (factCountByUsername.get(usernameKey) || 0) + 1);
    }
  }

  const memberPeople = await getDiscordMembersForDashboard(factCountByUserId);
  const userIdByUsername = new Map(
    [...existingPeople, ...memberPeople]
      .filter((person) => person.username)
      .map((person) => [person.username.toLowerCase(), person.userId])
  );

  const inferredPeopleById = new Map();

  for (const message of messages) {
    if (!message.sender) {
      continue;
    }

    const usernameKey = message.sender.toLowerCase();
    const knownUserId = userIdByUsername.get(usernameKey);
    const personId = knownUserId || createLegacyPersonId(message.sender);
    const existingPerson = existingPeople.find((person) => person.userId === personId);
    const inferredPerson = inferredPeopleById.get(personId) || {
      userId: personId,
      username: message.sender,
      displayName: existingPerson?.displayName || message.sender,
      avatarUrl: existingPerson?.avatarUrl || '',
      firstSeenAt: message.timestamp,
      lastSeenAt: message.timestamp,
      lastMessage: message.message || '',
      messageCount: 0,
      factCount: knownUserId
        ? (factCountByUserId.get(knownUserId) || existingPerson?.factCount || 0)
        : (factCountByUsername.get(usernameKey) || 0),
      lastChannel: existingPerson?.lastChannel || '',
      lastServer: existingPerson?.lastServer || ''
    };

    inferredPerson.firstSeenAt = pickEarliestIso(inferredPerson.firstSeenAt, message.timestamp);
    inferredPerson.lastSeenAt = pickLatestIso(inferredPerson.lastSeenAt, message.timestamp);

    if (inferredPerson.lastSeenAt === message.timestamp) {
      inferredPerson.lastMessage = message.message || inferredPerson.lastMessage;
    }

    inferredPerson.messageCount += 1;
    inferredPeopleById.set(personId, inferredPerson);
  }

  const mergedPeopleById = new Map(existingPeople.map((person) => [person.userId, person]));

  for (const memberPerson of memberPeople) {
    if (mergedPeopleById.has(memberPerson.userId)) {
      const existingPerson = mergedPeopleById.get(memberPerson.userId);
      mergedPeopleById.set(memberPerson.userId, mergePersonRecords(existingPerson, memberPerson));
      continue;
    }

    mergedPeopleById.set(memberPerson.userId, memberPerson);
  }

  for (const inferredPerson of inferredPeopleById.values()) {
    if (mergedPeopleById.has(inferredPerson.userId)) {
      const existingPerson = mergedPeopleById.get(inferredPerson.userId);
      mergedPeopleById.set(inferredPerson.userId, mergePersonRecords(existingPerson, inferredPerson));
      continue;
    }

    mergedPeopleById.set(inferredPerson.userId, inferredPerson);
  }

  return [...mergedPeopleById.values()]
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
}

async function getPersonProfile(userId) {
  const [people, messages, knowledge] = await Promise.all([
    getPeopleForDashboard(),
    getMessagesForDashboard(),
    getKnowledgeForDashboard()
  ]);
  const person = people.find((entry) => entry.userId === userId);

  if (!person) {
    return null;
  }

  return {
    person,
    messages: messages.filter((entry) => entry.sender === person.username).slice(0, 50),
    knowledge: knowledge.filter((entry) => entry.userId === userId || entry.username.toLowerCase() === person.username.toLowerCase())
  };
}

async function getKnowledgeForDashboard() {
  const rows = await getSheetRows(`${knowledgeSheetName}!A2:H`);

  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => ({
      userId: row[0] || '',
      username: row[1] || '',
      category: row[2] || '',
      fact: row[3] || '',
      sourceMessage: row[4] || '',
      observedAt: row[5] || '',
      channel: row[6] || '',
      server: row[7] || ''
    }))
    .reverse();
}

async function getJulianScansForDashboard() {
  const rows = await getSheetRows(`${julianScansSheetName}!A2:I`);

  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => {
      let messages = [];

      try {
        messages = row[8] ? JSON.parse(row[8]) : [];
      } catch {
        messages = [];
      }

      const threadedMessages = buildConversationThreads(
        messages.map((message) => ({
          timestamp: message.timestamp || '',
          sender: message.authorUsername || '',
          message: message.message || '',
          images: message.images || [],
          videos: message.videos || [],
          gifs: message.gifs || []
        }))
      );
      const threadMetaByMessageKey = new Map(
        threadedMessages.messages.map((message) => [
          JSON.stringify([message.timestamp || '', message.sender || '', message.message || '']),
          message
        ])
      );

      return {
        scanId: row[0] || '',
        triggeredByUserId: row[1] || '',
        triggeredByUsername: row[2] || '',
        triggeredAt: row[3] || '',
        channel: row[4] || '',
        server: row[5] || '',
        totalMessages: Number(row[6] || 0),
        totalFactsAdded: Number(row[7] || 0),
        threads: threadedMessages.threads,
        messages: messages.map((message) => {
          const threadMeta = threadMetaByMessageKey.get(
            JSON.stringify([message.timestamp || '', message.authorUsername || '', message.message || ''])
          ) || {};

          return {
            ...message,
            ...threadMeta
          };
        })
      };
    })
    .reverse();
}

function getDashboardAsset(fileName) {
  return new URL(`./public/${fileName}`, import.meta.url);
}

function getUiBuildAsset(fileName) {
  return new URL(`./UI/dist/${fileName}`, import.meta.url);
}

function getContentType(fileName) {
  switch (extname(fileName).toLowerCase()) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.ttf':
      return 'font/ttf';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function normalizeAssetPath(pathname) {
  const sanitizedPath = decodeURIComponent(pathname).replace(/^\/+/, '');

  if (!sanitizedPath || sanitizedPath.includes('..') || sanitizedPath.includes('\0')) {
    return null;
  }

  return sanitizedPath;
}

function sendJson(response, statusCode, payload, includeBody = true) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(includeBody ? JSON.stringify(payload) : undefined);
}

async function serveDashboardAsset(response, fileName, contentType, includeBody = true) {
  try {
    const fileContents = await readFile(getDashboardAsset(fileName), 'utf8');
    response.writeHead(200, {
      'Content-Type': contentType
    });
    response.end(includeBody ? fileContents : undefined);
  } catch {
    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
    response.end(includeBody ? 'Not found' : undefined);
  }
}

async function tryServeUiBuildAsset(response, pathname, includeBody = true) {
  const assetPath = normalizeAssetPath(pathname);

  if (!assetPath) {
    return false;
  }

  try {
    const fileContents = await readFile(getUiBuildAsset(assetPath));
    response.writeHead(200, {
      'Content-Type': getContentType(assetPath)
    });
    response.end(includeBody ? fileContents : undefined);
    return true;
  } catch {
    return false;
  }
}

async function serveDashboardApp(response, pathname, includeBody = true) {
  const servedUiAsset = pathname !== '/' && await tryServeUiBuildAsset(response, pathname, includeBody);

  if (servedUiAsset) {
    return;
  }

  try {
    const fileContents = await readFile(getUiBuildAsset('index.html'), 'utf8');
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8'
    });
    response.end(includeBody ? fileContents : undefined);
  } catch {
    if (pathname === '/') {
      await serveDashboardAsset(response, 'index.html', 'text/html; charset=utf-8', includeBody);
      return;
    }

    if (pathname === '/styles.css') {
      await serveDashboardAsset(response, 'styles.css', 'text/css; charset=utf-8', includeBody);
      return;
    }

    if (pathname === '/app.js') {
      await serveDashboardAsset(response, 'app.js', 'application/javascript; charset=utf-8', includeBody);
      return;
    }

    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8'
    });
    response.end(includeBody ? 'Not found' : undefined);
  }
}

function parseJsonEnv(envVarName) {
  const rawValue = (process.env[envVarName] || '').trim();

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    throw new Error(`Environment variable ${envVarName} must contain valid JSON: ${error.message}`);
  }
}

function startDashboardServer() {
  const dashboardServer = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', `http://${dashboardHost}:${dashboardPort}`);
    const includeBody = request.method !== 'HEAD';

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, {
        'Content-Type': 'text/plain; charset=utf-8'
      });
      response.end('Method not allowed');
      return;
    }

    try {
      if (!requestUrl.pathname.startsWith('/api/')) {
        await serveDashboardApp(response, requestUrl.pathname, includeBody);
        return;
      }

      if (requestUrl.pathname === '/api/messages') {
        const { messages, threads } = await getThreadedMessagesForDashboard();
        sendJson(response, 200, { messages, threads }, includeBody);
        return;
      }

      if (requestUrl.pathname === '/api/people') {
        const people = await getPeopleForDashboard();
        sendJson(response, 200, { people }, includeBody);
        return;
      }

      if (requestUrl.pathname.startsWith('/api/people/')) {
        const userId = decodeURIComponent(requestUrl.pathname.replace('/api/people/', ''));
        const profile = await getPersonProfile(userId);

        if (!profile) {
          sendJson(response, 404, {
            error: 'Person not found'
          }, includeBody);
          return;
        }

        sendJson(response, 200, profile, includeBody);
        return;
      }

      if (requestUrl.pathname === '/api/knowledge') {
        const knowledge = await getKnowledgeForDashboard();
        sendJson(response, 200, { knowledge }, includeBody);
        return;
      }

      if (requestUrl.pathname === '/api/julian-scans') {
        const scans = await getJulianScansForDashboard();
        sendJson(response, 200, { scans }, includeBody);
        return;
      }

      if (requestUrl.pathname === '/api/status') {
        sendJson(response, 200, {
          ok: true,
          sheetName,
          peopleSheetName,
          knowledgeSheetName,
          julianScansSheetName,
          dashboardPort
        }, includeBody);
        return;
      }

      response.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
      });
      response.end(includeBody ? 'Not found' : undefined);
    } catch (error) {
      console.error('Dashboard request failed:', error);
      sendJson(response, 500, {
        error: 'Dashboard request failed'
      }, includeBody);
    }
  });

  dashboardServer.listen(dashboardPort, dashboardHost, () => {
    console.log(`Dashboard available at http://${dashboardHost}:${dashboardPort}`);
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('clientReady', async (readyClient) => {
  try {
    await initializeGoogleSheets();
    await registerJulianCommand(readyClient);
    startDashboardServer();
    console.log(`Logged in as ${readyClient.user.tag}`);
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error);
    process.exit(1);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'julian') {
    return;
  }

  console.log(`[julian] Slash command received from ${interaction.user.tag} in ${interaction.guild?.name || 'DM'} / #${interaction.channel?.isTextBased() && 'name' in interaction.channel ? interaction.channel.name : 'unknown'}`);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isJulianUserAllowed(interaction)) {
    console.log(`[julian] Access denied for ${interaction.user.tag}`);
    await interaction.editReply('You are not allowed to use `/julian`. Add your user ID to `JULIAN_ALLOWED_USER_IDS` or use an administrator account.');
    return;
  }

  console.log(`[julian] Access granted for ${interaction.user.tag}`);

  if (!interaction.inGuild() || !interaction.channel?.isTextBased() || !('messages' in interaction.channel)) {
    console.log('[julian] Command rejected because the interaction channel is not a supported guild text channel');
    await interaction.editReply('`/julian` can only be used inside a server text channel.');
    return;
  }

  try {
    await initializeGoogleSheets();
    const summary = await scanRecentMessagesForKnowledge(interaction.channel);
    const scanRun = {
      scanId: `julian-${Date.now()}`,
      triggeredByUserId: interaction.user.id,
      triggeredByUsername: interaction.user.username,
      triggeredAt: new Date().toISOString(),
      channel: interaction.channel?.name || 'unknown',
      server: interaction.guild?.name || 'DM',
      totalMessages: summary.scannedMessages,
      totalFactsAdded: summary.totalFactsAdded,
      messages: summary.messages,
      threads: summary.threads
    };
    await persistJulianScanRun(scanRun);
    console.log(`[julian] Scan persisted as ${scanRun.scanId} with ${summary.scannedMessages} message(s) and ${summary.totalFactsAdded} fact(s)`);

    if (!summary.totalFactsAdded) {
      await interaction.editReply(`Scanned ${summary.scannedMessages} recent messages. No new useful knowledge was added.`);
      return;
    }

    const breakdown = summary.addedFactsByUser
      .map((entry) => `@${entry.username}: ${entry.count}`)
      .join('\n');

    await interaction.editReply(
      `Scanned ${summary.scannedMessages} recent messages and added ${summary.totalFactsAdded} new knowledge entr${summary.totalFactsAdded === 1 ? 'y' : 'ies'}.\n\n${breakdown}`
    );
    console.log(`[julian] Completed successfully for ${interaction.user.tag}`);
  } catch (error) {
    console.error('Failed to run /julian:', error);
    await interaction.editReply('`/julian` failed while scanning recent messages.');
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) {
    return;
  }

  if (!shouldProcessDiscordMessage(message)) {
    console.log(`Skipped duplicate message event for ${message.author.tag} (${message.id})`);
    return;
  }

  console.log(
    `Received message in ${message.guild?.name || 'DM'} / #${message.channel?.isTextBased() && 'name' in message.channel ? message.channel.name : 'unknown'} from ${message.author.tag}`
  );

  try {
    await initializeGoogleSheets();
    await appendMessageRow(message);
    const factsAdded = await appendKnowledgeEntries(message);
    await upsertPersonRecord(message, factsAdded);
    console.log(`Logged message from ${message.author.tag}`);
  } catch (error) {
    console.error('Failed to log message:', error);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
