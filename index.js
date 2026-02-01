const { Telegraf, Markup } = require("telegraf");

const BOT_TOKEN = 'bot id';

const ADMINS = [userid, userid];
const RATE_LIMIT = { window: 30000, max: 3 };

const bot = new Telegraf(BOT_TOKEN);

/* ===== RAM STATE ===== */
const rateMap = new Map();
const pendingReplies = new Map();
let silentMode = false;

/* ===== HELPERS ===== */
const isAdmin = id => ADMINS.includes(id);

const isLimited = id => {
  const now = Date.now();
  const arr = rateMap.get(id) || [];
  const filtered = arr.filter(t => now - t < RATE_LIMIT.window);
  filtered.push(now);
  rateMap.set(id, filtered);
  return filtered.length > RATE_LIMIT.max;
};

/* ===== START ===== */
bot.start(ctx => {
  if (isAdmin(ctx.from.id)) {
    ctx.reply('🛠 ادمین پنل فعاله');
  } else {
    ctx.reply('✉️ پیام ناشناس خودتو بفرست\nهویتت کاملاً مخفی می‌مونه');
  }
});

/* ===== TEXT MESSAGE ===== */
bot.on('text', ctx => {
  const id = ctx.from.id;

  // Admin reply flow
  if (isAdmin(id) && pendingReplies.has(id)) {
    const target = pendingReplies.get(id);
    pendingReplies.delete(id);

    ctx.telegram.sendChatAction(target.userId, 'typing');
    ctx.telegram.sendMessage(
      target.userId,
      `📨 پاسخ به پیام:\n"${target.original}"\n\n💬 ${ctx.message.text}`
    );

    ctx.reply('✅ پاسخ ارسال شد');
    return;
  }

  // Ignore admin normal text
  if (isAdmin(id)) return;

  if (silentMode) {
    ctx.reply('😶 موقتاً دریافت پیام غیرفعاله');
    return;
  }

  if (isLimited(id)) {
    ctx.reply('⏳ کمی صبر کن بعد دوباره بفرست');
    return;
  }

  ADMINS.forEach(admin => {
    ctx.telegram.sendMessage(
      admin,
      `📩 پیام ناشناس:\n\n${ctx.message.text}`,
      Markup.inlineKeyboard([
        Markup.button.callback('✍️ پاسخ', `reply_${id}`),
        Markup.button.callback('👌 اوکی', `quick_ok_${id}`),
        Markup.button.callback('⏳ بعداً', `quick_later_${id}`)
      ])
    );
  });

  ctx.reply('✅ پیامت ارسال شد');
});

/* ===== VOICE MESSAGE ===== */
bot.on('voice', ctx => {
  if (isAdmin(ctx.from.id)) return;

  ADMINS.forEach(admin => {
    ctx.telegram.sendVoice(admin, ctx.message.voice.file_id, {
      caption: '🎙 ویس ناشناس',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✍️ پاسخ', callback_data: `reply_${ctx.from.id}` }]
        ]
      }
    });
  });

  ctx.reply('🎧 ویست ارسال شد');
});

/* ===== CALLBACKS ===== */
bot.action(/reply_(\d+)/, ctx => {
  if (!isAdmin(ctx.from.id)) return;
  const userId = Number(ctx.match[1]);

  pendingReplies.set(ctx.from.id, {
    userId,
    original: ctx.update.callback_query.message.text || 'Voice Message'
  });

  ctx.reply('✍️ پاسخ رو بفرست');
});

bot.action(/quick_ok_(\d+)/, ctx => {
  ctx.telegram.sendMessage(ctx.match[1], '👌 اوکی');
  ctx.reply('ارسال شد');
});

bot.action(/quick_later_(\d+)/, ctx => {
  ctx.telegram.sendMessage(ctx.match[1], '⏳ بعداً پاسخ داده میشه');
  ctx.reply('ارسال شد');
});

/* ===== ADMIN COMMANDS ===== */
bot.command('silent', ctx => {
  if (!isAdmin(ctx.from.id)) return;
  silentMode = true;
  ctx.reply('😶 Silent Mode فعال شد');
});

bot.command('unsilent', ctx => {
  if (!isAdmin(ctx.from.id)) return;
  silentMode = false;
  ctx.reply('🔊 Silent Mode غیرفعال شد');
});

/* ===== LAUNCH ===== */
bot.launch();
console.log('🚀 Anonymous Bot Running');
