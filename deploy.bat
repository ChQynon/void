@echo off
echo Инициализация репозитория для void-v0 бота...

git init
git add .
git commit -m "Initial commit: void-v0 bot ready for Vercel deployment"
git branch -M main
git remote add origin https://github.com/qynon/void.git
git push -u origin main

echo.
echo Репозиторий успешно загружен на GitHub!
echo Теперь вы можете деплоить бота на Vercel.
pause 