// Основной файл для запуска бота на Render
const express = require('express');
const http = require('http');
const { Telegraf } = require('telegraf');

console.log('Загрузка бота void-v0...');

// Конфигурация
const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '7853851422:AAGDMjSxHz18WNX1DAVhcSVPIA4Xa6H_2yo',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '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',
  SITE_URL: process.env.SITE_URL || 'https://void-v0-bot.onrender.com',
  SITE_NAME: process.env.SITE_NAME || 'void-v0',
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Подключаем функцию бота
const botHandler = require('./functions/bot');

// Определяем, работаем ли мы в среде Render
const isRender = process.env.RENDER === 'true';

// Создаем экземпляр бота
const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

// Настраиваем Express
const app = express();

// Парсинг JSON для webhook
app.use(express.json());

// Обработка запросов к корню сервера
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    name: 'void-v0',
    version: '1.0.0',
    mode: isRender ? 'Render Web Service' : 'Express Server',
    message: 'Telegram бот void-v0 работает!'
  });
});

// Создаем маршрут для API статуса
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    name: 'void-v0',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Webhook для Telegram
app.post('/webhook', async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке webhook:', error);
    res.status(500).send('Webhook Error');
  }
});

// Стартуем сервер
const server = http.createServer(app);
server.listen(config.PORT, () => {
  console.log(`Сервер запущен на порту ${config.PORT}`);
  
  // Задаем webhook для Telegram
  if (config.NODE_ENV === 'production') {
    bot.telegram.setWebhook(`${config.SITE_URL}/webhook`)
      .then(() => {
        console.log(`Webhook установлен на ${config.SITE_URL}/webhook`);
      })
      .catch(err => {
        console.error('Ошибка при установке webhook:', err);
      });
  } else {
    // В режиме разработки используем polling
    bot.launch()
      .then(() => {
        console.log('Бот запущен в режиме polling');
      })
      .catch(err => {
        console.error('Ошибка при запуске бота:', err);
      });
  }
});

// Обработка завершения работы
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  server.close();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  server.close();
});

console.log('Бот void-v0 готов к работе'); 