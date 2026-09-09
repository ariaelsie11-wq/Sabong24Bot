const http = require('http');
const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const DAILY_HOUR_UTC = Number(process.env.DAILY_HOUR_UTC || 13); // ~9am US Eastern by default
const DATA_DIR = process.env.DATA_DIR || __dirname;
const STATE_FILE = path.join(DATA_DIR, 'state.json');

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN environment variable. Get one from @BotFather and set it in Railway → Variables.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ---------------------------------------------------------------------------
// Tiny JSON-file "database" for subscribers + last date the daily push went out.
// ---------------------------------------------------------------------------
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return { subscribers: [], lastSentDate: null };
  }
}
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Could not persist state:', e.message);
  }
}
let state = loadState();

// ---------------------------------------------------------------------------
// Content — all original, written for this bot (not attributed quotes from
// real people, to avoid ever misattributing words to someone who didn't say them).
// ---------------------------------------------------------------------------
const TIPS = [
  'Put your phone away during meals together — full attention is a small gift that adds up.',
  'Say thank you for the small things, not just the big ones.',
  'Ask "what was the best part of your day?" before "what\'s for dinner?"',
  'Repair quickly after an argument — a short "I\'m sorry, that came out wrong" prevents small fights from becoming big ones.',
  "Learn how your partner prefers to receive affection, and don't assume it matches your own.",
  "Schedule time together the same way you'd schedule anything else important.",
  "Celebrate their wins like they're your own.",
  'Give feedback about behavior, not character — "that hurt me" lands better than "you always do this."',
  'Keep one tradition just for the two of you.',
  'Check in during stressful weeks, even with a one-line text.',
  "Be curious about their inner world, not just their schedule.",
  'Disagree without keeping score.',
  "Physical affection doesn't have to lead anywhere — a hug can just be a hug.",
  "Notice when they're tired or overwhelmed before they say it out loud.",
  'Say what you appreciate about them out loud, not just in your head.',
  "Protect your time together from being the thing that always gets cancelled first.",
  'Ask before giving advice — sometimes people just want to be heard.',
  'Laugh at your own mistakes together instead of around them.',
  "Revisit how you met sometimes — it's a good reminder of why you started.",
  "Make room for their friendships and interests outside the relationship.",
  'Apologize for impact, even if the intent was good.',
  'Plan something to look forward to together, even something small.',
  "Let silence be comfortable sometimes — you don't need to fill every gap.",
  'Ask what "support" means to them right now — it changes depending on the day.',
  'Keep a few inside jokes alive on purpose.',
  'Don\'t let "we\'ll talk later" become "we never talked."',
  'Notice effort, not just results.',
  'Give the benefit of the doubt before assuming the worst.',
  'Make decisions together that affect both of you, even small ones.',
  'End the day on good terms when you can — even a short "goodnight, I love you" resets things.'
];

const QUOTES = [
  'Love is built less in big moments and more in ordinary Tuesdays.',
  'The best partnerships make room for two whole people, not one merged one.',
  'Attention is the currency of closeness.',
  "You don't fall out of love; you stop doing the small things.",
  "A good apology is a bridge, not a debt.",
  'The relationship you have is built from the one you practice daily.',
  'Being chosen every day matters more than being chosen once.',
  'Understanding beats agreeing.',
  'Comfort should never replace curiosity.',
  "Some conflicts aren't solved, just carried gently together.",
  'The smallest kindness repeated becomes the whole relationship.',
  'Two people can be right and still need to listen more.',
  "Love is a decision that gets renewed, not a feeling that's found once.",
  'You can be on the same team and still see things differently.',
  'The quality of your questions shapes the closeness you build.',
  'Growth in a relationship means growing toward each other, on purpose.',
  "Patience is love with its sleeves rolled up.",
  "A relationship doesn't need to be perfect to be safe.",
  'What you water grows — including grudges.',
  'Being known matters more than being impressive.',
  'Real intimacy is being fully seen and still being wanted.',
  "You can't pour from a relationship you never refill.",
  'The way you fight matters more than whether you fight.',
  'Small consistency beats occasional grand gestures.',
  'Two calm people can solve almost anything.',
  'Love is loud in the beginning and quiet — but present — later.',
  'The right partner makes honesty feel safe, not risky.',
  'Distance grows in silence, not in disagreement.',
  "You're allowed to need each other. That's the point."
];

