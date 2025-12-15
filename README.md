# Трекер расходов

Веб-приложение для учета личных расходов с интеграцией Supabase.

## Возможности

- Добавление новых расходов с указанием суммы, категории и описания
- Автоматическое сохранение в Supabase Database
- Просмотр списка всех расходов с датами и временем
- Статистика по категориям с итоговыми суммами
- Фильтрация расходов по категориям
- Удаление расходов
- Адаптивный дизайн для мобильных устройств

## Категории расходов

- Продукты
- Транспорт
- Развлечения
- Здоровье
- Одежда
- Образование
- Коммунальные услуги
- Другое

## Установка и запуск

### 1. Настройка Supabase

Перед запуском приложения необходимо создать таблицу в Supabase:

1. Войдите в свой проект Supabase
2. Перейдите в раздел SQL Editor
3. Выполните следующий SQL запрос:

```sql
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включаем Row Level Security
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Создаем политику для публичного доступа (для разработки)
CREATE POLICY "Enable all access for all users" ON expenses
FOR ALL USING (true);
```

### 2. Запуск приложения

1. Откройте файл [index.html](index.html) в браузере
2. Или используйте локальный сервер:

```bash
# Если у вас установлен Python 3:
python3 -m http.server 8000

# Или используйте любой другой локальный сервер
# Затем откройте http://localhost:8000
```

## Структура проекта

```
expense-tracker/
├── index.html           # Главная страница с интерфейсом
├── styles.css          # Стили приложения
├── app.js              # Логика приложения
├── supabase-config.js  # Конфигурация Supabase
├── .gitignore          # Исключения для Git
└── README.md           # Документация
```

## Технологии

- HTML5
- CSS3 (с использованием CSS Variables и Grid Layout)
- JavaScript (ES6+)
- Supabase (Backend и база данных)

## Конфигурация

Ваши данные Supabase уже настроены в файле [supabase-config.js](supabase-config.js):
- Project URL: `https://mtugcrsgqfkejmzoxzdf.supabase.co`
- API Key: настроен

## Безопасность

В продакшене рекомендуется:
1. Настроить Row Level Security (RLS) в Supabase
2. Добавить аутентификацию пользователей
3. Ограничить доступ к таблице только авторизованным пользователям

## Разработка

Для разработки рекомендуется использовать Live Server или подобный инструмент для автоматической перезагрузки страницы при изменениях.
