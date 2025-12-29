import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    // Validate cron secret to prevent unauthorized access
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    // Якщо секрет налаштований в змінних середовища — перевіряємо його.
    // Якщо ні — не блокуємо виконання, щоб cron міг працювати без додаткової конфігурації.
    if (expectedSecret && cronSecret !== expectedSecret) {
      console.error('Unauthorized access attempt to expire-subscriptions');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all active subscriptions that have expired
    const { data: expiredSubscriptions, error: selectError } = await supabase
      .from('subscriptions')
      .select('id, user_id, tariff_id, expires_at')
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())

    if (selectError) {
      console.error('Error fetching expired subscriptions:', selectError)
      throw selectError
    }

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No expired subscriptions found',
          count: 0 
        }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Cancel all expired subscriptions
    const subscriptionIds = expiredSubscriptions.map(sub => sub.id)
    
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .in('id', subscriptionIds)

    if (updateError) {
      console.error('Error cancelling subscriptions:', updateError)
      throw updateError
    }

    // Create notifications for expired subscriptions
    for (const subscription of expiredSubscriptions) {
      const { data: tariff } = await supabase
        .from('tariffs')
        .select('name')
        .eq('id', subscription.tariff_id)
        .single()

      await supabase
        .from('notifications')
        .insert({
          user_id: subscription.user_id,
          type: 'tariff_expired',
          title: 'Тариф закінчився',
          message: `Ваш тариф "${tariff?.name || 'Невідомий'}" закінчився. Поновіть підписку для продовження роботи.`,
          link: '/dashboard'
        })
    }

    console.log(`Successfully expired ${expiredSubscriptions.length} subscriptions`)

    // Check and expire VIP subscriptions
    const { data: expiredVips, error: vipSelectError } = await supabase
      .from('vip_subscriptions')
      .select('id, user_id, expires_at')
      .lt('expires_at', new Date().toISOString())

    let vipCount = 0
    if (!vipSelectError && expiredVips && expiredVips.length > 0) {
      // Delete expired VIP subscriptions
      const vipIds = expiredVips.map(vip => vip.id)
      const { error: vipDeleteError } = await supabase
        .from('vip_subscriptions')
        .delete()
        .in('id', vipIds)

      if (!vipDeleteError) {
        // Create notifications for expired VIP
        for (const vip of expiredVips) {
          await supabase
            .from('notifications')
            .insert({
              user_id: vip.user_id,
              type: 'vip_expired',
              title: 'VIP статус закінчився',
              message: 'Ваш VIP статус закінчився. Поновіть підписку для отримання ексклюзивних переваг.',
              link: '/dashboard'
            })
        }
        vipCount = expiredVips.length
        console.log(`Successfully expired ${vipCount} VIP subscriptions`)
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Subscriptions expired successfully',
        tariff_count: expiredSubscriptions.length,
        vip_count: vipCount,
        subscriptions: expiredSubscriptions
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in expire-subscriptions function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