const STARTERS = [
  'What\'s something I did recently that made you feel loved?',
  "What's a small thing you wish I noticed more?",
  'What does a perfect ordinary day look like to you?',
  "What's something you're proud of that you haven't told me about?",
  'What\'s a memory of us you think about often?',
  "What's something new you'd like to try together this year?",
  "What's a way I can support you better this week?",
  "What's something about your childhood that shaped how you love?",
  "What's a fear you don't talk about much?",
  "What's something you've changed your mind about recently?",
  "What's your favorite way to spend a lazy Sunday?",
  "What's a compliment you received that stuck with you?",
  "What's something you're looking forward to?",
  "What's a habit of mine you secretly appreciate?",
  'If we had a free weekend with no obligations, what would you want to do?',
  'What\'s something you learned about yourself this year?',
  "What's a tradition you'd like us to start?",
  "What's something that always makes you laugh?",
  "What's a place you'd love for us to visit together?",
  "What's something you need more of in life right now?",
  "What's a small gesture that means a lot to you?",
  'What\'s something you admire about how I handle things?',
  "What's a goal you're working toward right now?",
  "What's something from your day that's stuck in your head?",
  "What's a way we've grown together that you're grateful for?",
  "What's something you'd like to understand better about me?",
  "What's a song that reminds you of us?",
  "What's something comforting you'd like to hear more often?",
  "What's a way you like to be comforted when you're stressed?",
  "What's one thing you hope never changes between us?"
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function dayOfYearUTC(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start;
  return Math.floor(diff / 86400000);
}
function pickForToday(arr) {
  const doy = dayOfYearUTC(new Date());
  return arr[doy % arr.length];
}
function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDailyDose() {
  return (
    '💌 *Your Daily Dose*\n\n' +
    `*Tip:* ${pickForToday(TIPS)}\n\n` +
    `*Quote:* "${pickForToday(QUOTES)}"\n\n` +
    `*Talk about it:* ${pickForToday(STARTERS)}`
  );
}

const WELCOME_TEXT =
  '💞 *Relationship Tips*\n\n' +
  'Daily relationship tips, quotes, and conversation starters — small nudges ' +
  "to help you stay connected.\n\n" +
  '*Commands*\n' +
  "/tip — a relationship tip\n" +
  "/quote — a short quote\n" +
  "/starter — a conversation starter to ask your partner\n" +
  "/daily — today's full dose (tip + quote + starter)\n" +
  "/subscribe — get today's dose pushed here once a day\n" +
  "/unsubscribe — stop the daily push\n\n" +
  "_This bot shares general, everyday relationship content — it isn't a " +
  "substitute for couples counseling or therapy if you're working through " +
  "something serious._";

bot.start((ctx) => ctx.replyWithMarkdown(WELCOME_TEXT));
bot.help((ctx) => ctx.replyWithMarkdown(WELCOME_TEXT));

bot.command('tip', (ctx) => ctx.replyWithMarkdown(`💡 ${pickRandom(TIPS)}`));
bot.command('quote', (ctx) => ctx.replyWithMarkdown(`💬 "${pickRandom(QUOTES)}"`));
bot.command('starter', (ctx) => ctx.replyWithMarkdown(`🗣️ ${pickRandom(STARTERS)}`));
bot.command('daily', (ctx) => ctx.replyWithMarkdown(fmtDailyDose()));

bot.command('subscribe', async (ctx) => {
  const id = ctx.chat.id;
  if (!state.subscribers.includes(id)) {
    state.subscribers.push(id);
    saveState(state);
  }
  await ctx.reply(`💞 Subscribed. I'll send today's dose here once a day, around ${DAILY_HOUR_UTC}:00 UTC.`);
});

bot.command('unsubscribe', async (ctx) => {
  const id = ctx.chat.id;
  state.subscribers = state.subscribers.filter((s) => s !== id);
  saveState(state);
  await ctx.reply('Unsubscribed — no more daily pushes here.');
});

bot.catch((err, ctx) => {
  console.error(`Unhandled error for ${ctx.updateType}:`, err);
});

// ---------------------------------------------------------------------------
// Daily push: checked every 15 minutes, fires once per UTC day at DAILY_HOUR_UTC.
// ---------------------------------------------------------------------------
async function checkAndSendDaily() {
  if (state.subscribers.length === 0) return;
  const now = new Date();
  const today = todayDateStr();
  if (now.getUTCHours() !== DAILY_HOUR_UTC) return;
  if (state.lastSentDate === today) return;

  state.lastSentDate = today;
  saveState(state);

  const text = fmtDailyDose();
  for (const chatId of state.subscribers) {
    try {
      await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(`Failed to send daily to ${chatId}, removing subscriber:`, err.message);
      state.subscribers = state.subscribers.filter((s) => s !== chatId);
      saveState(state);
    }
  }
}

setInterval(checkAndSendDaily, 15 * 60 * 1000);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
bot.launch().then(() => {
  console.log('Relationship Tips Bot is up and polling for updates.');
});

http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Relationship Tips Bot is running.');
  })
  .listen(PORT, () => console.log(`Health check server listening on port ${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
