const dotenv = require('dotenv');
const { setWebhook } = require('./api/webhook');

// Загружаем переменные окружения
dotenv.config();

const webhookUrl = process.env.WEBHOOK_URL;

if (!webhookUrl) {
  console.error('WEBHOOK_URL не задан в переменных окружения!');
  process.exit(1);
}

// Устанавливаем webhook
setWebhook(webhookUrl)
  .then(success => {
    if (success) {
      console.log('Webhook успешно установлен!');
    } else {
      console.error('Не удалось установить webhook.');
    }
  })
  .catch(error => {
    console.error('Ошибка при установке webhook:', error);
  }); 