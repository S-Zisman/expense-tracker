# Настройка Supabase для системы аутентификации

## Шаг 1: Обновление таблицы expenses

Выполните этот SQL в Supabase SQL Editor:

```sql
-- Добавляем колонку user_id
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Создаем индекс для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
```

## Шаг 2: Настройка Row Level Security (RLS)

Выполните этот SQL:

```sql
-- Включаем RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Удаляем старую политику (если была)
DROP POLICY IF EXISTS "Enable all access for all users" ON expenses;

-- Создаем политику: пользователи видят только свои расходы
CREATE POLICY "Users can view own expenses"
ON expenses FOR SELECT
USING (auth.uid() = user_id);

-- Создаем политику: пользователи могут создавать свои расходы
CREATE POLICY "Users can create own expenses"
ON expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Создаем политику: пользователи могут удалять свои расходы
CREATE POLICY "Users can delete own expenses"
ON expenses FOR DELETE
USING (auth.uid() = user_id);

-- Создаем политику: пользователи могут обновлять свои расходы
CREATE POLICY "Users can update own expenses"
ON expenses FOR UPDATE
USING (auth.uid() = user_id);
```

## Шаг 3: Настройка Email Authentication

1. Перейдите в **Authentication > Providers**
2. Убедитесь, что **Email** включен
3. В разделе **Email Templates** можно настроить письма подтверждения
4. Для тестирования можно отключить подтверждение email:
   - Перейдите в **Authentication > Settings**
   - Отключите "Enable email confirmations"

## Шаг 4: URL настройки

В **Authentication > URL Configuration** добавьте:
- Site URL: `http://localhost:8000` (для локальной разработки)
- Redirect URLs:
  - `http://localhost:8000/index.html`
  - `https://s-zisman.github.io/expense-tracker/index.html` (для GitHub Pages)

## Проверка настроек

После выполнения всех шагов:
1. Откройте `auth.html` в браузере
2. Зарегистрируйте нового пользователя
3. Войдите в систему
4. Создайте расход
5. Выйдите и войдите другим пользователем - вы не должны видеть расходы первого пользователя

## Миграция существующих данных (опционально)

Если у вас уже есть расходы без user_id, вы можете удалить их или назначить их себе:

```sql
-- Удалить все старые расходы
DELETE FROM expenses WHERE user_id IS NULL;

-- ИЛИ назначить их своему пользователю (замените YOUR_USER_ID)
UPDATE expenses
SET user_id = 'YOUR_USER_ID'
WHERE user_id IS NULL;
```

Чтобы узнать свой user_id, зарегистрируйтесь и выполните:
```sql
SELECT * FROM auth.users;
```
