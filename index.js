const { Telegraf, Markup } = require("telegraf");

const BOT_TOKEN = "(BotID)";
const ADMINS = [(UserID), (UserID)];
const RATE_LIMIT = { window: 30000, max: 3 };

const bot = new Telegraf(BOT_TOKEN);

/* ===== RAM STATE ===== */
const rateMap = new Map();
const pendingReplies = new Map();
let silentMode = false;

/* ===== HELPERS ===== */
const isAdmin = (id) => ADMINS.includes(id);

const isLimited = (id) => {
  try {
    const now = Date.now();
    const arr = rateMap.get(id) || [];
    const filtered = arr.filter((t) => now - t < RATE_LIMIT.window);
    filtered.push(now);
    rateMap.set(id, filtered);
    return filtered.length > RATE_LIMIT.max;
  } catch {
    return false;
  }
};

/* ===== ERROR-SAFE WRAPPER ===== */
const safeHandler = (fn) => async (ctx, next) => {
  try {
    await fn(ctx, next);
  } catch {}
};

/* ===== START ===== */
bot.start(
  safeHandler((ctx) => {
    if (isAdmin(ctx.from.id)) ctx.reply("بات فعاله؛ به خودت نمیتونی چیزی بفرستی").catch(() => {});
    else
      ctx
        .reply("هر انتقادی که نسبت به من داری یا حرفی که تو دلت هست رو با خیال راحت بنویس و بفرست. بدون اینکه از اسمت باخبر بشم پیامت به من می‌رسه. 📑")
        .catch(() => {});
  }),
);

/* ===== TEXT MESSAGE ===== */
bot.on(
  "text",
  safeHandler(async (ctx) => {
    const id = ctx.from.id;

    if (isAdmin(id) && pendingReplies.has(id)) {
      const target = pendingReplies.get(id);
      pendingReplies.delete(id);
      await ctx.telegram
        .sendChatAction(target.userId, "typing")
        .catch(() => {});
      await ctx.telegram
        .sendMessage(
          target.userId,
          `📨 پاسخ به پیام:\n\n"${target.original}"\n\n💬 ${ctx.message.text}`,
        )
        .catch(() => {});
      ctx.reply("✅ پاسخ ارسال شد").catch(() => {});
      return;
    }

    if (isAdmin(id)) return;
    if (silentMode) {
      ctx.reply("😶 موقتاً دریافت پیام غیرفعاله").catch(() => {});
      return;
    }
    if (isLimited(id)) {
      ctx.reply("⏳ کمی صبر کن بعد دوباره بفرست").catch(() => {});
      return;
    }

    for (let admin of ADMINS) {
      ctx.telegram
        .sendMessage(
          admin,
          `📩 پیام ناشناس:\n\n${ctx.message.text}`,
          Markup.inlineKeyboard([
            Markup.button.callback("✍️ پاسخ", `reply_${id}`),
            Markup.button.callback("👌 اوکی", `quick_ok_${id}`),
            Markup.button.callback("⏳ بعداً", `quick_later_${id}`),
          ]),
        )
        .catch(() => {});
    }

    ctx.reply("✅ پیامت ارسال شد").catch(() => {});
  }),
);

/* ===== VOICE MESSAGE ===== */
bot.on(
  "voice",
  safeHandler(async (ctx) => {
    if (isAdmin(ctx.from.id)) return;
    for (let admin of ADMINS) {
      ctx.telegram
        .sendVoice(admin, ctx.message.voice.file_id, {
          caption: "🎙 ویس ناشناس",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✍️ پاسخ", callback_data: `reply_${ctx.from.id}` }],
            ],
          },
        })
        .catch(() => {});
    }
    ctx.reply("🎧 ویست ارسال شد").catch(() => {});
  }),
);

/* ===== CALLBACKS ===== */
bot.action(
  /reply_(\d+)/,
  safeHandler((ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const userId = Number(ctx.match[1]);
    pendingReplies.set(ctx.from.id, {
      userId,
      original: ctx.update.callback_query.message.text || "Voice Message",
    });
    ctx.reply("✍️ پاسخ رو بفرست").catch(() => {});
  }),
);

bot.action(
  /quick_ok_(\d+)/,
  safeHandler((ctx) => {
    ctx.telegram.sendMessage(ctx.match[1], "👌 اوکی").catch(() => {});
    ctx.reply("ارسال شد").catch(() => {});
  }),
);

bot.action(
  /quick_later_(\d+)/,
  safeHandler((ctx) => {
    ctx.telegram
      .sendMessage(ctx.match[1], "⏳ بعداً پاسخ داده میشه")
      .catch(() => {});
    ctx.reply("ارسال شد").catch(() => {});
  }),
);

/* ===== ADMIN COMMANDS ===== */
bot.command(
  "silent",
  safeHandler((ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    silentMode = true;
    ctx.reply("😶 Silent Mode فعال شد").catch(() => {});
  }),
);
bot.command(
  "unsilent",
  safeHandler((ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    silentMode = false;
    ctx.reply("🔊 Silent Mode غیرفعال شد").catch(() => {});
  }),
);

/* ===== GLOBAL TELEGRAF ERROR ===== */
bot.catch(() => {});

/* ===== NODE.JS GLOBAL ERRORS ===== */
process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});

/* ===== LAUNCH ===== */
(async () => {
  try {
    await bot.launch();
  } catch {}
})();
