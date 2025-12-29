import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAuth?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requireAdmin = false,
  requireAuth = true 
}: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        if (sessionError.message?.includes('Refresh Token')) {
          await supabase.auth.signOut();
        }
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Check authentication
      if (!session) {
        if (requireAuth) {
          navigate('/auth');
          return;
        }
        setAuthorized(true);
        setLoading(false);
        return;
      }

      // Check admin role if required
      if (requireAdmin) {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

        if (error || !data) {
          navigate('/dashboard');
          setAuthorized(false);
          setLoading(false);
          return;
        }
      }

      setAuthorized(true);
    } catch (error) {
      console.error("Error checking access:", error);
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
};
