import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Analytics = () => {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Track only once per session
    if (hasTracked.current) return;
    hasTracked.current = true;

    const trackVisit = async () => {
      try {
        // Check auth first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Skip analytics for non-authenticated users
          return;
        }

        // Get or create session ID
        let sessionId = sessionStorage.getItem('analytics_session_id');
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          sessionStorage.setItem('analytics_session_id', sessionId);
        }

        // Check if this is a unique visitor today
        const lastVisitDate = localStorage.getItem('analytics_last_visit');
        const today = new Date().toISOString().split('T')[0];
        const isUniqueToday = lastVisitDate !== today;

        if (isUniqueToday) {
          localStorage.setItem('analytics_last_visit', today);
        }

        // Track page view
        const { data: existing, error: fetchError } = await supabase
          .from('site_analytics')
          .select('*')
          .eq('date', today)
          .maybeSingle();

        if (fetchError) {
          // Ignore RLS and auth errors for analytics - not critical
          if (fetchError.code !== '42501' && !fetchError.message?.includes('JWT')) {
            console.error('Error fetching analytics:', fetchError);
          }
          return;
        }

        if (existing) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('site_analytics')
            .update({
              visits: existing.visits + 1,
              unique_visitors: existing.unique_visitors + (isUniqueToday ? 1 : 0),
              page_views: existing.page_views + 1,
            })
            .eq('id', existing.id);

          if (updateError && updateError.code !== '42501') {
            console.error('Error updating analytics:', updateError);
          }
        } else {
          // Create new record for today
          const { error: insertError } = await supabase
            .from('site_analytics')
            .insert({
              date: today,
              visits: 1,
              unique_visitors: 1,
              page_views: 1,
            });

          // Ignore duplicate key errors (race condition) and RLS errors (not critical)
          if (insertError && insertError.code !== '23505' && insertError.code !== '42501') {
            console.error('Error inserting analytics:', insertError);
          }
        }
      } catch (error) {
        console.error('Error tracking visit:', error);
      }
    };

    // Track after a short delay to ensure page is loaded
    const timer = setTimeout(trackVisit, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Track page views on route changes
  useEffect(() => {
    const trackPageView = async () => {
      if (!hasTracked.current) return;

      try {
        // Check auth first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const today = new Date().toISOString().split('T')[0];

        const { data: existing, error: fetchError } = await supabase
          .from('site_analytics')
          .select('*')
          .eq('date', today)
          .maybeSingle();

        if (fetchError) return;

        if (existing) {
          await supabase
            .from('site_analytics')
            .update({
              page_views: existing.page_views + 1,
            })
            .eq('id', existing.id);
        }
      } catch (error) {
        console.error('Error tracking page view:', error);
      }
    };

    // Track on route change
    const handleRouteChange = () => {
      trackPageView();
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  return null;
};
