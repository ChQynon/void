// Основной файл для запуска бота на Render
const express = require('express');
const http = require('http');
const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

console.log('Загрузка бота void-v0...');

// Конфигурация
const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '7853851422:AAGDMjSxHz18WNX1DAVhcSVPIA4Xa6H_2yo',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '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',
  // Используем Render-специфичную переменную окружения, если она доступна
  SITE_URL: process.env.RENDER_EXTERNAL_URL || process.env.SITE_URL || 'https://void-gc6f.onrender.com',
  SITE_NAME: process.env.SITE_NAME || 'void-v0',
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// Сразу логируем актуальный URL
console.log(`Используется URL: ${config.SITE_URL}`);

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
    message: 'Telegram бот void-v0 работает!',
    url: config.SITE_URL
  });
});

// Создаем маршрут для API статуса
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    name: 'void-v0',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    webhook_url: `${config.SITE_URL}/webhook`
  });
});

// Webhook для Telegram
app.post('/webhook', async (req, res) => {
  try {
    console.log('Получено обновление от Telegram:', JSON.stringify(req.body).slice(0, 200) + '...');
    
    // Проверяем валидность обновления
    if (!req.body || !req.body.update_id) {
      console.warn('Получен невалидный запрос на webhook:', req.body);
      return res.status(400).send('Invalid update format');
    }
    
    await bot.handleUpdate(req.body);
    console.log('Обновление успешно обработано');
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке webhook:', error);
    // Возвращаем 200 даже при ошибке, чтобы Telegram перестал пытаться отправить обновление повторно
    return res.status(200).send('Error handled');
  }
});

// Функция для настройки webhook
async function setupWebhook(url) {
  try {
    const webhookUrl = `${url}/webhook`;
    console.log(`Настройка webhook на URL: ${webhookUrl}`);
    
    // Сначала удаляем текущий webhook
    console.log('Удаляю предыдущий webhook...');
    await bot.telegram.deleteWebhook();
    console.log('Предыдущий webhook удален');
    
    // Пауза перед установкой нового webhook для уменьшения вероятности гонок
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Устанавливаем новый webhook
    console.log('Устанавливаю новый webhook...');
    const result = await bot.telegram.setWebhook(webhookUrl, {
      drop_pending_updates: true  // Опция для пропуска необработанных обновлений
    });
    
    if (result) {
      console.log(`✅ Webhook успешно установлен на ${webhookUrl}`);
      
      // Получаем информацию о webhook для проверки
      const info = await bot.telegram.getWebhookInfo();
      console.log('Информация о webhook:', info);
    } else {
      console.error('❌ Не удалось установить webhook!');
    }
    return result;
  } catch (error) {
    console.error('Ошибка при настройке webhook:', error);
    return false;
  }
}

// Стартуем сервер
const server = http.createServer(app);
server.listen(config.PORT, () => {
  console.log(`Сервер запущен на порту ${config.PORT}`);
  
  // В production всегда устанавливаем webhook
  if (config.NODE_ENV === 'production') {
    // Делаем небольшую задержку перед настройкой webhook
    setTimeout(() => {
      setupWebhook(config.SITE_URL)
        .then(success => {
          if (!success) {
            console.log('⚠️ Ошибка при настройке webhook, попробуйте вручную:');
            console.log(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/setWebhook?url=${config.SITE_URL}/webhook`);
          }
        });
    }, 5000); // 5 секунд задержки
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

// Добавляем маршрут для ручной настройки webhook
app.get('/setup-webhook', async (req, res) => {
  try {
    console.log('Запрос на установку webhook...');
    let webhookUrl = config.SITE_URL;
    
    // Проверка URL
    if (!webhookUrl || !webhookUrl.startsWith('https://')) {
      return res.status(400).send('Неверный URL сервера. Webhook должен использовать HTTPS.');
    }
    
    console.log(`Устанавливаю webhook на URL: ${webhookUrl}`);
    const success = await setupWebhook(webhookUrl);
    
    if (success) {
      // Получаем информацию о webhook для проверки
      const info = await bot.telegram.getWebhookInfo();
      return res.send(`Webhook успешно настроен!<br><pre>${JSON.stringify(info, null, 2)}</pre>`);
    } else {
      return res.status(500).send('Не удалось настроить webhook. Проверьте логи сервера.');
    }
  } catch (error) {
    console.error('Ошибка при настройке webhook:', error);
    return res.status(500).send(`Ошибка: ${error.message}`);
  }
});

// Обработка завершения работы
process.once('SIGINT', () => {
  console.log('Получен сигнал SIGINT, завершаю работу...');
  // Останавливаем бота только если он запущен через polling (в режиме разработки)
  if (config.NODE_ENV !== 'production') {
    bot.stop('SIGINT');
  }
  server.close();
});
process.once('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM, завершаю работу...');
  // Останавливаем бота только если он запущен через polling (в режиме разработки)
  if (config.NODE_ENV !== 'production') {
    bot.stop('SIGTERM');
  }
  server.close();
});

console.log('Бот void-v0 готов к работе'); 