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
const ADMIN_ID = parseInt(process.env.ADMIN_ID); // Преобразуем в число!
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// URL Mini App
const CLIENT_APP_URL = "https://telegram-miniapp-fd6b.onrender.com";
const ADMIN_APP_URL = "https://telegram-miniapp-fd6b.onrender.com/admin.html";

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

    // Обработка текстовых команд и сообщений
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text;
      const userId = message.from.id;

      // Обработка текстовых команд (только если есть text)
      if (text) {
        // Команда /start
        if (text === '/start') {
        const firstName = message.from.first_name || 'друг';
        const keyboard = {
          keyboard: [
            [{ text: '📦 Кондитерская', web_app: { url: CLIENT_APP_URL } }]
          ],
          resize_keyboard: true
        };

        // Если админ - добавляем админские кнопки
        if (userId === ADMIN_ID) {
          keyboard.keyboard.push([{ text: '⚙️ Админ-панель', web_app: { url: ADMIN_APP_URL } }]);
          keyboard.keyboard.push([{ text: '📢 Рассылка' }]);
        }

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `Привет, ${firstName}! 👋\n\nДобро пожаловать в нашу кондитерскую! 🎂\n\nНажми на кнопку ниже, чтобы посмотреть наши вкусности:`,
          reply_markup: keyboard
        });
        
        return res.json({ ok: true });
      }

      // Команда /help
      if (text === '/help') {
        let helpText = `🤖 <b>Команды бота:</b>\n\n/start - Главное меню\n/help - Помощь\n/contact - Контакты\n\n`;
        
        if (userId === ADMIN_ID) {
          helpText += `<b>Команды администратора:</b>\n/broadcast [текст] - Рассылка всем клиентам\n/stats - Статистика заказов\n/detailed_stats - Подробная статистика\n/customers - База клиентов\n\n`;
        }
        
        helpText += `Для заказа нажмите на кнопку '📦 Кондитерская'`;

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: helpText,
          parse_mode: 'HTML'
        });
        
        return res.json({ ok: true });
      }

      // Команда /contact
      if (text === '/contact') {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `📞 <b>Наши контакты:</b>\n\nТелефон: +7 (777) 888-88-88\nEmail: info@bakery.kz\nАдрес: г. Астана, ул. Астана 8\n\nГрафик работы:\nПн-Вс: 09:00 - 21:00`,
          parse_mode: 'HTML'
        });
        
        return res.json({ ok: true });
      }

      // Команда /stats (только для админа)
      if (text === '/stats' && userId === ADMIN_ID) {
        try {
          const { data: orders } = await supabase
            .from('orders')
            .select('*');

          const total = orders.length;
          const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
          const uniqueClients = new Set(orders.map(o => o.telegram_user_id).filter(Boolean)).size;
          
          const newOrders = orders.filter(o => o.status === 'new').length;
          const processing = orders.filter(o => o.status === 'processing').length;
          const completed = orders.filter(o => o.status === 'completed').length;
          
          const avgCheck = total > 0 ? Math.floor(revenue / total) : 0;

          const statsText = `📊 <b>Статистика магазина</b>\n\n📦 Всего заказов: ${total}\n💰 Общая выручка: ${revenue.toLocaleString()} ₸\n👥 Уникальных клиентов: ${uniqueClients}\n\n<b>По статусам:</b>\n🆕 Новые: ${newOrders}\n⏳ В работе: ${processing}\n✅ Выполнено: ${completed}\n\n💵 Средний чек: ${avgCheck.toLocaleString()} ₸\n\n<i>Для подробной статистики: /detailed_stats</i>`;

          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: statsText,
            parse_mode: 'HTML'
          });
        } catch (error) {
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `❌ Ошибка получения статистики: ${error.message}`
          });
        }
        
        return res.json({ ok: true });
      }

      // Команда /detailed_stats (только для админа) - ПОДРОБНАЯ СТАТИСТИКА
      if (text === '/detailed_stats' && userId === ADMIN_ID) {
        try {
          const { data: orders } = await supabase
            .from('orders')
            .select('*');

          const { data: products } = await supabase
            .from('products')
            .select('*');

          // === БАЗОВЫЕ МЕТРИКИ ===
          const total = orders.length;
          const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
          const completedOrders = orders.filter(o => o.status === 'completed');
          const completedRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
          
          // === СТАТИСТИКА ПО ПЕРИОДАМ ===
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          
          const ordersToday = orders.filter(o => new Date(o.date) >= today).length;
          const ordersWeek = orders.filter(o => new Date(o.date) >= weekAgo).length;
          const ordersMonth = orders.filter(o => new Date(o.date) >= monthAgo).length;
          
          const revenueToday = orders.filter(o => new Date(o.date) >= today).reduce((sum, o) => sum + (o.total || 0), 0);
          const revenueWeek = orders.filter(o => new Date(o.date) >= weekAgo).reduce((sum, o) => sum + (o.total || 0), 0);
          const revenueMonth = orders.filter(o => new Date(o.date) >= monthAgo).reduce((sum, o) => sum + (o.total || 0), 0);
          
          // === ПОПУЛЯРНЫЕ ТОВАРЫ ===
          const productSales = {};
          orders.forEach(order => {
            if (order.items && Array.isArray(order.items)) {
              order.items.forEach(item => {
                const name = item.name || 'Неизвестный товар';
                if (!productSales[name]) {
                  productSales[name] = { count: 0, revenue: 0 };
                }
                productSales[name].count += item.quantity || 1;
                productSales[name].revenue += (item.price || 0) * (item.quantity || 1);
              });
            }
          });
          
          const topProducts = Object.entries(productSales)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5);
          
          const topProductsText = topProducts.map((item, idx) => 
            `${idx + 1}. ${item[0]} - ${item[1].count} шт. (${item[1].revenue.toLocaleString()}₸)`
          ).join('\n') || 'Нет данных';
          
          // === КОНВЕРСИЯ ===
          const pendingPayment = orders.filter(o => o.status === 'pending_payment').length;
          const cancelled = orders.filter(o => o.status === 'cancelled').length;
          const conversionRate = total > 0 ? Math.round((completedOrders.length / total) * 100) : 0;
          
          // === КЛИЕНТЫ ===
          const uniqueClients = new Set(orders.map(o => o.telegram_user_id).filter(Boolean)).size;
          const repeatClients = orders.reduce((acc, order) => {
            const userId = order.telegram_user_id;
            if (userId) {
              acc[userId] = (acc[userId] || 0) + 1;
            }
            return acc;
          }, {});
          const repeatClientsCount = Object.values(repeatClients).filter(count => count > 1).length;
          const repeatRate = uniqueClients > 0 ? Math.round((repeatClientsCount / uniqueClients) * 100) : 0;

          const detailedStatsText = `📊 <b>ДЕТАЛЬНАЯ СТАТИСТИКА</b>\n\n` +
            `📈 <b>ВЫРУЧКА:</b>\n` +
            `💰 Всего: ${revenue.toLocaleString()} ₸\n` +
            `✅ Завершено: ${completedRevenue.toLocaleString()} ₸\n` +
            `📅 Сегодня: ${revenueToday.toLocaleString()} ₸\n` +
            `📅 За неделю: ${revenueWeek.toLocaleString()} ₸\n` +
            `📅 За месяц: ${revenueMonth.toLocaleString()} ₸\n\n` +
            `📦 <b>ЗАКАЗЫ:</b>\n` +
            `📊 Всего: ${total}\n` +
            `📅 Сегодня: ${ordersToday}\n` +
            `📅 За неделю: ${ordersWeek}\n` +
            `📅 За месяц: ${ordersMonth}\n` +
            `💵 Средний чек: ${Math.round(revenue / total || 0).toLocaleString()} ₸\n\n` +
            `🎯 <b>КОНВЕРСИЯ:</b>\n` +
            `✅ Выполнено: ${completedOrders.length} (${conversionRate}%)\n` +
            `⏳ Ожидают оплаты: ${pendingPayment}\n` +
            `❌ Отменено: ${cancelled}\n\n` +
            `👥 <b>КЛИЕНТЫ:</b>\n` +
            `👤 Уникальных: ${uniqueClients}\n` +
            `🔄 Повторных: ${repeatClientsCount} (${repeatRate}%)\n` +
            `📊 Заказов на клиента: ${(total / uniqueClients || 0).toFixed(1)}\n\n` +
            `🏆 <b>ТОП-5 ТОВАРОВ:</b>\n${topProductsText}\n\n` +
            `📦 <b>ТОВАРЫ В КАТАЛОГЕ:</b>\n` +
            `Всего: ${products?.length || 0}\n` +
            `Доступно: ${products?.filter(p => p.available).length || 0}`;

          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: detailedStatsText,
            parse_mode: 'HTML'
          });
        } catch (error) {
          console.error('Ошибка получения детальной статистики:', error);
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `❌ Ошибка получения статистики: ${error.message}`
          });
        }
        
        return res.json({ ok: true });
      }

      // Команда /customers (только для админа) - БАЗА КЛИЕНТОВ
      if (text === '/customers' && userId === ADMIN_ID) {
        try {
          const { data: customers } = await supabase
            .from('customers')
            .select('*')
            .order('total_spent', { ascending: false })
            .limit(20);

          if (!customers || customers.length === 0) {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              chat_id: chatId,
              text: '📊 База клиентов пуста.\n\nКлиенты появятся после первого заказа через Mini App.',
              parse_mode: 'HTML'
            });
            return res.json({ ok: true });
          }

          let customersText = `👥 <b>БАЗА КЛИЕНТОВ</b>\n\nТоп-${customers.length} по сумме покупок:\n\n`;

          customers.forEach((customer, index) => {
            const name = customer.telegram_first_name || 'Аноним';
            const username = customer.telegram_username ? `@${customer.telegram_username}` : '';
            const phone = customer.phone || 'Нет номера';
            const orders = customer.total_orders || 0;
            const spent = customer.total_spent || 0;
            const lastOrder = customer.last_order_date 
              ? new Date(customer.last_order_date).toLocaleDateString('ru-RU')
              : 'Неизвестно';

            customersText += `${index + 1}. <b>${name}</b> ${username}\n`;
            customersText += `   📱 ${phone}\n`;
            customersText += `   📦 Заказов: ${orders} | 💰 ${spent.toLocaleString()}₸\n`;
            customersText += `   📅 Последний: ${lastOrder}\n\n`;
          });

          const { data: allCustomers } = await supabase
            .from('customers')
            .select('id', { count: 'exact', head: true });

          customersText += `<i>Всего клиентов в базе: ${customers.length}</i>`;

          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: customersText,
            parse_mode: 'HTML'
          });
        } catch (error) {
          console.error('Ошибка получения клиентов:', error);
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `❌ Ошибка получения базы клиентов: ${error.message}`
          });
        }
        
        return res.json({ ok: true });
      }

      // Команда /broadcast (только для админа)
      if (text.startsWith('/broadcast') && userId === ADMIN_ID) {
        const broadcastText = text.replace('/broadcast', '').trim();
        
        if (!broadcastText) {
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `📢 <b>Как сделать рассылку:</b>\n\nИспользуйте команду:\n<code>/broadcast Ваше сообщение</code>\n\nПример:\n<code>/broadcast 🎉 Скидка 20% на все торты до конца недели!</code>\n\nИли просто нажмите кнопку '📢 Рассылка' и следуйте инструкциям.`,
            parse_mode: 'HTML'
          });
          
          return res.json({ ok: true });
        }

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `📤 Начинаю рассылку...`
        });

        try {
          const { data: orders } = await supabase
            .from('orders')
            .select('telegram_user_id');

          if (!orders || orders.length === 0) {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              chat_id: chatId,
              text: `❌ Нет клиентов для рассылки`
            });
            return res.json({ ok: true });
          }

          const userIds = [...new Set(orders.map(o => o.telegram_user_id).filter(Boolean))];
          let success = 0;
          let failed = 0;

          for (const targetId of userIds) {
            try {
              await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: targetId,
                text: broadcastText,
                parse_mode: 'HTML'
              });
              success++;
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (err) {
              failed++;
            }
          }

          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `✅ <b>Рассылка завершена!</b>\n\n👥 Всего клиентов: ${userIds.length}\n✅ Успешно отправлено: ${success}\n❌ Ошибок: ${failed}`,
            parse_mode: 'HTML'
          });
        } catch (error) {
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `❌ Ошибка рассылки: ${error.message}`
          });
        }

        return res.json({ ok: true });
      }

      // Кнопка "📢 Рассылка" (только для админа)
      if (text === '📢 Рассылка' && userId === ADMIN_ID) {
        pendingReceipts.set(`waiting_broadcast_${chatId}`, true);
        
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `📝 <b>Создание рассылки</b>\n\nОтправьте текст для рассылки всем клиентам.\nПоддерживается форматирование HTML.\n\nЧтобы отменить - напишите /cancel`,
          parse_mode: 'HTML'
        });
        
        return res.json({ ok: true });
      }

      // Команда /cancel
      if (text === '/cancel') {
        pendingReceipts.delete(`waiting_broadcast_${chatId}`);
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `✅ Действие отменено`
        });
        
        return res.json({ ok: true });
      }

      // Если ждём текст для рассылки
      if (pendingReceipts.has(`waiting_broadcast_${chatId}`) && userId === ADMIN_ID) {
        pendingReceipts.delete(`waiting_broadcast_${chatId}`);

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `📤 Начинаю рассылку...`
        });

        try {
          const { data: orders } = await supabase
            .from('orders')
            .select('telegram_user_id');

          const userIds = [...new Set(orders.map(o => o.telegram_user_id).filter(Boolean))];
          let success = 0;
          let failed = 0;

          for (const targetId of userIds) {
            try {
              await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: targetId,
                text: text,
                parse_mode: 'HTML'
              });
              success++;
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (err) {
              failed++;
            }
          }

          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `✅ <b>Рассылка завершена!</b>\n\n👥 Всего клиентов: ${userIds.length}\n✅ Успешно отправлено: ${success}\n❌ Ошибок: ${failed}`,
            parse_mode: 'HTML'
          });
        } catch (error) {
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `❌ Ошибка рассылки: ${error.message}`
          });
        }

        return res.json({ ok: true });
      }

      // Обычный ответ на текст
      if (!text.startsWith('/')) {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `Я бот-помощник кондитерской! 🤖\nНажмите '📦 Кондитерская' чтобы сделать заказ.`
        });
        
        return res.json({ ok: true });
      }
      } // Конец блока if (text)

      // Обработка фото (чек от клиента)
      if (message.photo && pendingReceipts.has(`waiting_${chatId}`)) {
        const orderId = pendingReceipts.get(`waiting_${chatId}`);
        pendingReceipts.delete(`waiting_${chatId}`);

        const photo = message.photo[message.photo.length - 1];
        const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${(await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${photo.file_id}`)).data.result.file_path}`;

        // Получаем полную информацию о заказе
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        // Обновляем заказ
        await supabase
          .from('orders')
          .update({ 
            receipt_photo: photoUrl,
            status: 'pending_payment'
          })
          .eq('id', orderId);

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `✅ <b>Чек получен!</b>\n\nМы проверим оплату и скоро свяжемся с вами.\n\n🇰🇿 <b>Чек алынды!</b>\n\nТөлемді тексереміз және жақында хабарласамыз.`,
          parse_mode: 'HTML'
        });

        // Формируем детальную информацию о заказе для админа
        let itemsList = '';
        if (order && order.items && Array.isArray(order.items)) {
          itemsList = order.items.map(item => 
            `  • ${item.name} x${item.quantity} - ${(item.price * item.quantity).toLocaleString()}₸`
          ).join('\n');
        }

        const receiptCaption = `📸 <b>ЧЕК ОПЛАТЫ</b>\n\n` +
          `📋 Заказ #${orderId.slice(-6)}\n` +
          `👤 Клиент: ${order?.customer_name || 'Не указано'}\n` +
          `📱 Телефон: ${order?.customer_phone || 'Не указано'}\n` +
          `💰 Сумма: ${order?.total?.toLocaleString() || 0}₸\n\n` +
          `📦 <b>Состав заказа:</b>\n${itemsList || 'Нет товаров'}\n\n` +
          `💬 Комментарий: ${order?.customer_comment || 'Нет'}\n\n` +
          `⏰ Дата: ${order?.date ? new Date(order.date).toLocaleString('ru-RU') : 'Неизвестно'}`;

        // Уведомляем админа с полной информацией
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          chat_id: ADMIN_ID,
          photo: photo.file_id,
          caption: receiptCaption,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Подтвердить оплату', callback_data: `confirm_payment_${orderId}` },
              { text: '❌ Отклонить оплату', callback_data: `reject_payment_${orderId}` }
            ]]
          }
        });

        return res.json({ ok: true });
      }
    }

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
          // ВАЖНО: Восстанавливаем флаг ожидания чека
          pendingReceipts.set(`waiting_${order.telegram_user_id}`, orderId);
          
          // Уведомляем клиента с кнопкой для повторной отправки
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: order.telegram_user_id,
            text: `❌ <b>Чек не принят</b>\n\n📋 Заказ #${orderId.slice(-6)}\n\nПожалуйста, отправьте корректный чек или свяжитесь с нами.\n\n🇰🇿 <b>Чек қабылданбады</b>\n\nДұрыс чекті жіберіңіз немесе бізбен хабарласыңыз.`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '📸 Отправить чек заново', callback_data: `receipt_${orderId}` }
              ]]
            }
          });
        }

        // Отвечаем админу
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          callback_query_id: callbackQuery.id,
          text: '❌ Чек отклонён. Клиент может отправить новый.'
        });

        // Редактируем сообщение
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
          chat_id: ADMIN_ID,
          message_id: messageId,
          caption: callbackQuery.message.caption + '\n\n❌ <b>ЧЕК ОТКЛОНЁН</b>\n(Клиент может отправить новый)',
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
