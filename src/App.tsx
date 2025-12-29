import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { isAndroidAPK } from "@/lib/platform";
import { startLotteryAutoDrawer, stopLotteryAutoDrawer } from "@/utils/lotteryAutoDrawer";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Loading } from "@/components/Loading";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import BotSetup from "./pages/BotSetup";
import AIBotConfig from "./pages/AIBotConfig";
import MyChannels from "./pages/MyChannels";
import ChannelStats from "./pages/ChannelStats";
import ChannelPosts from "./pages/ChannelPosts";
import QueueManagement from "./pages/QueueManagement";
import Admin from "./pages/Admin";
import Moderator from "./pages/Moderator";
import Terms from "./pages/Terms";
import Referral from "./pages/Referral";
import Entertainment from "./pages/Entertainment";
import Tickets from "./pages/Tickets";
import CreateTicket from "./pages/CreateTicket";
import VipChat from "./pages/VipChat";
import StaticPage from "./pages/StaticPage";
import NotFound from "./pages/NotFound";
import Info from "./pages/Info";
import TaskMarketplace from "./pages/TaskMarketplace";
import CreateTask from "./pages/CreateTask";
import Tools from "./pages/Tools";
import TaskModerationDetail from "./pages/admin/TaskModerationDetail";
import UsersPage from "./pages/admin/UsersPage";
import AnalyticsPage from "./pages/Analytics";
import TariffsPage from "./pages/admin/TariffsPage";
import VipPage from "./pages/admin/VipPage";
import BotsPage from "./pages/admin/BotsPage";
import ChannelsPage from "./pages/admin/ChannelsPage";
import PagesPage from "./pages/admin/PagesPage";
import TasksPage from "./pages/admin/TasksPage";
import TicketsPage from "./pages/admin/TicketsPage";
import GeneralPage from "./pages/admin/GeneralPage";
import SecurityPage from "./pages/admin/SecurityPage";
import TelegramAuthPage from "./pages/admin/TelegramAuthPage";
import LimitsPage from "./pages/admin/LimitsPage";
import PrizesPage from "./pages/admin/PrizesPage";
import FAQPage from "./pages/admin/FAQPage";
import ReviewsPage from "./pages/admin/ReviewsPage";
import LotteryPage from "./pages/admin/LotteryPage";
import AuditLogPage from "./pages/admin/AuditLogPage";
import RouletteSettings from "./pages/admin/RouletteSettings";
import ReferralSettings from "./pages/admin/ReferralSettings";
import EntertainmentPage from "./pages/admin/EntertainmentPage";
import AIServicesPage from "./pages/admin/AIServicesPage";
import CategoryPromptsPage from "./pages/admin/CategoryPromptsPage";
import ToolsSettingsPage from "./pages/admin/ToolsSettingsPage";
import PromoCodesPage from "./pages/admin/PromoCodesPage";
import AIChat from "./pages/AIChat";
import Reviews from "./pages/Reviews";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import { MaintenanceMode } from "@/components/MaintenanceMode";
import { Analytics } from "@/components/Analytics";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { supabase } from "@/integrations/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import ErrorDebugger from "@/components/ErrorDebugger";

const queryClient = new QueryClient();

