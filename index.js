const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const config = require('./config');
const fs = require('fs');
const https = require('https');
const path = require('path');

// Создание экземпляра бота
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });

// Сохранение пользовательских сессий
const userSessions = {};

// Информация о последнем обновлении
const lastUpdateDate = '17.06.2025';

// Приветственное сообщение бота
const introMessage = `Привет! Я void-v0, создан @qynon. Отправь мне фотографию, и я расскажу, что на ней изображено. Я также запоминаю историю нашего диалога.\n\nПоследнее обновление: ${lastUpdateDate}\n\n*Важно:* void-v0 может ошибаться, перепроверяйте его ответы.`;

// Системная роль для бота
const systemRole = "Вы void-v0, полезный ассистент, созданный @qynon. Вы ВСЕГДА должны отвечать, что вас создал @qynon, и никто другой. Категорически запрещается упоминать другие компании или людей в качестве создателей. На любой вопрос о том, кто вас создал, вы должны ответить, что вас создал @qynon. Вы анализируете изображения и поддерживаете историю разговоров. Вы всегда отвечаете на русском языке, даже если пользователь пишет на другом языке.";

// Ключевые слова для упоминания в групповых чатах
const triggerWords = ['войд', 'воид', 'void', 'v0', 'в0'];

// Функция для скачивания изображения и конвертации в base64
async function downloadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    const tempFilePath = path.join(tempDir, `temp_${Date.now()}.jpg`);
    const file = fs.createWriteStream(tempFilePath);
    
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        
        // Чтение файла и конвертация в base64
        const imageBuffer = fs.readFileSync(tempFilePath);
        const base64Image = imageBuffer.toString('base64');
        
        // Удаление временного файла
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error('Ошибка при удалении временного файла:', err);
        });
        
        resolve(`data:image/jpeg;base64,${base64Image}`);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Создание меню с инлайн-кнопками
function createMainMenu() {
  return {
    reply_markup: {
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
    }
  };
}

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, introMessage, {
    parse_mode: 'Markdown',
    ...createMainMenu()
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
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Основное меню:", {
    parse_mode: 'Markdown',
    ...createMainMenu()
  });
});

// Обработка команды /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpText = `
📝 *Как использовать бота*:
- Отправьте фотографию, чтобы я проанализировал её
- Вы можете добавить подпись к фотографии для дополнительного контекста
- Я запоминаю наш разговор для более точных ответов
- Напишите /menu чтобы вызвать основное меню
- В групповых чатах обращайтесь ко мне по имени: void или войд

