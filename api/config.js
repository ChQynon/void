// Загружаем конфигурацию для api директории
// Файл нужен для правильной работы в Vercel среде

// Пробуем загрузить dotenv, если доступен
try {
  require('dotenv').config();
} catch (e) {
  console.warn('dotenv не установлен, используем только переменные окружения или дефолты');
}

module.exports = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '7853851422:AAGDMjSxHz18WNX1DAVhcSVPIA4Xa6H_2yo',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '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',
  SITE_URL: process.env.SITE_URL || 'https://void-teal.vercel.app',
  SITE_NAME: process.env.SITE_NAME || 'void-v0'
}; 