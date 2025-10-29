# 🚀 Развертывание на Render.com

## Быстрый старт за 5 минут!

---

## Шаг 1: Регистрация на Render (1 мин)

1. Откройте https://render.com/
2. Нажмите **"Get Started"**
3. Зарегистрируйтесь через:
   - GitHub (рекомендуется) ✅
   - GitLab
   - Email

---

## Шаг 2: Загрузка проекта в GitHub (2 мин)

### Вариант A: Через GitHub Desktop

1. Скачайте GitHub Desktop: https://desktop.github.com/
2. Создайте новый репозиторий
3. Перетащите папку `bakery-render` в репо
4. Нажмите "Commit" → "Publish"

### Вариант B: Через командную строку

```bash
cd bakery-render
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ВАШ_USERNAME/bakery-miniapp.git
git push -u origin main
```

### Вариант C: Через web интерфейс GitHub

1. Зайдите на https://github.com/
2. Нажмите "New repository"
3. Назовите: `bakery-miniapp`
4. Загрузите файлы через "Upload files"

---

## Шаг 3: Создание Web Service на Render (2 мин)

1. В Render Dashboard нажмите **"New +"** → **"Web Service"**

2. Подключите GitHub:
   - Нажмите "Connect GitHub"
   - Авторизуйте Render
   - Выберите репозиторий `bakery-miniapp`

3. Настройте параметры:
   ```
   Name:           bakery-miniapp
   Environment:    Node
   Build Command:  npm install
   Start Command:  npm start
   ```

4. Выберите **Free Plan** (бесплатно)

5. Нажмите **"Create Web Service"**

---

## Шаг 4: Настройка Environment Variables (1 мин)

В настройках вашего сервиса на Render:

1. Откройте вкладку **"Environment"**
2. Нажмите **"Add Environment Variable"**
3. Добавьте переменные:

```
BOT_TOKEN = 8210216557:AAFeNn2-EW1nnbL-Ahyk3f1dpq3JjrlniCI
ADMIN_ID = 8086901919
SUPABASE_URL = https://gtinslbrwdpqkxeibuqs.supabase.co
SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aW5zbGJyd2RwcWt4ZWlidXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjM1MjMsImV4cCI6MjA3NjY5OTUyM30.3LbYP6AcsQ-qVZtdMgH6pJYX0rWLFGSUmT6errUwJOY
```

4. Нажмите **"Save Changes"**

Render автоматически перезапустит сервис.

---

## Шаг 5: Получение URL (30 сек)

После деплоя (займет 1-2 минуты):

1. Ваш URL будет вида: `https://bakery-miniapp.onrender.com`
2. Скопируйте его

---

## Шаг 6: Настройка Telegram бота (1 мин)

