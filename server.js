const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Переменные окружения (будут в .env на Glitch)
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Проверка конфигурации
if (!BOT_TOKEN || !ADMIN_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('⚠️  Заполните все переменные окружения в .env файле!');
}

// API: Отправка заказа в Telegram (безопасно на сервере)
app.post('/api/send-order', async (req, res) => {
  try {
    const { 
      orderId, 
      date, 
      customerName, 
      customerPhone, 
      customerComment,
      telegramUserId, 
      telegramUsername, 
      items, 
      total,
      paymentEnabled,
      kaspiPhone,
      kaspiLink
    } = req.body;

    if (!orderId || !items || !total) {
      return res.status(400).json({ error: 'Неверные данные заказа' });
    }

    // Формируем красивое сообщение админу (как было раньше!)
    let message = "🆕 <b>НОВЫЙ ЗАКАЗ!</b>\n\n";
    message += `📋 Заказ #${orderId.slice(-6)}\n`;
    message += `📅 ${new Date(date).toLocaleString('ru-RU')}\n\n`;
    
    message += "<b>👤 Клиент:</b>\n";
    message += `Имя: ${customerName}\n`;
    message += `Телефон: ${customerPhone}\n`;
    if (telegramUsername) message += `Telegram: @${telegramUsername}\n`;
    if (telegramUserId) message += `ID: ${telegramUserId}\n`;
    if (customerComment) message += `\nКомментарий: ${customerComment}\n`;
    
    message += "\n<b>🛒 Товары:</b>\n";
    items.forEach(item => {
      message += `• ${item.name} x${item.quantity} = ${item.price * item.quantity} ₸\n`;
    });
    
    message += `\n<b>💰 Итого: ${total} ₸</b>`;

    // Отправляем в Telegram админу
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: ADMIN_ID,
      text: message,
      parse_mode: 'HTML'
    });

    // Если включены платежи и есть telegram_user_id, отправляем реквизиты клиенту
    if (paymentEnabled && telegramUserId) {
      let paymentMessage = "💳 <b>Реквизиты для оплаты / Төлем деректемелері</b>\n\n";
      paymentMessage += `📋 Заказ / Тапсырыс #${orderId.slice(-6)}\n`;
      paymentMessage += `💰 Сумма / Сомасы: <b>${total} ₸</b>\n\n`;
      
      if (kaspiPhone) {
        paymentMessage += `📱 <b>Kaspi номер:</b>\n+7${kaspiPhone}\n\n`;
      }
      
      paymentMessage += "После оплаты, пожалуйста, отправьте скриншот чека владельцу магазина.\n";
      paymentMessage += "Төлегеннен кейін чектің скриншотын дүкен иесіне жіберіңіз.\n\n";
      paymentMessage += "Спасибо за заказ! / Тапсырысыңызға рахмет! ❤️";

      const payload = {
        chat_id: telegramUserId,
        text: paymentMessage,
        parse_mode: 'HTML'
      };

      // Добавляем кнопку Kaspi если есть ссылка
      if (kaspiLink) {
        payload.reply_markup = {
          inline_keyboard: [[
            { text: "💳 Оплатить через Kaspi", url: kaspiLink }
          ]]
        };
      }

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, payload);
    }

    res.json({ success: true, message: 'Заказ успешно отправлен' });

  } catch (error) {
    console.error('Ошибка отправки заказа:', error);
    res.status(500).json({ 
      error: 'Ошибка отправки заказа',
      details: error.message 
    });
  }
});

// API: Изменение статуса заказа (отправляет уведомление клиенту)
app.post('/api/notify-status', async (req, res) => {
  try {
    const { userId, status, orderNumber, shopPhone } = req.body;

    if (!userId || !status || !orderNumber) {
      return res.status(400).json({ error: 'Неверные данные' });
    }

    let message = '';
    
    switch (status) {
      case 'processing':
        message = `⏳ <b>Ваш заказ принят в работу! / Тапсырысыңыз орындалуда!</b>\n\n`;
        message += `📋 Заказ / Тапсырыс #${orderNumber}\n`;
        message += `Мы начали готовить ваш заказ. Скоро он будет готов! 👨‍🍳\n`;
        message += `Тапсырысыңызды дайындауды бастадық. Жақында дайын болады!`;
        break;
        
      case 'completed':
        message = `🎉 <b>Ваш заказ готов! / Тапсырысыңыз дайын!</b>\n\n`;
        message += `📋 Заказ / Тапсырыс #${orderNumber}\n`;
        message += `Можете забирать или ожидайте курьера! 🚗\n`;
        message += `Алып кетуге болады немесе курьерді күтіңіз!\n\n`;
        message += `Спасибо за заказ! / Тапсырысыңызға рахмет! ❤️`;
        break;
        
      case 'cancelled':
        message = `❌ <b>Ваш заказ отменён / Тапсырысыңыз жойылды</b>\n\n`;
        message += `📋 Заказ / Тапсырыс #${orderNumber}\n`;
        message += `К сожалению, мы не можем выполнить ваш заказ. Приносим извинения.\n`;
        message += `Өкінішке орай, тапсырысыңызды орындай алмаймыз. Кешірім сұраймыз.\n\n`;
        if (shopPhone) {
          message += `Если у вас есть вопросы, свяжитесь с нами: ${shopPhone}\n`;
          message += `Сұрақтарыңыз болса, бізбен хабарласыңыз: ${shopPhone}`;
        }
        break;
        
      default:
        return res.status(400).json({ error: 'Неверный статус' });
    }

    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: userId,
      text: message,
      parse_mode: 'HTML'
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
    res.status(500).json({ error: 'Ошибка отправки уведомления' });
  }
});

// API: Получить публичный ключ Supabase (безопасно - это anon key)
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY // Это публичный anon key, его можно передавать
  });
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    botConfigured: !!BOT_TOKEN,
    supabaseConfigured: !!(SUPABASE_URL && SUPABASE_KEY),
    adminConfigured: !!ADMIN_ID
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    botConfigured: !!BOT_TOKEN
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Telegram Bot: ${BOT_TOKEN ? '✅ Настроен' : '❌ Не настроен'}`);
  console.log(`🗄️  Supabase: ${SUPABASE_URL ? '✅ Настроен' : '❌ Не настроен'}`);
});