const AppContent = () => {
  const { settings, isLoading } = useGeneralSettings();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState<any>(null);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const isAPK = isAndroidAPK();

  useEffect(() => {
    checkAdminStatus();
    
    // Handle auth errors globally
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }
      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // If refresh token is invalid, sign out
      if (sessionError) {
        console.error("Session error:", sessionError);
        if (sessionError.message?.includes('Refresh Token')) {
          await supabase.auth.signOut();
        }
        return;
      }
      
      if (session) {
        setIsAuthenticated(true);
        
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

        if (!error && data) {
          setIsAdmin(true);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    } finally {
      setCheckingAuth(false);
    }
  };

  // Track page views
  useEffect(() => {
    // Track page view on route change
  }, [location.pathname]);

  if (isLoading || checkingAuth) {
    return <Loading message="Ініціалізація..." />;
  }

  // APK Mode: Force Auth if not authenticated
  if (isAPK && !isAuthenticated && location.pathname !== '/auth') {
    return (
      <>
        <Auth />
      </>
    );
  }

  // Show maintenance mode for non-admin users
  if (settings.maintenance_mode && !isAdmin) {
    return <MaintenanceMode />;
  }

  return (
    <>
      <Analytics />
      <Routes>
        {/* Public routes */}
        {!isAPK && <Route path="/" element={<Layout><Index /></Layout>} />}
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/page/:slug" element={<Layout><StaticPage /></Layout>} />
        
        {/* Protected routes - require authentication */}
        <Route path="/dashboard" element={<Layout><ProtectedRoute><Dashboard /></ProtectedRoute></Layout>} />
        <Route path="/notifications" element={<Layout><ProtectedRoute><Notifications /></ProtectedRoute></Layout>} />
        <Route path="/settings" element={<Layout><ProtectedRoute><Settings /></ProtectedRoute></Layout>} />
        <Route path="/bot-setup" element={<Layout><ProtectedRoute><BotSetup /></ProtectedRoute></Layout>} />
        <Route path="/ai-bot-config" element={<Layout><ProtectedRoute><AIBotConfig /></ProtectedRoute></Layout>} />
        <Route path="/my-channels" element={<Layout><ProtectedRoute><MyChannels /></ProtectedRoute></Layout>} />
        <Route path="/channel-stats" element={<Layout><ProtectedRoute><ChannelStats /></ProtectedRoute></Layout>} />
        <Route path="/channel-posts" element={<Layout><ProtectedRoute><ChannelPosts /></ProtectedRoute></Layout>} />
        <Route path="/queue-management" element={<Layout><ProtectedRoute><QueueManagement /></ProtectedRoute></Layout>} />
        <Route path="/ai-chat" element={<Layout><ProtectedRoute><AIChat /></ProtectedRoute></Layout>} />
        <Route path="/reviews" element={<Layout><ProtectedRoute><Reviews /></ProtectedRoute></Layout>} />
        <Route path="/moderator" element={<Layout><ProtectedRoute><Moderator /></ProtectedRoute></Layout>} />
        <Route path="/referral" element={<Layout><ProtectedRoute><Referral /></ProtectedRoute></Layout>} />
        <Route path="/entertainment" element={<Layout><ProtectedRoute><Entertainment /></ProtectedRoute></Layout>} />
        <Route path="/tickets" element={<Layout><ProtectedRoute><Tickets /></ProtectedRoute></Layout>} />
        <Route path="/tickets/create" element={<Layout><ProtectedRoute><CreateTicket /></ProtectedRoute></Layout>} />
        <Route path="/vip-chat" element={<Layout><ProtectedRoute><VipChat /></ProtectedRoute></Layout>} />
        <Route path="/task-marketplace" element={<Layout><ProtectedRoute><TaskMarketplace /></ProtectedRoute></Layout>} />
        <Route path="/task-marketplace/create" element={<Layout><ProtectedRoute><CreateTask /></ProtectedRoute></Layout>} />
        <Route path="/task-marketplace/edit/:taskId" element={<Layout><ProtectedRoute><CreateTask /></ProtectedRoute></Layout>} />
        <Route path="/tools" element={<Layout><ProtectedRoute><Tools /></ProtectedRoute></Layout>} />
        <Route path="/analytics" element={<Layout><ProtectedRoute><AnalyticsPage /></ProtectedRoute></Layout>} />
        <Route path="/info" element={<Layout><ProtectedRoute><Info /></ProtectedRoute></Layout>} />
        
        {/* Admin routes - require admin role */}
        <Route path="/admin" element={<Layout><ProtectedRoute requireAdmin><Admin /></ProtectedRoute></Layout>} />
        <Route path="/admin/users" element={<Layout><ProtectedRoute requireAdmin><UsersPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/tariffs" element={<Layout><ProtectedRoute requireAdmin><TariffsPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/vip" element={<Layout><ProtectedRoute requireAdmin><VipPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/bots" element={<Layout><ProtectedRoute requireAdmin><BotsPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/channels" element={<Layout><ProtectedRoute requireAdmin><ChannelsPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/pages" element={<Layout><ProtectedRoute requireAdmin><PagesPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/tasks" element={<Layout><ProtectedRoute requireAdmin><TasksPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/tasks/:taskId" element={<Layout><ProtectedRoute requireAdmin><TaskModerationDetail /></ProtectedRoute></Layout>} />
        <Route path="/admin/tickets" element={<Layout><ProtectedRoute requireAdmin><TicketsPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/general" element={<Layout><ProtectedRoute requireAdmin><GeneralPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/security" element={<Layout><ProtectedRoute requireAdmin><SecurityPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/telegram-auth" element={<Layout><ProtectedRoute requireAdmin><TelegramAuthPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/limits" element={<Layout><ProtectedRoute requireAdmin><LimitsPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/prizes" element={<Layout><ProtectedRoute requireAdmin><PrizesPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/faq" element={<Layout><ProtectedRoute requireAdmin><FAQPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/reviews" element={<Layout><ProtectedRoute requireAdmin><ReviewsPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/lottery" element={<Layout><ProtectedRoute requireAdmin><LotteryPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/audit-log" element={<Layout><ProtectedRoute requireAdmin><AuditLogPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/roulette" element={<Layout><ProtectedRoute requireAdmin><RouletteSettings /></ProtectedRoute></Layout>} />
        <Route path="/admin/entertainment" element={<Layout><ProtectedRoute requireAdmin><EntertainmentPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/referral" element={<Layout><ProtectedRoute requireAdmin><ReferralSettings /></ProtectedRoute></Layout>} />
        <Route path="/admin/ai-services" element={<Layout><ProtectedRoute requireAdmin><AIServicesPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/category-prompts" element={<Layout><ProtectedRoute requireAdmin><CategoryPromptsPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/tools-settings" element={<Layout><ProtectedRoute requireAdmin><ToolsSettingsPage /></ProtectedRoute></Layout>} />
        <Route path="/admin/promo-codes" element={<Layout><ProtectedRoute requireAdmin><PromoCodesPage /></ProtectedRoute></Layout>} />
        
        {/* 404 - catch all */}
        <Route path="*" element={<Layout><NotFound /></Layout>} />
      </Routes>
    </>
  );
};

const App = () => {
  useEffect(() => {
    // Start lottery auto-drawer
    console.log('🎰 Starting lottery auto-drawer on app mount');
    startLotteryAutoDrawer();
    
    return () => {
      console.log('🎰 Stopping lottery auto-drawer on app unmount');
      stopLotteryAutoDrawer();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ErrorDebugger />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;
