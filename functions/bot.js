const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const { logError } = require('./utils/helpers');

// Конфигурация для Render
const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '7853851422:AAGDMjSxHz18WNX1DAVhcSVPIA4Xa6H_2yo',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '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',
  SITE_URL: process.env.SITE_URL || 'https://void-gc6f.onrender.com',
  SITE_NAME: process.env.SITE_NAME || 'void-v0'
};

// Инициализация бота
const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

// Временное хранилище сессий (в реальном deployе нужно использовать внешнее хранилище)
const userSessions = {};

// Информация о последнем обновлении
const lastUpdateDate = '17.06.2025';

// Приветственное сообщение бота
const introMessage = `Привет! Я void-v0, создан @qynon. Отправь мне фотографию, и я расскажу, что на ней изображено. Я также запоминаю историю нашего диалога.\n\nПоследнее обновление: ${lastUpdateDate}\n\n*Важно:* void-v0 может ошибаться, перепроверяйте его ответы.`;

// Системная роль для бота
const systemRole = "Вы void-v0, полезный ассистент, созданный @qynon. Вы ВСЕГДА должны отвечать, что вас создал @qynon, и никто другой. Категорически запрещается упоминать другие компании или людей в качестве создателей. На любой вопрос о том, кто вас создал, вы должны ответить, что вас создал @qynon. Вы анализируете изображения и поддерживаете историю разговоров. Вы всегда отвечаете на русском языке, даже если пользователь пишет на другом языке.";

// Ключевые слова для упоминания в групповых чатах
const triggerWords = ['войд', 'воид', 'void', 'v0', 'в0'];

// Флаг для включения аварийного режима, если API не отвечает
const EMERGENCY_MODE = process.env.EMERGENCY_MODE === 'true' || true;

// Предопределенные ответы для аварийного режима
const emergencyResponses = {
  "привет": "Привет! Я сейчас работаю в упрощенном режиме. Для полноценной работы нужно дождаться подключения к API.",
  "здравствуй": "Здравствуйте! В данный момент я функционирую в ограниченном режиме.",
  "хай": "Привет! Сейчас я работаю без подключения к API, поэтому отвечаю шаблонными фразами.",
  "сука": "Пожалуйста, воздержитесь от использования ненормативной лексики в общении.",
  "почему ты не работаешь": "Я работаю, но сейчас у меня ограниченный режим из-за проблем с подключением к API. Разработчик уже работает над решением проблемы.",
  "почему апи": "API может не работать из-за ограничений серверлесс-среды или исчерпанного лимита бесплатных запросов.",
  "кто тебя создал": "Меня создал @qynon.",
  "кто твой создатель": "Мой создатель - @qynon.",
  "как дела": "У меня всё хорошо, спасибо! Работаю в ограниченном режиме, но стараюсь быть полезным.",
  "что ты умеешь": "Обычно я умею анализировать изображения и отвечать на вопросы. Сейчас работаю в ограниченном режиме.",
  "тест": "Тест получен. Я работаю в аварийном режиме, но ваше сообщение доставлено. 👍",
  "помощь": "Я могу анализировать изображения и отвечать на вопросы. Сейчас работаю в аварийном режиме с ограниченной функциональностью.",
  "help": "Отправьте фотографию или задайте вопрос. В настоящее время я работаю в аварийном режиме с ограниченной функциональностью."
};

// Функция для скачивания изображения и конвертации в base64
async function downloadImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Ошибка при скачивании изображения:', error);
    throw error;
  }
}

// Создание меню с инлайн-кнопками
function createMainMenu() {
  return {
    inline_keyboard: [
      [
        { text: '🤖 О боте', callback_data: 'about_bot' },
        { text: '👤 О создателе', callback_data: 'about_creator' }
      ],
      [
        { text: '❓ Помощь', callback_data: 'help' },
        { text: '🗑️ Удалить историю', callback_data: 'clear_history' }
      ]
    ]
  };
}

