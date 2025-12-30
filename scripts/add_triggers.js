import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run(sql) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ sql_query: sql })
  });
  return await r.text();
}

console.log('Створення тригерів для автооновлення статистики...\n');

const triggersSQL = `
-- Функція для оновлення статистики при зміні каналів
CREATE OR REPLACE FUNCTION update_bot_stats_on_channel_change()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_id UUID;
  v_user_id UUID;
  v_user_channels_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'bot_services' THEN
    v_bot_id := COALESCE(NEW.bot_id, OLD.bot_id);
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'ai_bot_services' THEN
    v_bot_id := COALESCE(NEW.bot_id, OLD.bot_id);
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Ініціалізувати якщо не існує
  INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
  VALUES (v_bot_id, 0, 0, 0)
  ON CONFLICT (bot_id) DO NOTHING;

  IF TG_OP = 'INSERT' THEN
    -- Перевірити чи це перший канал користувача
    IF TG_TABLE_NAME = 'bot_services' THEN
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.bot_services WHERE user_id = v_user_id AND bot_id = v_bot_id;
    ELSE
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.ai_bot_services WHERE user_id = v_user_id AND bot_id = v_bot_id;
    END IF;

    UPDATE public.bot_global_stats
    SET 
      total_channels = total_channels + 1,
      total_users = CASE WHEN v_user_channels_count = 1 THEN total_users + 1 ELSE total_users END
    WHERE bot_id = v_bot_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Перевірити чи залишились канали користувача
    IF TG_TABLE_NAME = 'bot_services' THEN
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.bot_services WHERE user_id = v_user_id AND bot_id = v_bot_id AND id != OLD.id;
    ELSE
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.ai_bot_services WHERE user_id = v_user_id AND bot_id = v_bot_id AND id != OLD.id;
    END IF;

    UPDATE public.bot_global_stats
    SET 
      total_channels = GREATEST(0, total_channels - 1),
      total_users = CASE WHEN v_user_channels_count = 0 THEN GREATEST(0, total_users - 1) ELSE total_users END
    WHERE bot_id = v_bot_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригери для bot_services
DROP TRIGGER IF EXISTS trigger_bot_stats_on_bot_service_insert ON public.bot_services;
CREATE TRIGGER trigger_bot_stats_on_bot_service_insert
  AFTER INSERT ON public.bot_services
  FOR EACH ROW EXECUTE FUNCTION update_bot_stats_on_channel_change();

DROP TRIGGER IF EXISTS trigger_bot_stats_on_bot_service_delete ON public.bot_services;
CREATE TRIGGER trigger_bot_stats_on_bot_service_delete
  AFTER DELETE ON public.bot_services
  FOR EACH ROW EXECUTE FUNCTION update_bot_stats_on_channel_change();

-- Тригери для ai_bot_services
DROP TRIGGER IF EXISTS trigger_bot_stats_on_ai_bot_service_insert ON public.ai_bot_services;
CREATE TRIGGER trigger_bot_stats_on_ai_bot_service_insert
  AFTER INSERT ON public.ai_bot_services
  FOR EACH ROW EXECUTE FUNCTION update_bot_stats_on_channel_change();

DROP TRIGGER IF EXISTS trigger_bot_stats_on_ai_bot_service_delete ON public.ai_bot_services;
CREATE TRIGGER trigger_bot_stats_on_ai_bot_service_delete
  AFTER DELETE ON public.ai_bot_services
  FOR EACH ROW EXECUTE FUNCTION update_bot_stats_on_channel_change();
`;

const result = await run(triggersSQL);
console.log('Результат:', result);

console.log('\n✅ Тригери створено!');
console.log('Тепер статистика оновлюється автоматично при:');
console.log('  - Додаванні каналу → +1 канал, +1 користувач (якщо перший)');
console.log('  - Видаленні каналу → -1 канал, -1 користувач (якщо останній)');
