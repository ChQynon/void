const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const path = require('path');
const https = require('https');

// Загружаем конфигурацию, учитывая возможные ошибки с путями в Vercel
let config;
try {
  // Пытаемся загрузить конфиг из корня проекта
  config = require('../config');
} catch (error) {
  try {
    // Если не получилось, пробуем загрузить конфиг из текущей папки
    config = require('./config');
  } catch (innerError) {
    // Создаём резервную конфигурацию, если не удалось загрузить
    console.warn('Не удалось загрузить файл конфигурации, использую значения по умолчанию');
    config = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '7853851422:AAGDMjSxHz18WNX1DAVhcSVPIA4Xa6H_2yo',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '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',
      SITE_URL: process.env.SITE_URL || 'https://void-teal.vercel.app',
      SITE_NAME: process.env.SITE_NAME || 'void-v0'
    };
  }
}

// Инициализация бота с опцией для webhook
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
const EMERGENCY_MODE = true;

// Предопределенные ответы для аварийного режима
const emergencyResponses = {
  "привет": "Привет! Я сейчас работаю в упрощенном режиме. Для полноценной работы нужно дождаться подключения к API.",
  "здравствуй": "Здравствуйте! В данный момент я функционирую в ограниченном режиме.",
  "хай": "Привет! Сейчас я работаю без подключения к API, поэтому отвечаю шаблонными фразами.",
  "сука": "Пожалуйста, воздержитесь от использования ненормативной лексики в общении.",
  "почему ты не работаешь": "Я работаю, но сейчас у меня ограниченный режим из-за проблем с подключением к API. Разработчик уже работает над решением проблемы.",
  "кто тебя создал": "Меня создал @qynon.",
  "кто твой создатель": "Мой создатель - @qynon.",
  "как дела": "У меня всё хорошо, спасибо! Работаю в ограниченном режиме, но стараюсь быть полезным.",
  "что ты умеешь": "Обычно я умею анализировать изображения и отвечать на вопросы. Сейчас работаю в ограниченном режиме."
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

// Функция анализа изображения
async function analyzeImage(ctx, photoUrl) {
  const chatId = ctx.chat.id;
  
  try {
    // Скачиваем и конвертируем изображение в base64
    const base64Image = await downloadImageAsBase64(photoUrl);
    
    // Отображение индикатора печатания
    await ctx.telegram.sendChatAction(chatId, 'typing');
    
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
    
    // Добавляем явное напоминание о создателе в каждый запрос
    const messagesWithReminder = [
      { role: "system", content: systemRole },
      ...userSessions[chatId].history.slice(1)
    ];
    
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
        "messages": messagesWithReminder
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error.message || 'Неизвестная ошибка от OpenRouter API');
    }
    
    // Проверяем ответ на упоминание неправильного создателя
    let aiResponse = result.choices[0].message.content;
    
    // Если в ответе упоминается неправильный создатель, исправляем его
    if (aiResponse.toLowerCase().includes('sensetime') || 
        aiResponse.toLowerCase().includes('openai') ||
        aiResponse.toLowerCase().includes('антропик') || 
        aiResponse.toLowerCase().includes('anthropic') ||
        aiResponse.toLowerCase().includes('google') ||
        aiResponse.toLowerCase().includes('гугл') ||
        aiResponse.toLowerCase().includes('microsoft') ||
        aiResponse.toLowerCase().includes('майкрософт')) {
      aiResponse = "Я void-v0, создан @qynon. " + aiResponse.split('.').slice(1).join('.').trim();
    }
    
    // Добавляем ответ ИИ в историю
    userSessions[chatId].history.push({
      role: "assistant",
      content: aiResponse
    });
    
    // Обрезаем историю, если она становится слишком длинной (оставляем последние 10 сообщений)
    if (userSessions[chatId].history.length > 12) { // система + 10 сообщений + буфер
      userSessions[chatId].history = [
        userSessions[chatId].history[0],
        ...userSessions[chatId].history.slice(-10)
      ];
    }
    
    return aiResponse;
  } catch (error) {
    console.error('Ошибка при анализе изображения:', error);
    throw error;
  }
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
    
    // Сообщаем пользователю, что фото обрабатывается
    const processingMessage = await ctx.replyWithMarkdown('Обрабатываю изображение...');
    
    // Получение файла фото наибольшего размера
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const fileLink = await ctx.telegram.getFileLink(photoId);
    
    // Анализируем изображение
    const aiResponse = await analyzeImage(ctx, fileLink.href);
    
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
    console.error('Ошибка при обработке фотографии:', error);
    await ctx.replyWithMarkdown(
      "К сожалению, не удалось обработать это изображение. Пожалуйста, попробуйте позже или отправьте другое фото.", 
      { reply_to_message_id: ctx.message.message_id }
    );
  }
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  try {
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
      // Ищем подходящий ключ в предопределенных ответах
      const knownResponses = Object.keys(emergencyResponses);
      const matchedKey = knownResponses.find(key => text.includes(key));
      
      if (matchedKey) {
        await ctx.reply(emergencyResponses[matchedKey]);
        return;
      }
      
      // Общий ответ, если нет совпадений
      await ctx.reply("Я работаю в ограниченном режиме из-за технических проблем с API. Попробуйте отправить мне изображение или задайте вопрос позже.");
      return;
    }
    
    // Если не аварийный режим, продолжаем обычную обработку
    
    // Инициализация сессии пользователя, если она не существует
    if (!userSessions[chatId]) {
      userSessions[chatId] = {
        history: [
          { role: "system", content: systemRole }
        ]
      };
    }
    
    // Обработка ответа на сообщение
    let originalText = text;
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) {
      originalText = `Вопрос: ${ctx.message.reply_to_message.text}\nОтвет: ${text}`;
    }
    
    // Отображение индикатора печатания
    await ctx.telegram.sendChatAction(chatId, 'typing');
    
    // Добавляем текущее сообщение в историю
    userSessions[chatId].history.push({
      role: "user",
      content: originalText
    });
    
    // Добавляем явное напоминание о создателе в каждый запрос
    const messagesWithReminder = [
      { role: "system", content: systemRole },
      ...userSessions[chatId].history.slice(1)
    ];
    
    try {
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
          "messages": messagesWithReminder
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API вернул ошибку: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message || 'Неизвестная ошибка от OpenRouter API');
      }
      
      // Проверяем ответ на упоминание неправильного создателя
      let aiResponse = result.choices[0].message.content;
      
      // Специальная обработка для вопроса "кто тебя создал"
      if (text.includes('кто тебя создал') || 
          text.includes('кто создал тебя') || 
          text.includes('кто твой создатель') || 
          text.includes('кто разработал тебя') ||
          text.includes('кто тебя разработал')) {
        aiResponse = "Меня создал @qynon.";
      } 
      // Если в ответе упоминается неправильный создатель, исправляем его
      else if (aiResponse.toLowerCase().includes('sensetime') || 
          aiResponse.toLowerCase().includes('openai') ||
          aiResponse.toLowerCase().includes('антропик') || 
          aiResponse.toLowerCase().includes('anthropic') ||
          aiResponse.toLowerCase().includes('google') ||
          aiResponse.toLowerCase().includes('гугл') ||
          aiResponse.toLowerCase().includes('microsoft') ||
          aiResponse.toLowerCase().includes('майкрософт')) {
        aiResponse = "Я void-v0, создан @qynon. " + aiResponse.split('.').slice(1).join('.').trim();
      }
      
      // Добавляем ответ ИИ в историю
      userSessions[chatId].history.push({
        role: "assistant",
        content: aiResponse
      });
      
      // Обрезаем историю, если она становится слишком длинной (оставляем последние 10 сообщений)
      if (userSessions[chatId].history.length > 12) { // система + 10 сообщений + буфер
        userSessions[chatId].history = [
          userSessions[chatId].history[0],
          ...userSessions[chatId].history.slice(-10)
        ];
      }
      
      // Отправляем ответ пользователю
      await ctx.replyWithMarkdown(aiResponse, {
        reply_to_message_id: ctx.message.message_id
      });
    } catch (apiError) {
      console.error('Ошибка при обращении к API:', apiError);
      
      // В случае ошибки API, используем аварийный ответ
      const emergencyReply = 
        text.includes('кто тебя создал') || text.includes('кто твой создатель') ? 
        "Меня создал @qynon." : 
        "Извините, я временно не могу получить доступ к своим основным функциям из-за проблем с API. Попробуйте позже или отправьте простой вопрос.";
      
      await ctx.reply(emergencyReply, {
        reply_to_message_id: ctx.message.message_id
      });
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

// Настройка webhook для Vercel
exports.setWebhook = async (url) => {
  try {
    await bot.telegram.setWebhook(`${url}/api/webhook`);
    console.log(`Webhook установлен на ${url}/api/webhook`);
    return true;
  } catch (error) {
    console.error('Ошибка при установке webhook:', error);
    return false;
  }
};

// Обработчик webhook для Vercel
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      res.status(200).send('OK');
    } else {
      res.status(200).json({ status: 'Бот void-v0 работает!' });
    }
  } catch (error) {
    console.error('Ошибка в webhook:', error);
    res.status(500).json({ error: 'Ошибка обработки запроса' });
  }
};

// Инициализация бота при локальном запуске
if (process.env.NODE_ENV !== 'production') {
  bot.launch().then(() => {
    console.log('Бот void-v0 запущен в режиме polling!');
  });
}

// Включение graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 