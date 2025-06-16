/**
 * Вспомогательные функции для Render
 */

// Функция для логирования ошибок
exports.logError = (context, error) => {
  console.error(`[${context}] Ошибка:`, error.message || error);
  if (error.stack) {
    console.error(error.stack);
  }
}; 