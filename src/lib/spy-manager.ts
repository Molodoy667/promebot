/**
 * Централізований менеджер для роботи з юзерботами (spies)
 * Уникаємо дублікатів коду підключення юзербота до каналів
 */

import { supabase } from "@/integrations/supabase/client";

export interface SpyJoinResult {
  success: boolean;
  spyId?: string;
  error?: string;
}

/**
 * Отримує активного авторизованого юзербота
 */
export async function getActiveSpy() {
  const { data: activeSpy, error } = await supabase
    .from('telegram_spies')
    .select('id, session_string, api_id, api_hash, is_authorized')
    .eq('is_active', true)
    .eq('is_authorized', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Spy Manager] Error getting active spy:', error);
    return null;
  }

  return activeSpy;
}

/**
 * Підключає юзербота до каналу для збору статистики
 * @param channelIdentifier - @username, посилання або chat_id каналу
 * @param spyId - ID юзербота (якщо не вказано, береться активний)
 * @returns Promise з результатом підключення
 */
export async function joinSpyToChannel(
  channelIdentifier: string,
  spyId?: string
): Promise<SpyJoinResult> {
  try {
    // Якщо spyId не вказано, отримуємо активного
    let finalSpyId = spyId;
    
    if (!finalSpyId) {
      const activeSpy = await getActiveSpy();
      if (!activeSpy) {
        console.log('[Spy Manager] No active spy available');
        return { success: false, error: 'No active spy available' };
      }
      finalSpyId = activeSpy.id;
    }

    console.log('[Spy Manager] Joining spy to channel:', channelIdentifier);

    // Викликаємо Edge Function
    const { data, error } = await supabase.functions.invoke('spy-join-channel', {
      body: {
        spy_id: finalSpyId,
        channel_identifier: channelIdentifier
      }
    });

    if (error) {
      console.warn('[Spy Manager] Join warning:', error.message);
      return { success: false, spyId: finalSpyId, error: error.message };
    }

    console.log('[Spy Manager] Successfully joined channel');
    return { success: true, spyId: finalSpyId };

  } catch (err: any) {
    console.error('[Spy Manager] Non-critical error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Підключає юзербота при створенні bot_service
 */
export async function attachSpyToBotService(
  targetChannel: string,
  spyId?: string
): Promise<string | null> {
  const spy = spyId ? { id: spyId } : await getActiveSpy();
  
  if (!spy) {
    console.log('[Spy Manager] No spy available for bot service');
    return null;
  }

  console.log('[Spy Manager] Attaching spy to bot service:', spy.id);
  
  // Пробуємо підключити до цільового каналу
  const result = await joinSpyToChannel(targetChannel, spy.id);
  
  if (result.success) {
    console.log('[Spy Manager] Spy attached and joined target channel');
  } else {
    console.log('[Spy Manager] Spy attached but join failed (will collect available stats)');
  }
  
  return spy.id;
}

/**
 * Підключає юзербота при додаванні source_channel
 */
export async function attachSpyToSourceChannel(
  channelIdentifier: string,
  spyId?: string
): Promise<string | null> {
  const spy = spyId ? { id: spyId } : await getActiveSpy();
  
  if (!spy) {
    console.log('[Spy Manager] No spy available for source channel');
    return null;
  }

  console.log('[Spy Manager] Attaching spy to source channel:', spy.id);
  
  // Пробуємо підключити до джерела
  const result = await joinSpyToChannel(channelIdentifier, spy.id);
  
  if (result.success) {
    console.log('[Spy Manager] Spy joined source channel successfully');
  } else {
    console.log('[Spy Manager] Spy join failed (will retry on next sync)');
  }
  
  return spy.id;
}

/**
 * Відключає юзербота від каналу (покидає канал)
 * @param channelIdentifier - @username, посилання або chat_id каналу
 * @param spyId - ID юзербота
 * @returns Promise з результатом відключення
 */
export async function leaveSpyFromChannel(
  channelIdentifier: string,
  spyId: string
): Promise<SpyJoinResult> {
  try {
    if (!spyId) {
      return { success: false, error: 'spy_id is required' };
    }

    console.log('[Spy Manager] Leaving spy from channel:', channelIdentifier);

    // Викликаємо Edge Function
    const { data, error } = await supabase.functions.invoke('spy-leave-channel', {
      body: {
        spy_id: spyId,
        channel_identifier: channelIdentifier
      }
    });

    if (error) {
      console.warn('[Spy Manager] Leave warning:', error.message);
      return { success: false, spyId, error: error.message };
    }

    if (!data?.success) {
      return { success: false, spyId, error: data?.error || 'Failed to leave channel' };
    }

    console.log('[Spy Manager] Successfully left channel');
    return { success: true, spyId };

  } catch (err: any) {
    console.error('[Spy Manager] Error leaving channel:', err.message);
    return { success: false, error: err.message };
  }
}
