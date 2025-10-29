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

// Переменные окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Проверка конфигурации
if (!BOT_TOKEN || !ADMIN_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('⚠️  Заполните все переменные окружения в .env файле!');
}

// Supabase клиент для сервера
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Хранилище для временных данных (orderId -> userId)
const pendingReceipts = new Map();

// API: Отправка заказа в Telegram
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

    // Формируем сообщение админу
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

    if (paymentEnabled) {
      message += `\n\n⏰ <b>Статус:</b> Ожидает оплаты`;
    }

    // Отправляем админу
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: ADMIN_ID,
      text: message,
      parse_mode: 'HTML'
    });

    // Если включены платежи, отправляем реквизиты клиенту
    if (paymentEnabled && telegramUserId) {
      let paymentMessage = "💳 <b>Реквизиты для оплаты / Төлем деректемелері</b>\n\n";
      paymentMessage += `📋 Заказ / Тапсырыс #${orderId.slice(-6)}\n`;
      paymentMessage += `💰 Сумма / Сомасы: <b>${total} ₸</b>\n\n`;
      
      if (kaspiPhone) {
        paymentMessage += `📱 <b>Kaspi номер:</b>\n+7${kaspiPhone}\n\n`;
      }
      
      paymentMessage += "После оплаты нажмите кнопку ниже и отправьте скриншот чека.\n";
      paymentMessage += "Төлегеннен кейін төмендегі батырманы басып, чектің скриншотын жіберіңіз.\n\n";
      paymentMessage += "Спасибо за заказ! / Тапсырысыңызға рахмет! ❤️";

      const keyboard = {
        inline_keyboard: []
      };

      // Кнопка Kaspi если есть ссылка
      if (kaspiLink) {
        keyboard.inline_keyboard.push([
          { text: "💳 Оплатить через Kaspi", url: kaspiLink }
        ]);
      }

      // ГЛАВНАЯ КНОПКА - отправить чек
      keyboard.inline_keyboard.push([
        { text: "📤 Подтвердить оплату", callback_data: `receipt_${orderId}` }
      ]);

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: telegramUserId,
        text: paymentMessage,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });

      // Сохраняем связь orderId -> userId для обработки чека
      pendingReceipts.set(orderId, {
        userId: telegramUserId,
        orderNumber: orderId.slice(-6),
        total: total,
        customerName: customerName
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

// API: Изменение статуса заказа
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

      case 'pending_payment':
        message = `⏰ <b>Ожидаем оплату / Төлемді күтуде</b>\n\n`;
        message += `📋 Заказ / Тапсырыс #${orderNumber}\n`;
        message += `Пожалуйста, оплатите заказ и отправьте чек.\n`;
        message += `Өтінеміз, тапсырысты төлеп, чекті жіберіңіз.`;
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

// WEBHOOK для обработки сообщений от бота
// Альтернативный путь (без токена в URL)
app.post('/webhook', async (req, res) => {
  console.log('📩 Получен webhook запрос на /webhook:', JSON.stringify(req.body, null, 2));
  await handleWebhook(req, res);
});

app.post(`/bot${BOT_TOKEN}`, async (req, res) => {
  console.log('📩 Получен webhook запрос на /bot${BOT_TOKEN}:', JSON.stringify(req.body, null, 2));
  await handleWebhook(req, res);
});

// Общая функция обработки webhook
async function handleWebhook(req, res) {
  try {
    const update = req.body;

    // Обработка callback кнопок (нажатие "Подтвердить оплату")
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const data = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      // Нажата кнопка "Подтвердить оплату"
      if (data.startsWith('receipt_')) {
        const orderId = data.replace('receipt_', '');
        
        // Отвечаем на callback
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          callback_query_id: callbackQuery.id,
          text: '📸 Отлично! Теперь отправьте фото чека'
        });

        // Просим прислать фото
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "📸 <b>Отправьте фото чека об оплате</b>\n\nПросто отправьте скриншот или фото чека следующим сообщением.\n\n🇰🇿 <b>Төлем чегінің фотосын жіберіңіз</b>",
          parse_mode: 'HTML'
        });

        // Сохраняем, что ждём фото от этого пользователя
        pendingReceipts.set(`waiting_${chatId}`, orderId);
      }

      // Админ подтверждает оплату
      if (data.startsWith('confirm_payment_')) {
        const orderId = data.replace('confirm_payment_', '');
        
        // Меняем статус в БД на processing
        await supabase
          .from('orders')
          .update({ status: 'processing' })
          .eq('id', orderId);

        // Получаем данные заказа
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (order && order.telegram_user_id) {
          // Уведомляем клиента
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: order.telegram_user_id,
            text: `✅ <b>Оплата подтверждена!</b>\n\n📋 Заказ #${orderId.slice(-6)}\n\nМы приняли ваш заказ в работу! 👨‍🍳`,
            parse_mode: 'HTML'
          });
        }

        // Отвечаем админу
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          callback_query_id: callbackQuery.id,
          text: '✅ Оплата подтверждена!'
        });

        // Редактируем сообщение админу
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
          chat_id: ADMIN_ID,
          message_id: messageId,
          caption: callbackQuery.message.caption + '\n\n✅ <b>ОПЛАТА ПОДТВЕРЖДЕНА</b>',
          parse_mode: 'HTML'
        });
      }

      // Админ отклоняет оплату
      if (data.startsWith('reject_payment_')) {
        const orderId = data.replace('reject_payment_', '');
        
        // Получаем данные заказа
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (order && order.telegram_user_id) {
          // Уведомляем клиента
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: order.telegram_user_id,
            text: `❌ <b>Чек не принят</b>\n\n📋 Заказ #${orderId.slice(-6)}\n\nПожалуйста, отправьте корректный чек или свяжитесь с нами.`,
            parse_mode: 'HTML'
          });
        }

        // Отвечаем админу
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          callback_query_id: callbackQuery.id,
          text: '❌ Чек отклонён'
        });

        // Редактируем сообщение
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
          chat_id: ADMIN_ID,
          message_id: messageId,
          caption: callbackQuery.message.caption + '\n\n❌ <b>ЧЕК ОТКЛОНЁН</b>',
          parse_mode: 'HTML'
        });
      }
    }

    // Обработка фото (чека)
    if (update.message && update.message.photo) {
      const chatId = update.message.chat.id;
      const photo = update.message.photo[update.message.photo.length - 1]; // Берём самое большое фото
      
      // Проверяем, ждём ли мы фото от этого пользователя
      const orderId = pendingReceipts.get(`waiting_${chatId}`);
      
      if (orderId) {
        const orderInfo = pendingReceipts.get(orderId);
        
        if (orderInfo) {
          // Отправляем чек админу
          let caption = "📸 <b>ЧЕК ОБ ОПЛАТЕ</b>\n\n";
          caption += `📋 Заказ #${orderInfo.orderNumber}\n`;
          caption += `👤 ${orderInfo.customerName}\n`;
          caption += `💰 ${orderInfo.total} ₸\n`;
          caption += `ID: ${orderInfo.userId}`;

          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            chat_id: ADMIN_ID,
            photo: photo.file_id,
            caption: caption,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ Подтвердить", callback_data: `confirm_payment_${orderId}` },
                { text: "❌ Отклонить", callback_data: `reject_payment_${orderId}` }
              ]]
            }
          });

          // Подтверждаем клиенту
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: "✅ <b>Чек получен!</b>\n\nМы проверим оплату и скоро свяжемся с вами.\n\n🇰🇿 <b>Чек алынды!</b>\nТөлемді тексеріп, жақында сізбен хабарласамыз.",
            parse_mode: 'HTML'
          });

          // Удаляем из ожидания
          pendingReceipts.delete(`waiting_${chatId}`);
        }
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Ошибка обработки webhook:', error);
    res.json({ ok: true }); // Всё равно отвечаем ok, чтобы Telegram не спамил
  }
}

