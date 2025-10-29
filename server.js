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
    const { orderData, userId, userName } = req.body;

    if (!orderData || !userId) {
      return res.status(400).json({ error: 'Неверные данные заказа' });
    }

    // Формируем сообщение
    let message = `🛍 <b>НОВЫЙ ЗАКАЗ</b>\n\n`;
    message += `👤 <b>Клиент:</b> ${orderData.name}\n`;
    message += `📱 <b>Телефон:</b> ${orderData.phone}\n`;
    
    if (orderData.comment) {
      message += `💬 <b>Комментарий:</b> ${orderData.comment}\n`;
    }
    
    message += `\n📦 <b>Заказ:</b>\n`;
    orderData.items.forEach(item => {
      message += `• ${item.name} x${item.quantity} = ${item.price * item.quantity} ₸\n`;
    });
    
    message += `\n💰 <b>ИТОГО: ${orderData.total} ₸</b>\n`;
    message += `\n🆔 Telegram ID: ${userId}`;
    if (userName) {
      message += `\n👤 Username: @${userName}`;
    }

    // Отправляем в Telegram админу
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: ADMIN_ID,
      text: message,
      parse_mode: 'HTML'
    });

    // Если включены платежи, отправляем реквизиты клиенту
    if (orderData.kaspi_phone) {
      const paymentMessage = `✅ <b>Ваш заказ принят!</b>\n\n` +
        `Спасибо за заказ! Мы скоро свяжемся с вами.\n\n` +
        `💳 <b>Реквизиты для оплаты Kaspi:</b>\n` +
        `📱 ${orderData.kaspi_phone}\n` +
        `💰 Сумма: ${orderData.total} ₸\n\n` +
        (orderData.kaspi_link ? `🔗 <a href="${orderData.kaspi_link}">Оплатить по ссылке</a>\n\n` : '') +
        `После оплаты, пожалуйста, отправьте скриншот чека в бот.`;

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: userId,
        text: paymentMessage,
        parse_mode: 'HTML'
      });
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

    const statusMessages = {
      processing: '⏳ Ваш заказ #{orderNumber} принят в работу!',
      completed: '✅ Ваш заказ #{orderNumber} готов! Можете забрать.',
      cancelled: '❌ Ваш заказ #{orderNumber} отменён.\n\nПо вопросам звоните: {shopPhone}'
    };

    let message = statusMessages[status] || 'Статус вашего заказа изменён';
    message = message.replace('{orderNumber}', orderNumber);
    message = message.replace('{shopPhone}', shopPhone || '');

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
    configured: !!(BOT_TOKEN && ADMIN_ID && SUPABASE_URL && SUPABASE_KEY)
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Telegram Bot: ${BOT_TOKEN ? '✅ Настроен' : '❌ Не настроен'}`);
  console.log(`🗄️  Supabase: ${SUPABASE_URL ? '✅ Настроен' : '❌ Не настроен'}`);
});
