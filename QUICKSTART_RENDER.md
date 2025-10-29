# 🚀 Быстрый старт на Render.com

## За 5 минут!

### 1️⃣ Регистрация (1 мин)
```
https://render.com/ → Get Started → Sign up with GitHub
```

### 2️⃣ Загрузка в GitHub (2 мин)
```
1. Создайте репозиторий на GitHub
2. Загрузите папку bakery-render
3. Commit → Push
```

**Быстро через GitHub web:**
- github.com → New repository
- Upload files → перетащите все файлы
- Commit

### 3️⃣ Создание сервиса (1 мин)
```
Render Dashboard:
→ New + 
→ Web Service
→ Connect GitHub repository
→ Выберите ваш репо

Настройки:
  Name: bakery-miniapp
  Environment: Node
  Build: npm install
  Start: npm start
  Plan: Free

→ Create Web Service
```

### 4️⃣ Environment Variables (1 мин)
```
В Render:
→ Environment tab
→ Add Environment Variable

Добавьте:
BOT_TOKEN=8210216557:AAFeNn2-EW1nnbL-Ahyk3f1dpq3JjrlniCI
ADMIN_ID=8086901919
SUPABASE_URL=https://gtinslbrwdpqkxeibuqs.supabase.co
SUPABASE_KEY=eyJhbGc...ваш_ключ

→ Save Changes
```

### 5️⃣ Настройка бота (30 сек)
```
Telegram → @BotFather
→ /setmenubutton
→ Выберите бота
→ Текст: "Открыть магазин"
→ URL: https://ваше-имя.onrender.com
```

---

## ✅ Готово!

Откройте бота → нажмите кнопку меню → приложение работает! 🎉

---

## ⚠️ Важно!

**Free plan засыпает:**
- После 15 минут → сервис останавливается
- Первое открытие → ~30 секунд загрузка

**Решение:**
- UptimeRobot: https://uptimerobot.com/
- Пингует каждые 5 минут
- Держит сервис активным

---

## 🔧 URL приложения

```
Основное:    https://ваше-имя.onrender.com
Админка:     https://ваше-имя.onrender.com/admin.html
Healthcheck: https://ваше-имя.onrender.com/api/health
```

---

## 📝 Полная инструкция

Смотрите `RENDER_GUIDE.md` для подробностей!

---

**Удачи! 🚀**