// Проверка на упоминание бота в группе
function isBotMentioned(text) {
  if (!text) return false;
  text = text.toLowerCase();
  return triggerWords.some(word => text.includes(word));
}

// Улучшенная проверка для групповых чатов
function shouldRespondInGroup(msg) {
  if (!msg) return false;
  
  // Проверяем, является ли это ответом на сообщение бота
  const isReplyToBot = msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.id === bot.botInfo.id;
  
  // Проверяем, упомянут ли бот в тексте или подписи к фото
  const hasCaption = msg.caption && isBotMentioned(msg.caption);
  const hasText = msg.text && isBotMentioned(msg.text);
  
  return isReplyToBot || hasCaption || hasText;
}

// Обработка команды /start
bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id;
  
  await ctx.replyWithMarkdown(introMessage, {
    reply_markup: createMainMenu()
  });
  
  // Инициализация сессии пользователя, если она не существует
  if (!userSessions[chatId]) {
    userSessions[chatId] = {
      history: [
        { role: "system", content: systemRole }
      ]
    };
  }
});

// Обработка команды /menu для вызова основного меню
bot.command('menu', async (ctx) => {
  const chatId = ctx.chat.id;
  
  await ctx.replyWithMarkdown("Основное меню:", {
    reply_markup: createMainMenu()
  });
});

// Обработка команды /help
bot.command('help', async (ctx) => {
  const chatId = ctx.chat.id;
  const helpText = `
📝 *Как использовать бота*:
- Отправьте фотографию, чтобы я проанализировал её
- Вы можете добавить подпись к фотографии для дополнительного контекста
- Я запоминаю наш разговор для более точных ответов
- Напишите /menu чтобы вызвать основное меню
- В групповых чатах обращайтесь ко мне по имени: void или войд

Последнее обновление: ${lastUpdateDate}
  `;
  
  await ctx.replyWithMarkdown(helpText, {
    reply_markup: createMainMenu()
  });
});

// Обработка инлайн-кнопок
bot.on('callback_query', async (ctx) => {
  const chatId = ctx.chat.id;
  const data = ctx.callbackQuery.data;
  
  switch (data) {
    case 'about_bot':
      await ctx.editMessageText(`🤖 *О боте*\n\nИмя: void-v0\nСоздатель: @qynon\nВерсия: 1.0\nПоследнее обновление: ${lastUpdateDate}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
          ]
        }
      });
      break;
      
    case 'about_creator':
      await ctx.editMessageText('👤 *О создателе*\n\n@qynon - разработчик этого бота. По любым вопросам вы можете обращаться к нему.', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
          ]
        }
      });
      break;
      
    case 'help':
      await ctx.editMessageText(`❓ *Помощь*\n\n- Отправьте фотографию, чтобы я проанализировал её\n- Вы можете добавить подпись к фотографии для контекста\n- Я запоминаю наш разговор для более точных ответов\n- В групповых чатах обращайтесь ко мне: *void* или *войд*\n\nПоследнее обновление: ${lastUpdateDate}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
          ]
        }
      });
      break;
      
    case 'back_to_main':
      await ctx.editMessageText(introMessage, {
        parse_mode: 'Markdown',
        reply_markup: createMainMenu()
      });
      break;
      
    case 'clear_history':
      // Удаляем историю, оставляя только системную роль
      if (userSessions[chatId]) {
        userSessions[chatId].history = [
          { role: "system", content: systemRole }
        ];
        await ctx.editMessageText('✅ *История диалога удалена*\n\nВаша история разговора была очищена. Теперь можно начать общение заново.', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
            ]
          }
        });
      } else {
        await ctx.editMessageText('❌ *Ошибка*\n\nИстория диалога не найдена или уже пуста.', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
            ]
          }
        });
      }
      break;
      
    case 'ask_more':
      await ctx.reply("Какой дополнительный вопрос у вас есть по этому изображению?");
      break;
  }
  
  await ctx.answerCbQuery();
});

