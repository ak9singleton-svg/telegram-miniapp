from telegram import Update, WebAppInfo, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import json
import asyncio
from supabase import create_client, Client

# НАСТРОЙКИ
BOT_TOKEN = "8210216557:AAFeNn2-EW1nnbL-Ahyk3f1dpq3JjrlniCI"
CLIENT_APP_URL = "https://telegram-miniapp-fd6b.onrender.com"
ADMIN_APP_URL = "https://telegram-miniapp-fd6b.onrender.com/admin.html"
ADMIN_ID = 8086901919

# Supabase
SUPABASE_URL = "https://gtinslbrwdpqkxeibuqs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0aW5zbGJyd2RwcWt4ZWlidXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjM1MjMsImV4cCI6MjA3NjY5OTUyM30.3LbYP6AcsQ-qVZtdMgH6pJYX0rWLFGSUmT6errUwJOY"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start - показывает меню"""
    user = update.effective_user
    
    # Создаём кнопки с Web App
    keyboard = [
        [KeyboardButton("🛍 Открыть магазин", web_app=WebAppInfo(url=CLIENT_APP_URL))],
    ]
    
    # Если это админ, добавляем кнопки админки
    if user.id == ADMIN_ID:
        keyboard.append([KeyboardButton("⚙️ Админ-панель", web_app=WebAppInfo(url=ADMIN_APP_URL))])
        keyboard.append([KeyboardButton("📢 Рассылка")])
    
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    
    await update.message.reply_text(
        f"Привет, {user.first_name}! 👋\n\n"
        "Добро пожаловать в нашу кондитерскую! 🎂\n\n"
        "Нажми на кнопку ниже, чтобы посмотреть наши вкусности:",
        reply_markup=reply_markup
    )


async def broadcast_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /broadcast - запуск рассылки (только для админа)"""
    if update.effective_user.id != ADMIN_ID:
        await update.message.reply_text("⛔ У вас нет прав для этой команды")
        return
    
    # Проверяем есть ли текст для рассылки
    if not context.args:
        await update.message.reply_text(
            "📢 <b>Как сделать рассылку:</b>\n\n"
            "Используйте команду:\n"
            "<code>/broadcast Ваше сообщение</code>\n\n"
            "Пример:\n"
            "<code>/broadcast 🎉 Скидка 20% на все торты до конца недели!</code>\n\n"
            "Или просто нажмите кнопку '📢 Рассылка' и следуйте инструкциям.",
            parse_mode='HTML'
        )
        return
    
    message_text = ' '.join(context.args)
    await send_broadcast(update, context, message_text)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка текстовых сообщений"""
    user = update.effective_user
    text = update.message.text
    
    # Если админ нажал кнопку "Рассылка"
    if text == "📢 Рассылка" and user.id == ADMIN_ID:
        context.user_data['waiting_for_broadcast'] = True
        await update.message.reply_text(
            "📝 <b>Создание рассылки</b>\n\n"
            "Отправьте текст для рассылки всем клиентам.\n"
            "Поддерживается форматирование HTML.\n\n"
            "Чтобы отменить - напишите /cancel",
            parse_mode='HTML'
        )
        return
    
    # Если ждём текст для рассылки
    if context.user_data.get('waiting_for_broadcast') and user.id == ADMIN_ID:
        context.user_data['waiting_for_broadcast'] = False
        await send_broadcast(update, context, text)
        return
    
    # Обычный ответ
    await update.message.reply_text(
        "Я бот-помощник кондитерской! 🤖\n"
        "Нажмите '🛍 Открыть магазин' чтобы сделать заказ."
    )


async def send_broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE, message_text: str):
    """Отправка рассылки всем клиентам"""
    await update.message.reply_text("📤 Начинаю рассылку...")
    
    try:
        # Получаем всех уникальных клиентов из заказов
        response = supabase.table('orders').select('telegram_user_id').execute()
        
        if not response.data:
            await update.message.reply_text("❌ Нет клиентов для рассылки")
            return
        
        # Получаем уникальные ID клиентов
        user_ids = list(set([order['telegram_user_id'] for order in response.data if order.get('telegram_user_id')]))
        
        total = len(user_ids)
        success = 0
        failed = 0
        
        # Отправляем сообщения
        for user_id in user_ids:
            try:
                await context.bot.send_message(
                    chat_id=user_id,
                    text=message_text,
                    parse_mode='HTML'
                )
                success += 1
                # Пауза, чтобы не нарваться на лимиты Telegram
                await asyncio.sleep(0.05)  # 50мс между сообщениями
            except Exception as e:
                print(f"Ошибка отправки пользователю {user_id}: {e}")
                failed += 1
        
        # Отчёт админу
        await update.message.reply_text(
            f"✅ <b>Рассылка завершена!</b>\n\n"
            f"👥 Всего клиентов: {total}\n"
            f"✅ Успешно отправлено: {success}\n"
            f"❌ Ошибок: {failed}",
            parse_mode='HTML'
        )
        
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка рассылки: {str(e)}")


async def cancel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отмена текущего действия"""
    context.user_data.clear()
    await update.message.reply_text("✅ Действие отменено")


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Статистика (только для админа)"""
    if update.effective_user.id != ADMIN_ID:
        return
    
    try:
        # Получаем статистику
        orders_response = supabase.table('orders').select('*').execute()
        orders = orders_response.data or []
        
        total_orders = len(orders)
        total_revenue = sum([order.get('total', 0) for order in orders])
        unique_clients = len(set([order['telegram_user_id'] for order in orders if order.get('telegram_user_id')]))
        
        # Статусы заказов
        new_orders = len([o for o in orders if o.get('status') == 'new'])
        processing = len([o for o in orders if o.get('status') == 'processing'])
        completed = len([o for o in orders if o.get('status') == 'completed'])
        
        message = (
            f"📊 <b>Статистика магазина</b>\n\n"
            f"📦 Всего заказов: {total_orders}\n"
            f"💰 Общая выручка: {total_revenue:,} ₸\n"
            f"👥 Уникальных клиентов: {unique_clients}\n\n"
            f"<b>По статусам:</b>\n"
            f"🆕 Новые: {new_orders}\n"
            f"⏳ В работе: {processing}\n"
            f"✅ Выполнено: {completed}\n\n"
            f"💵 Средний чек: {total_revenue // total_orders if total_orders > 0 else 0:,} ₸"
        )
        
        await update.message.reply_text(message, parse_mode='HTML')
        
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка получения статистики: {str(e)}")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /help"""
    message = (
        "🤖 <b>Команды бота:</b>\n\n"
        "/start - Главное меню\n"
        "/help - Помощь\n"
        "/contact - Контакты\n\n"
    )
    
    # Админские команды
    if update.effective_user.id == ADMIN_ID:
        message += (
            "<b>Команды администратора:</b>\n"
            "/broadcast [текст] - Рассылка всем клиентам\n"
            "/stats - Статистика заказов\n"
            "/cancel - Отменить текущее действие\n\n"
        )
    
    message += "Для заказа нажмите на кнопку '🛍 Открыть магазин'"
    
    await update.message.reply_text(message, parse_mode='HTML')


async def contact_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /contact - контактная информация"""
    await update.message.reply_text(
        "📞 <b>Наши контакты:</b>\n\n"
        "Телефон: +7 (777) 888-88-88\n"
        "Email: info@bakery.kz\n"
        "Адрес: г. Астана, ул. Астана 8\n\n"
        "График работы:\n"
        "Пн-Вс: 09:00 - 21:00",
        parse_mode='HTML'
    )


def main():
    """Запуск бота"""
    print("🤖 Запуск бота с функцией рассылки...")
    
    # Создаём приложение
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Регистрируем обработчики
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("contact", contact_command))
    application.add_handler(CommandHandler("broadcast", broadcast_command))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(CommandHandler("cancel", cancel_command))
    
    # Обработчик текстовых сообщений (должен быть в конце!)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    # Запускаем бота
    print("✅ Бот запущен и готов к работе!")
    print("📢 Доступна функция рассылки для администратора")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