// API: Настройка webhook
app.post('/api/setup-webhook', async (req, res) => {
  try {
    const webhookUrl = `${req.protocol}://${req.get('host')}/bot${BOT_TOKEN}`;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      { url: webhookUrl }
    );

    res.json({ 
      success: true, 
      webhookUrl,
      telegram: response.data 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Ошибка настройки webhook',
      details: error.message 
    });
  }
});

// API: Получить публичный ключ Supabase
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY
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

// Функция для автоматической установки webhook
async function setupWebhookOnStartup() {
  try {
    // Получаем текущий URL где запущен сервер
    const webhookUrl = `https://telegram-miniapp-fd6b.onrender.com/webhook`;
    
    // Проверяем текущий webhook
    const checkResponse = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    
    const currentWebhook = checkResponse.data.result.url;
    
    // Если webhook уже установлен правильно - ничего не делаем
    if (currentWebhook === webhookUrl) {
      console.log(`✅ Webhook уже установлен: ${webhookUrl}`);
      return;
    }
    
    // Устанавливаем webhook
    console.log(`🔄 Установка webhook: ${webhookUrl}...`);
    const setResponse = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      { url: webhookUrl }
    );
    
    if (setResponse.data.ok) {
      console.log(`✅ Webhook успешно установлен!`);
    } else {
      console.error(`❌ Ошибка установки webhook:`, setResponse.data);
    }
  } catch (error) {
    console.error(`❌ Ошибка при установке webhook:`, error.message);
  }
}

// Запуск сервера
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Telegram Bot: ${BOT_TOKEN ? '✅ Настроен' : '❌ Не настроен'}`);
  console.log(`🗄️  Supabase: ${SUPABASE_URL ? '✅ Настроен' : '❌ Не настроен'}`);
  console.log(`\n🔗 Webhook endpoints:`);
  console.log(`   POST /webhook (рекомендуется)`);
  console.log(`   POST /bot${BOT_TOKEN}`);
  
  // Автоматически устанавливаем webhook
  if (BOT_TOKEN) {
    console.log('');
    await setupWebhookOnStartup();
  }
  
  console.log('');
});