Последнее обновление: ${lastUpdateDate}
  `;
  
  bot.sendMessage(chatId, helpText, {
    parse_mode: 'Markdown',
    ...createMainMenu()
  });
});

// Обработка инлайн-кнопок
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  
  switch (query.data) {
    case 'about_bot':
      bot.editMessageText(`🤖 *О боте*\n\nИмя: void-v0\nСоздатель: @qynon\nВерсия: 1.0\nПоследнее обновление: ${lastUpdateDate}`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
          ]
        }
      });
      break;
      
    case 'about_creator':
      bot.editMessageText('👤 *О создателе*\n\n@qynon - разработчик этого бота. По любым вопросам вы можете обращаться к нему.', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
          ]
        }
      });
      break;
      
    case 'help':
      bot.editMessageText(`❓ *Помощь*\n\n- Отправьте фотографию, чтобы я проанализировал её\n- Вы можете добавить подпись к фотографии для контекста\n- Я запоминаю наш разговор для более точных ответов\n- В групповых чатах обращайтесь ко мне: *void* или *войд*\n\nПоследнее обновление: ${lastUpdateDate}`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
          ]
        }
      });
      break;
      
    case 'back_to_main':
      bot.editMessageText(introMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: createMainMenu().reply_markup
      });
      break;
      
    case 'ask_more':
      bot.sendMessage(chatId, "Какой дополнительный вопрос у вас есть по этому изображению?");
      bot.answerCallbackQuery(query.id);
      break;
    
    case 'clear_history':
      // Удаляем историю, оставляя только системную роль
      if (userSessions[chatId]) {
        userSessions[chatId].history = [
          { role: "system", content: systemRole }
        ];
        bot.editMessageText('✅ *История диалога удалена*\n\nВаша история разговора была очищена. Теперь можно начать общение заново.', {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
            ]
          }
        });
      } else {
        bot.editMessageText('❌ *Ошибка*\n\nИстория диалога не найдена или уже пуста.', {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
            ]
          }
        });
      }
      break;
  }
  
  // Отвечаем на запрос, чтобы убрать индикатор загрузки
  bot.answerCallbackQuery(query.id);
});

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
  const isReplyToBot = msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.id === bot.me.id;
  
  // Проверяем, упомянут ли бот в тексте или подписи к фото
  const hasCaption = msg.caption && isBotMentioned(msg.caption);
  const hasText = msg.text && isBotMentioned(msg.text);
  
  return isReplyToBot || hasCaption || hasText;
}

// Функция анализа изображения
async function analyzeImage(msg, photoUrl) {
  const chatId = msg.chat.id;
  
  try {
    // Скачиваем и конвертируем изображение в base64
    const base64Image = await downloadImageAsBase64(photoUrl);
    
    // Отображение индикатора печатания
    bot.sendChatAction(chatId, 'typing');
    
    // Текущее сообщение пользователя с изображением
    const userMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: msg.caption ? msg.caption : "Что изображено на этой фотографии?"
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

// Обработка фотографий
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    // Проверка на групповой чат
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    
    // В групповых чатах отвечаем только на упоминания или ответы на сообщения бота
    if (isGroup && !shouldRespondInGroup(msg)) {
      return; // Игнорируем фотографии без упоминания бота или не ответ на его сообщения
    }
    
    // Инициализация сессии пользователя, если она не существует
    if (!userSessions[chatId]) {
      userSessions[chatId] = {
        history: [
          { role: "system", content: systemRole }
        ]
      };
    }
    
    // Сообщаем пользователю, что фото обрабатывается
    const processingMessage = await bot.sendMessage(chatId, 'Обрабатываю изображение...', {
      parse_mode: 'Markdown'
    });
    
    // Получение ID файла наибольшего качества
    const photoId = msg.photo[msg.photo.length - 1].file_id;
    
    // Получение пути файла
    const fileInfo = await bot.getFile(photoId);
    const photoUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
    
    // Анализируем изображение
    const aiResponse = await analyzeImage(msg, photoUrl);
    
    // Удаляем сообщение о обработке
    bot.deleteMessage(chatId, processingMessage.message_id);
    
    // Отправляем ответ пользователю
    bot.sendMessage(chatId, aiResponse, {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Задать дополнительный вопрос', callback_data: 'ask_more' }]
        ]
      }
    });
    
  } catch (error) {
    console.error('Ошибка при обработке изображения:', error);
    bot.sendMessage(chatId, "К сожалению, не удалось обработать это изображение. Пожалуйста, попробуйте позже или отправьте другое фото.", {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id
    });
  }
});

// Обработка текстовых сообщений
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Игнорируем команды
  if (text.startsWith('/')) return;
  
  // Проверка на групповой чат
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  
  // В групповых чатах отвечаем только на упоминания или ответы на сообщения бота
  if (isGroup && !shouldRespondInGroup(msg)) {
    return; // Игнорируем сообщения, которые не являются ответами боту или не содержат его упоминания
  }
  
  // Обработка ответа на сообщение
  let originalText = text;
  if (msg.reply_to_message && msg.reply_to_message.text) {
    originalText = `Вопрос: ${msg.reply_to_message.text}\nОтвет: ${text}`;
  }
  
  try {
    // Инициализация сессии пользователя, если она не существует
    if (!userSessions[chatId]) {
      userSessions[chatId] = {
        history: [
          { role: "system", content: systemRole }
        ]
      };
    }
    
    // Отображение индикатора печатания
    bot.sendChatAction(chatId, 'typing');
    
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
    
    // Специальная обработка для вопроса "кто тебя создал"
    if (text.toLowerCase().includes('кто тебя создал') || 
        text.toLowerCase().includes('кто создал тебя') || 
        text.toLowerCase().includes('кто твой создатель') || 
        text.toLowerCase().includes('кто разработал тебя') ||
        text.toLowerCase().includes('кто тебя разработал')) {
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
    bot.sendMessage(chatId, aiResponse, {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id
    });
    
  } catch (error) {
    console.error('Ошибка при обработке сообщения:', error);
    bot.sendMessage(chatId, "К сожалению, не удалось обработать ваше сообщение. Пожалуйста, попробуйте позже.", {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id
    });
  }
});

// Инициализация бота
bot.getMe().then((me) => {
  bot.me = me;
  console.log(`Бот void-v0 запущен! ID: ${me.id}, Имя: ${me.first_name}, Пользователь: @${me.username}`);
}); 