# Обновление базы данных для поддержки мультивалютности

## Важно: выполните эти SQL команды в Supabase SQL Editor

### Шаг 1: Добавление поля currency в таблицу expenses

```sql
-- Добавляем поле currency для хранения валюты каждого расхода
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ILS';

-- Обновляем существующие записи (если есть) - устанавливаем ILS по умолчанию
UPDATE expenses
SET currency = 'ILS'
WHERE currency IS NULL;
```

### Шаг 2: Создание таблицы для хранения настроек пользователя

```sql
-- Создаем таблицу user_settings для хранения основной валюты пользователя
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
    default_currency TEXT DEFAULT 'ILS' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включаем RLS для user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи могут видеть только свои настройки
CREATE POLICY "Users can view own settings"
ON user_settings FOR SELECT
USING (auth.uid() = user_id);

-- Политика: пользователи могут создавать свои настройки
CREATE POLICY "Users can create own settings"
ON user_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Политика: пользователи могут обновлять свои настройки
CREATE POLICY "Users can update own settings"
ON user_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
```

### Шаг 3: Проверка

После выполнения команд проверьте:

```sql
-- Проверка структуры таблицы expenses
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'expenses' AND column_name = 'currency';

-- Проверка таблицы user_settings
SELECT * FROM user_settings;
```

## Что изменилось

1. **Таблица expenses** теперь имеет поле `currency` (текстовое, по умолчанию 'ILS')
2. **Новая таблица user_settings** хранит основную валюту каждого пользователя
3. Все настройки защищены Row Level Security (RLS)

## Примечание

- Существующие расходы получат валюту ILS по умолчанию
- Каждый пользователь может иметь свою основную валюту
- При добавлении нового расхода можно указать любую валюту
- Все суммы будут автоматически конвертироваться в основную валюту пользователя