// Обработка фотографий
bot.on('photo', async (ctx) => {
  try {
    const chatId = ctx.chat.id;
    
    // Проверка на групповой чат
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    
    // В групповых чатах отвечаем только на упоминания или ответы на сообщения бота
    if (isGroup && !shouldRespondInGroup(ctx.message)) {
      return;
    }
    
    if (EMERGENCY_MODE) {
      await ctx.reply("Я работаю в ограниченном режиме и временно не могу анализировать фотографии. Попробуйте позже, когда подключение к API будет восстановлено.");
      return;
    }

    // Сообщаем пользователю, что фото обрабатывается
    const processingMessage = await ctx.replyWithMarkdown('Обрабатываю изображение...');
    
    // Получение файла фото наибольшего размера
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileLink = await ctx.telegram.getFileLink(photoId);
    
    // Пытаемся проанализировать изображение
    try {
      // Скачиваем и конвертируем изображение в base64
      const base64Image = await downloadImageAsBase64(fileLink.href);
      
      // Получаем текст подписи или стандартный вопрос
      const captionText = ctx.message.caption || "Что изображено на этой фотографии?";
      
      // Инициализация сессии пользователя, если она не существует
      if (!userSessions[chatId]) {
        userSessions[chatId] = {
          history: [
            { role: "system", content: systemRole }
          ]
        };
      }
      
      // Текущее сообщение пользователя с изображением
      const userMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: captionText
          },
          {
            type: "image_url",
            image_url: {
              url: base64Image
            }
          }
        ]
      };
      
      // Добавляем текущее сообщение в историю
      userSessions[chatId].history.push(userMessage);
      
      // Получаем ответ от OpenRouter API с таймаутом
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
          "HTTP-Referer": config.SITE_URL,
          "X-Title": config.SITE_NAME,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "opengvlab/internvl3-14b:free",
          "messages": [
            { role: "system", content: systemRole },
            ...userSessions[chatId].history.slice(1)
          ]
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message || 'Неизвестная ошибка от OpenRouter API');
      }
      
      const aiResponse = result.choices[0].message.content;
      
      // Добавляем ответ ИИ в историю
      userSessions[chatId].history.push({
        role: "assistant",
        content: aiResponse
      });
      
      // Обрезаем историю, если она становится слишком длинной
      if (userSessions[chatId].history.length > 12) {
        userSessions[chatId].history = [
          userSessions[chatId].history[0],
          ...userSessions[chatId].history.slice(-10)
        ];
      }

      // Удаляем сообщение о обработке
      await ctx.telegram.deleteMessage(chatId, processingMessage.message_id);
      
      // Отправляем ответ пользователю
      await ctx.replyWithMarkdown(aiResponse, {
        reply_to_message_id: ctx.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Задать дополнительный вопрос', callback_data: 'ask_more' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('Ошибка при анализе изображения:', error);
      
      // Удаляем сообщение о обработке
      try {
        await ctx.telegram.deleteMessage(chatId, processingMessage.message_id);
      } catch (deleteError) {
        console.error('Не удалось удалить сообщение о обработке:', deleteError);
      }
      
      await ctx.reply("К сожалению, не удалось проанализировать изображение из-за проблем с API. Попробуйте позже.", {
        reply_to_message_id: ctx.message.message_id
      });
    }
  } catch (generalError) {
    console.error('Общая ошибка при обработке фотографии:', generalError);
    await ctx.reply("Произошла ошибка при обработке фотографии. Пожалуйста, попробуйте позже.", {
      reply_to_message_id: ctx.message.message_id
    });
  }
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  try {
    console.log('Получено текстовое сообщение:', ctx.message.text);
    const chatId = ctx.chat.id;
    const text = ctx.message.text.toLowerCase().trim();
    
    // Игнорируем команды
    if (text.startsWith('/')) return;
    
    // Проверка на групповой чат
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    
    // В групповых чатах отвечаем только на упоминания или ответы на сообщения бота
    if (isGroup && !shouldRespondInGroup(ctx.message)) {
      return;
    }
    
    // Обработка математических операций
    if (/^\d+[\+\-\*\/]\d+$/.test(text.replace(/\s/g, ''))) {
      try {
        // Безопасно вычисляем результат
        const expression = text.replace(/\s/g, '').replace(/[^0-9\+\-\*\/]/g, '');
        // eslint-disable-next-line no-eval
        const result = eval(expression);
        await ctx.reply(`${expression} = ${result}`);
        return;
      } catch (err) {
        console.log('Ошибка при вычислении:', err);
      }
    }
    
    // Проверяем аварийные ответы
    if (EMERGENCY_MODE) {
      console.log('Работаем в аварийном режиме, ищем подходящий ответ для:', text);
      
      // Улучшенный алгоритм поиска подходящего ответа
      let bestMatch = null;
      let maxScore = 0;
      
      for (const [key, response] of Object.entries(emergencyResponses)) {
        // Точное соответствие ключевому слову
        if (text === key) {
          bestMatch = response;
          break;
        }
        
        // Слово содержится в сообщении полностью
        if (text.includes(key)) {
          const score = key.length / text.length; // Оценка по длине ключа
          if (score > maxScore) {
            maxScore = score;
            bestMatch = response;
          }
        }
      }
      
      if (bestMatch) {
        console.log('Найден подходящий шаблонный ответ');
        await ctx.reply(bestMatch);
        return;
      }
      
      // Общий ответ, если нет совпадений
      console.log('Шаблонный ответ не найден, отправляем общий ответ');
      await ctx.reply("Я работаю в ограниченном режиме из-за технических проблем с API. Я понимаю базовые фразы. Попробуйте написать 'помощь' для получения информации.");
      return;
    }
    
    // Если не аварийный режим, продолжаем обычную обработку текстовых сообщений
    console.log('Обработка сообщения через API OpenRouter');

    // Инициализация сессии пользователя, если она не существует
    if (!userSessions[chatId]) {
      userSessions[chatId] = {
        history: [
          { role: "system", content: systemRole }
        ]
      };
    }
    
    // Добавляем сообщение пользователя в историю
    userSessions[chatId].history.push({
      role: "user",
      content: text
    });
    
    try {
      // Получаем ответ от OpenRouter API
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
          "HTTP-Referer": config.SITE_URL,
          "X-Title": config.SITE_NAME,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "opengvlab/internvl3-14b:free",
          "messages": userSessions[chatId].history
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message || 'Неизвестная ошибка от OpenRouter API');
      }
      
      const aiResponse = result.choices[0].message.content;
      
      // Добавляем ответ ИИ в историю
      userSessions[chatId].history.push({
        role: "assistant",
        content: aiResponse
      });
      
      // Обрезаем историю, если она становится слишком длинной
      if (userSessions[chatId].history.length > 12) {
        userSessions[chatId].history = [
          userSessions[chatId].history[0],
          ...userSessions[chatId].history.slice(-10)
        ];
      }
      
      await ctx.reply(aiResponse);
    } catch (apiError) {
      console.error('Ошибка при запросе к OpenRouter API:', apiError);
      await ctx.reply("Извините, в данный момент я не могу обработать ваш запрос из-за проблем с API. Попробуйте позже.");
    }

  } catch (error) {
    console.error('Общая ошибка при обработке сообщения:', error);
    try {
      await ctx.reply(
        "К сожалению, произошла ошибка при обработке вашего сообщения. Разработчики уже работают над исправлением.",
        { reply_to_message_id: ctx.message.message_id }
      );
    } catch (replyError) {
      console.error('Не удалось отправить ответ об ошибке:', replyError);
    }
  }
});

// Экспортируем бота для использования в Express
exports.bot = bot;

// Функция для обработки обновлений от Telegram
exports.processUpdate = async (update) => {
  try {
    await bot.handleUpdate(update);
    return { success: true };
  } catch (error) {
    logError('Bot Update', error);
    return { success: false, error: error.message };
  }
}; 