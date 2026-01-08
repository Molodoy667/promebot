import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GeneralSettings {
  site_name: string;
  site_description: string;
  meta_keywords: string;
  favicon_url: string;
  logo_url: string;
  maintenance_mode: boolean;
  email_confirmation_required?: boolean;
  timezone?: string;
}

export const useGeneralSettings = () => {
  const [settings, setSettings] = useState<GeneralSettings>({
    site_name: "PromoBot",
    site_description: "Автоматизація Telegram каналів",
    meta_keywords: "telegram, bot, automation",
    favicon_url: "",
    logo_url: "",
    maintenance_mode: false,
    timezone: "Europe/Kiev",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();

    // Subscribe to changes
    const channel = supabase
      .channel('general_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.general_settings',
        },
        () => {
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "general_settings")
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const loadedSettings = data.value as unknown as GeneralSettings;
        setSettings(loadedSettings);
        applySettings(loadedSettings);
      }
    } catch (error) {
      console.error("Error loading general settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const applySettings = (settings: GeneralSettings) => {
    // Update document title
    document.title = settings.site_name || "PromoBot";

    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', settings.site_description || 'Автоматизація Telegram каналів');

    // Update meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', settings.meta_keywords || 'telegram, bot, automation');

    // Update favicon
    if (settings.favicon_url) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.setAttribute('rel', 'icon');
        document.head.appendChild(favicon);
      }
      favicon.href = settings.favicon_url;
    }

    // Update Open Graph meta tags
    updateMetaTag('og:title', settings.site_name || 'PromoBot');
    updateMetaTag('og:description', settings.site_description || 'Автоматизація Telegram каналів');
    updateMetaTag('og:site_name', settings.site_name || 'PromoBot');
    if (settings.logo_url) {
      updateMetaTag('og:image', settings.logo_url);
    }

    // Update Twitter Card meta tags
    updateMetaTag('twitter:title', settings.site_name || 'PromoBot');
    updateMetaTag('twitter:description', settings.site_description || 'Автоматизація Telegram каналів');
    if (settings.logo_url) {
      updateMetaTag('twitter:image', settings.logo_url);
    }

    // Update theme color
    updateMetaTag('theme-color', '#6366f1');
  };

  const updateMetaTag = (property: string, content: string) => {
    if (!content) return;
    
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
      meta = document.querySelector(`meta[name="${property}"]`);
    }
    if (!meta) {
      meta = document.createElement('meta');
      if (property.startsWith('og:') || property.startsWith('twitter:')) {
        meta.setAttribute('property', property);
      } else {
        meta.setAttribute('name', property);
      }
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  return { settings, isLoading };
};
