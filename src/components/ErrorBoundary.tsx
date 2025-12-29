import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Copy, Home } from "lucide-react";
import { toast as toastFn } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isAdmin: boolean;
  isLoading: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isAdmin: false,
      isLoading: true
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error logging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      name: error.name
    };

    console.group("🔴 ErrorBoundary caught an error");
    console.error("Error:", error);
    console.error("Error Info:", errorInfo);
    console.error("Full Details:", errorDetails);
    console.groupEnd();
    
    this.setState({
      error,
      errorInfo
    });

    // Check if user is admin
    await this.checkAdminStatus();

    // Log to Supabase or external service
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // You can log errors to a table in the future
      console.log("Error logged for user:", user?.id);
      
      // Optional: Send to external logging service
      // await logErrorToService(errorDetails);
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }
  }

  async checkAdminStatus() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      console.log("ErrorBoundary - Checking admin status...");
      console.log("User:", user?.id);
      console.log("User error:", userError);
      
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        console.log("Profile data:", profile);
        console.log("Profile error:", profileError);
        console.log("Is admin:", profile?.role === "admin");

        this.setState({ 
          isAdmin: profile?.role === "admin",
          isLoading: false 
        });
      } else {
        console.log("No user found - not admin");
        this.setState({ isLoading: false });
      }
    } catch (error) {
      console.error("Failed to check admin status:", error);
      this.setState({ isLoading: false });
    }
  }

  copyErrorToClipboard = () => {
    const { error, errorInfo } = this.state;
    const errorText = `
Помилка: ${error?.message}
Стек: ${error?.stack}

Component Stack:
${errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorText);
    toastFn.success("Деталі помилки скопійовано!");
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const { isAdmin, isLoading } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 gradient-hero">
          <Card className="max-w-2xl w-full p-8 border-2 border-red-500/50">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 mb-4">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Упс! Щось пішло не так</h1>
              <p className="text-muted-foreground">
                Виникла непередбачена помилка. Спробуйте оновити сторінку.
              </p>
            </div>

            {/* Error details - Only for admins */}
            {isLoading && (
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground">Завантаження деталей...</p>
              </div>
            )}
            
            {!isLoading && isAdmin && (
              <Card className="p-4 bg-red-500/10 border-red-500/30 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold">
                    ADMIN ONLY
                  </span>
                  <p className="text-sm font-semibold">Деталі помилки:</p>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Error Name:</p>
                    <pre className="text-xs bg-black/50 p-2 rounded overflow-x-auto">
                      <code>{this.state.error?.name}</code>
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Error Message:</p>
                    <pre className="text-xs bg-black/50 p-2 rounded overflow-x-auto">
                      <code>{this.state.error?.message}</code>
                    </pre>
                  </div>
                  
                  {this.state.error?.stack && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Stack Trace:</p>
                      <pre className="text-xs bg-black/50 p-3 rounded overflow-x-auto max-h-40">
                        <code>{this.state.error.stack}</code>
                      </pre>
                    </div>
                  )}

                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Component Stack:</p>
                      <pre className="text-xs bg-black/50 p-3 rounded overflow-x-auto max-h-40">
                        <code>{this.state.errorInfo.componentStack}</code>
                      </pre>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Additional Info:</p>
                    <pre className="text-xs bg-black/50 p-2 rounded overflow-x-auto">
                      <code>{JSON.stringify({
                        timestamp: new Date().toISOString(),
                        url: window.location.href,
                        userAgent: navigator.userAgent.substring(0, 100) + "..."
                      }, null, 2)}</code>
                    </pre>
                  </div>
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                className="bg-gradient-primary"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Спробувати знову
              </Button>
              
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={this.copyErrorToClipboard}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Копіювати помилку
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={this.handleGoHome}
              >
                <Home className="w-4 h-4 mr-2" />
                На головну
              </Button>
            </div>

            {/* Help text */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              {isLoading
                ? "Перевірка прав доступу..."
                : isAdmin 
                  ? "Детальна інформація про помилку доступна вище"
                  : "Якщо помилка повторюється, зверніться до підтримки"
              }
            </p>
            
            {/* Debug info - always show for troubleshooting */}
            {!isLoading && (
              <details className="mt-4 text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">🔍 Debug Info (клікни для перегляду)</summary>
                <pre className="mt-2 bg-black/30 p-2 rounded overflow-x-auto">
                  {JSON.stringify({ 
                    isAdmin, 
                    isLoading,
                    timestamp: new Date().toISOString(),
                    message: "Перевір console.log для деталей перевірки адмін-статусу"
                  }, null, 2)}
                </pre>
              </details>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