1. Откройте [@BotFather](https://t.me/BotFather)
2. Отправьте `/setmenubutton`
3. Выберите вашего бота
4. Текст кнопки: `Открыть магазин`
5. URL: `https://bakery-miniapp.onrender.com`

**Для админ-панели:**
- URL: `https://bakery-miniapp.onrender.com/admin.html`

---

## ✅ Проверка

1. Откройте бота в Telegram
2. Нажмите кнопку меню
3. Приложение должно открыться! 🎉

---

## 🔧 Особенности Render

### ⚠️ Важно знать:

**Free Plan "засыпает":**
- После 15 минут неактивности сервис останавливается
- Первое открытие занимает ~30 секунд (cold start)
- Это нормально для бесплатного плана

**Решения:**
1. **UptimeRobot** - пингует каждые 5 минут (держит активным)
   - https://uptimerobot.com/
   - Создайте HTTP(s) монитор
   - URL: `https://ваш-сервис.onrender.com/api/health`
   - Интервал: 5 минут

2. **Upgrade на Paid** ($7/месяц) - сервис всегда активен

---

## 📊 Мониторинг

### Просмотр логов:
1. Render Dashboard → Ваш сервис
2. Вкладка **"Logs"**
3. Здесь видны все запросы и ошибки

### Проверка здоровья:
Откройте в браузере:
```
https://ваш-сервис.onrender.com/api/health
```

Должен вернуть:
```json
{
  "status": "ok",
  "configured": true
}
```

---

## 🔄 Обновление кода

### Автоматический деплой:

1. Измените код локально
2. Закоммитьте в Git:
   ```bash
   git add .
   git commit -m "Обновление"
   git push
   ```
3. Render автоматически задеплоит изменения! ✅

### Ручной деплой:

В Render Dashboard:
- Нажмите **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🐛 Решение проблем

### Сервис не запускается

**Проверьте логи:**
1. Render Dashboard → Logs
2. Ищите ошибки красного цвета

**Частые ошибки:**

```
Error: Cannot find module 'express'
→ Решение: Проверьте package.json и Build Command
```

```
Error: BOT_TOKEN is not defined
→ Решение: Добавьте переменные в Environment
```

```
Port 3000 already in use
→ Решение: Render сам назначит порт, не волнуйтесь
```

---

### Приложение открывается медленно

**Причины:**
- Free plan "засыпает" после 15 минут
- Cold start занимает 20-30 секунд

**Решения:**
1. Используйте UptimeRobot для пинга
2. Upgrade на Paid план ($7/мес)

---

### Заказы не приходят

**Проверка:**

1. **Логи Render** - есть ли ошибки?
2. **Environment Variables** - правильно ли заполнены?
3. **API Health** - откройте `/api/health` в браузере
4. **BOT_TOKEN** - работает ли бот?

---

## 💡 Полезные команды

### Локальное тестирование:

```bash
# Установить зависимости
npm install

# Создать .env файл
cp .env.example .env
# Отредактируйте .env своими данными

# Запустить локально
npm start

# Откройте http://localhost:3000
```

---

## 📁 Структура URL

```
https://bakery-miniapp.onrender.com              → Основное приложение
https://bakery-miniapp.onrender.com/admin.html   → Админ-панель
https://bakery-miniapp.onrender.com/api/health   → Проверка работы
```

---

## 🔒 Безопасность

### ✅ Защищено:
- Environment Variables не видны публично
- Токены на сервере, не в коде
- HTTPS автоматически

### ⚠️ Рекомендации:
- Не добавляйте `.env` в Git (уже в .gitignore)
- Регулярно меняйте BOT_TOKEN
- Ограничьте доступ к админке по ADMIN_ID

---

## 🎯 Чеклист готовности

- [ ] Зарегистрировались на Render
- [ ] Загрузили код в GitHub
- [ ] Создали Web Service на Render
- [ ] Добавили Environment Variables
- [ ] Дождались успешного деплоя (зеленая галочка)
- [ ] Скопировали URL
- [ ] Настроили в @BotFather
- [ ] Протестировали в Telegram
- [ ] Проверили логи (нет ошибок)
- [ ] Оформили тестовый заказ

---

## 💰 Стоимость

### Free Plan:
- ✅ 750 часов в месяц (достаточно для 1 проекта)
- ⚠️ Засыпает после 15 минут неактивности
- ⚠️ Cold start ~30 секунд
- ✅ Бесплатный SSL
- ✅ Автодеплой из GitHub

### Starter Plan ($7/мес):
- ✅ Не засыпает
- ✅ Моментальный отклик
- ✅ Больше ресурсов

---

## 🚀 Дополнительные настройки

### Custom Domain (свой домен):

1. Купите домен (например на nic.kz)
2. В Render: Settings → Custom Domain
3. Добавьте CNAME запись в DNS

### Scaling (масштабирование):

Для большой нагрузки:
- Settings → Instance Type
- Выберите больше CPU/RAM

---

## 📞 Поддержка

**Документация Render:**
- https://render.com/docs

**Если нужна помощь:**
1. Проверьте Logs в Render
2. Проверьте Console в браузере (F12)
3. Смотрите примеры в README.md

---

## 🎉 Готово!

Ваше приложение работает на Render! 

**Следующие шаги:**
1. Добавьте товары через админку
2. Настройте UptimeRobot (опционально)
3. Протестируйте заказы
4. Запустите для клиентов!

Удачи! 🚀
