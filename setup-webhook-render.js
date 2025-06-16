/**
 * Скрипт для настройки вебхука Telegram для Render
 */

const fetch = require('node-fetch');

// Чтение переменных окружения или использование параметров командной строки
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.argv[2];
const RENDER_SITE_URL = process.env.SITE_URL || process.argv[3];

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Ошибка: TELEGRAM_BOT_TOKEN не найден. Укажите токен как переменную окружения или первый аргумент командной строки.');
  console.error('Например: node setup-webhook-render.js YOUR_BOT_TOKEN https://your-app.onrender.com');
  process.exit(1);
}

if (!RENDER_SITE_URL) {
  console.error('Ошибка: SITE_URL не найден. Укажите URL как переменную окружения или второй аргумент командной строки.');
  console.error('Например: node setup-webhook-render.js YOUR_BOT_TOKEN https://your-app.onrender.com');
  process.exit(1);
}

// Добавляем /webhook к URL сайта
const webhookUrl = `${RENDER_SITE_URL}/webhook`;
const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

console.log(`\n🔧 Настройка webhook для Telegram бота на Render\n`);
console.log(`Бот токен: ${TELEGRAM_BOT_TOKEN.substring(0, 5)}...`);
console.log(`URL сайта: ${RENDER_SITE_URL}`);
console.log(`Webhook URL: ${webhookUrl}\n`);

async function deleteCurrentWebhook() {
  try {
    console.log('Удаление текущего вебхука...');
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Текущий вебхук успешно удален');
    } else {
      console.error('❌ Ошибка при удалении вебхука:', data.description);
    }
  } catch (error) {
    console.error('❌ Произошла ошибка при удалении вебхука:', error);
  }
}

async function setupWebhook() {
  try {
    console.log(`Настройка нового вебхука на URL: ${webhookUrl}`);
    
    const response = await fetch(telegramApiUrl);
    const data = await response.json();
    
    if (data.ok) {
      console.log('✅ Вебхук успешно настроен!');
    } else {
      console.error('❌ Ошибка при настройке вебхука:', data.description);
    }
  } catch (error) {
    console.error('❌ Произошла ошибка при запросе к API Telegram:', error);
  }
}

// Получение текущей информации о вебхуке
async function getWebhookInfo() {
  try {
    console.log('Получение текущей информации о вебхуке...');
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const data = await response.json();
    
    if (data.ok) {
      console.log('\n--- Информация о вебхуке ---');
      console.log(`URL: ${data.result.url || 'не установлен'}`);
      console.log(`Успешных обновлений: ${data.result.pending_update_count || 0}`);
      console.log(`Последняя ошибка: ${data.result.last_error_message || 'нет'}`);
      
      if (data.result.url === webhookUrl) {
        console.log('\n✅ Вебхук настроен правильно');
      } else if (data.result.url) {
        console.log('\n⚠️ Вебхук настроен, но на другой URL. Текущий URL отличается от требуемого.');
      } else {
        console.log('\n⚠️ Вебхук не настроен');
      }
    } else {
      console.error('Ошибка при получении информации о вебхуке:', data.description);
    }
  } catch (error) {
    console.error('Произошла ошибка при запросе информации о вебхуке:', error);
  }
}

// Тестирование статуса сервера
async function testServerStatus() {
  try {
    console.log(`\nПроверка статуса сервера ${RENDER_SITE_URL}...`);
    
    const response = await fetch(RENDER_SITE_URL);
    const status = response.status;
    
    if (status >= 200 && status < 300) {
      console.log(`✅ Сервер доступен, код ответа: ${status}`);
      
      try {
        const data = await response.json();
        console.log('Информация от сервера:', data);
      } catch (e) {
        console.log('Ответ сервера не в формате JSON');
      }
    } else {
      console.error(`❌ Сервер недоступен или вернул ошибку. Код ответа: ${status}`);
    }
  } catch (error) {
    console.error('❌ Не удалось подключиться к серверу:', error.message);
  }
}

// Запуск функций
(async () => {
  await testServerStatus();
  await getWebhookInfo();
  console.log('\n---------------------------------');
  await deleteCurrentWebhook();
  console.log('---------------------------------');
  await setupWebhook();
  console.log('---------------------------------');
  await getWebhookInfo();
  console.log('\nПроверьте переменные окружения в настройках Render:');
  console.log('TELEGRAM_BOT_TOKEN, OPENROUTER_API_KEY, SITE_URL, SITE_NAME, NODE_ENV=production, RENDER=true');
})(); 