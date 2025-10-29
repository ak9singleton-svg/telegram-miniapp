# 🍰 Telegram Mini App - Кондитерская (Render.com)

Безопасная версия мини-приложения для Telegram с деплоем на **Render.com**

---

## 🎯 Почему Render?

- ✅ **Бесплатный хостинг**
- ✅ **Автоматический HTTPS**
- ✅ **Простая настройка** (через GUI)
- ✅ **Автодеплой** из GitHub
- ✅ **Хорошо работает в Казахстане**
- ✅ **Environment Variables** для секретов

---

## 🚀 Быстрый старт

### За 5 минут:

1. **Зарегистрируйтесь** на https://render.com/
2. **Загрузите проект** в GitHub
3. **Создайте Web Service** на Render
4. **Добавьте переменные** окружения
5. **Настройте бота** в @BotFather

📖 **Подробная инструкция:** `RENDER_GUIDE.md`  
⚡ **Быстрая инструкция:** `QUICKSTART_RENDER.md`

---

## 📁 Структура проекта

```
bakery-render/
├── server.js              # 🔒 Node.js сервер с API
├── package.json           # Зависимости
├── render.yaml            # Конфигурация Render
├── .env.example           # Пример переменных
├── .gitignore            # Защита секретов
│
├── RENDER_GUIDE.md        # Полная инструкция
├── QUICKSTART_RENDER.md   # Быстрый старт
└── README.md              # Этот файл
│
└── public/
    ├── index.html         # Клиентское приложение
    └── admin.html         # Админ-панель
```

---

## 🔒 Безопасность

### Что защищено:
- ✅ `BOT_TOKEN` - на сервере в Environment Variables
- ✅ `ADMIN_ID` - на сервере
- ✅ Отправка через API (не из браузера)
- ✅ `.env` не попадает в Git

### Что безопасно показывать:
- ✅ `SUPABASE_KEY` (anon key - публичный)
- ✅ Весь код (токенов нет)

---

## 🛠 API Endpoints

```
POST /api/send-order       # Отправка заказа в Telegram
POST /api/notify-status    # Уведомление о статусе
GET  /api/config          # Настройки Supabase
GET  /api/health          # Проверка работы
```

---

## 📊 Возможности

### Для клиентов:
- ✅ Каталог товаров с категориями
- ✅ Корзина покупок
- ✅ Оформление заказа
- ✅ История заказов
- ✅ Мультиязычность (RU/KK)

### Для администратора:
- ✅ Управление товарами
- ✅ Просмотр заказов
- ✅ Изменение статусов
- ✅ Настройки магазина
- ✅ Уведомления клиентам

---

## ⚠️ Особенности Free Plan

**Render Free Plan:**
- ✅ 750 часов/месяц (хватит для 1 проекта)
- ⚠️ Засыпает после 15 минут неактивности
- ⚠️ Cold start ~30 секунд

**Решение "засыпания":**
1. **UptimeRobot** (бесплатно):
   - https://uptimerobot.com/
   - Пингует каждые 5 минут
   - URL: `https://ваш-сервис.onrender.com/api/health`

2. **Upgrade на Starter** ($7/мес):
   - Не засыпает
   - Моментальный отклик

---

## 🗄 Настройка Supabase

Создайте таблицы:

### `products`
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_kk TEXT,
  description TEXT,
  description_kk TEXT,
  price NUMERIC NOT NULL,
  category TEXT NOT NULL,
  category_kk TEXT,
  image TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `orders`
```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  date TIMESTAMP NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_comment TEXT,
  telegram_user_id BIGINT,
  telegram_username TEXT,
  telegram_first_name TEXT,
  telegram_last_name TEXT,
  items JSONB NOT NULL,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'new'
);
```

### `settings`
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_name TEXT,
  shop_phone TEXT,
  shop_logo TEXT,
  kaspi_phone TEXT,
  kaspi_link TEXT,
  payment_enabled BOOLEAN DEFAULT false
);
```

---

## 🔄 Обновление кода

Render автоматически деплоит при push в GitHub:

```bash
git add .
git commit -m "Обновление"
git push
```

Через 1-2 минуты изменения будут на сервере! ✅

---

## 🐛 Решение проблем

### Сервис не запускается
→ Проверьте **Logs** в Render Dashboard

### Заказы не приходят
→ Проверьте **Environment Variables**

### Медленно открывается
→ Cold start на Free плане (норма)  
→ Используйте UptimeRobot

### Полный гайд по проблемам
→ Смотрите `RENDER_GUIDE.md`

---

## 📞 Полезные ссылки

- **Render:** https://render.com/
- **Render Docs:** https://render.com/docs
- **Supabase:** https://supabase.com/
- **@BotFather:** https://t.me/BotFather
- **UptimeRobot:** https://uptimerobot.com/

---

## 🎯 Чеклист деплоя

- [ ] Зарегистрировались на Render
- [ ] Загрузили код в GitHub
- [ ] Создали Web Service
- [ ] Добавили 4 Environment Variables
- [ ] Дождались зеленой галочки (deployed)
- [ ] Скопировали URL
- [ ] Настроили в @BotFather
- [ ] Протестировали в Telegram
- [ ] Настроили UptimeRobot (опционально)

---

## 💡 Технологии

**Backend:**
- Node.js + Express
- Axios для Telegram API
- dotenv для переменных

**Frontend:**
- React (UMD)
- Tailwind CSS
- Telegram WebApp API
- Supabase JS Client

**Hosting:**
- Render.com (бесплатно!)

---

## 🎉 Готово к использованию!

Следуйте инструкции в `QUICKSTART_RENDER.md` или `RENDER_GUIDE.md`

**Удачи с запуском! 🚀**

---

## 📝 Версия

- **Версия:** 2.1 (Render Edition)
- **Дата:** 29 октября 2024
- **Платформа:** Render.com

---

Сделано с ❤️ для вашего бизнеса
