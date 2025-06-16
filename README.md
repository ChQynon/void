# void-v0 Telegram Бот

Telegram-бот для анализа изображений с помощью OpenRouter API и поддержкой истории разговоров.

## Особенности

- Анализ изображений через API OpenRouter (модель internvl3-14b)
- Запоминание истории диалога для контекстных ответов
- Поддержка групповых чатов с упоминанием бота
- Аварийный режим при недоступности API
- Интерактивное меню с инлайн-кнопками

## Деплой на Render

1. Форкните или клонируйте репозиторий
2. Зарегистрируйтесь на [Render](https://render.com/)
3. Создайте новый Web Service, выбрав ваш репозиторий
4. Настройте следующим образом:
   - **Name**: void-v0-bot (или любое другое имя)
   - **Region**: Ближайший к вам
   - **Branch**: main
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
5. Добавьте переменные окружения:
   - `TELEGRAM_BOT_TOKEN` - токен вашего бота от BotFather
   - `OPENROUTER_API_KEY` - ключ API от OpenRouter
   - `SITE_URL` - URL вашего сервиса на Render (после создания)
   - `SITE_NAME` - название вашего бота
   - `NODE_ENV` - `production`
   - `RENDER` - `true`
6. После деплоя, настройте webhook:
   ```
   node setup-webhook-render.js YOUR_BOT_TOKEN https://your-app-name.onrender.com
   ```

## Настройка вебхука для Telegram

После успешного деплоя, настройте вебхук:

```
node setup-webhook-render.js YOUR_BOT_TOKEN https://your-app-name.onrender.com
```

## Локальный запуск для тестирования

1. Установите зависимости: `npm install`
2. Создайте файл `.env` с переменными окружения
3. Запустите локальный сервер: `npm run dev`

## Заметки по безопасности

- Храните OPENROUTER_API_KEY и TELEGRAM_BOT_TOKEN в переменных окружения
- Используйте HTTPS для webhook
- Не храните чувствительные данные в коде

## Решение проблем

Если бот не отвечает после деплоя:

1. Проверьте логи в панели управления Render
2. Убедитесь, что вебхук настроен правильно
3. Проверьте переменные окружения
4. Включите аварийный режим (EMERGENCY_MODE = true) для базовой функциональности

## Автор

[@qynon](https://t.me/qynon) 