import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  X, 
  Copy, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Bug,
  Info,
  XCircle,
  AlertCircle,
  FolderOpen,
  Globe,
  User,
  Monitor
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ErrorLog {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  timestamp: Date;
  componentStack?: string;
  url?: string;
  line?: number;
  column?: number;
  userAgent?: string;
  windowSize?: string;
  pathname?: string;
  userId?: string;
  errorName?: string;
  count?: number;
}

const ErrorDebugger = () => {
  const { toast } = useToast();
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          setIsAdmin(profile?.role === "admin");
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  useEffect(() => {
    // Don't setup error listeners if not admin
    if (!isAdmin) {
      return;
    }

    // Get user info
    const getUserInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id;
      } catch {
        return undefined;
      }
    };

    // Global error handler
    const handleError = async (event: ErrorEvent) => {
      const errorMessage = event.message;
      const userId = await getUserInfo();
      
      setErrors(prev => {
        // Check if this error already exists (within 5 seconds)
        const existingError = prev.find(e => 
          e.message === errorMessage && 
          Date.now() - e.timestamp.getTime() < 5000
        );

        if (existingError) {
          // Increment count for duplicate errors
          return prev.map(e => 
            e.id === existingError.id 
              ? { ...e, count: (e.count || 1) + 1 }
              : e
          );
        }
        
        const error: ErrorLog = {
          id: `${Date.now()}-${Math.random()}`,
          type: 'error',
          message: errorMessage,
          stack: event.error?.stack,
          timestamp: new Date(),
          url: event.filename,
          line: event.lineno,
          column: event.colno,
          userAgent: navigator.userAgent,
          windowSize: `${window.innerWidth}x${window.innerHeight}`,
          pathname: window.location.pathname,
          userId: userId,
          errorName: event.error?.name,
          count: 1,
        };
        
        const newErrors = [error, ...prev];
        return newErrors.slice(0, 100);
      });
      
      setIsOpen(true);
    };

    // Promise rejection handler
    const handlePromiseRejection = async (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || String(event.reason);
      const userId = await getUserInfo();
      
      setErrors(prev => {
        // Check if this error already exists (within 5 seconds)
        const existingError = prev.find(e => 
          e.message === errorMessage && 
          Date.now() - e.timestamp.getTime() < 5000
        );

        if (existingError) {
          return prev.map(e => 
            e.id === existingError.id 
              ? { ...e, count: (e.count || 1) + 1 }
              : e
          );
        }
        
        const error: ErrorLog = {
          id: `${Date.now()}-${Math.random()}`,
          type: 'error',
          message: errorMessage,
          stack: event.reason?.stack,
          timestamp: new Date(),
          userAgent: navigator.userAgent,
          windowSize: `${window.innerWidth}x${window.innerHeight}`,
          pathname: window.location.pathname,
          userId: userId,
          errorName: event.reason?.name,
          count: 1,
        };
        
        const newErrors = [error, ...prev];
        return newErrors.slice(0, 100);
      });
      
      setIsOpen(true);
    };

    // Console.error override (with filter to prevent loops)
    const originalError = console.error;
    console.error = (...args: any[]) => {
      // Avoid logging React errors that are already handled
      const message = String(args[0]);
      // Filter out common system errors
      const shouldIgnore = 
        message.includes('ErrorDebugger') ||
        message.includes('ErrorBoundary') ||
        message.includes('DialogContent') ||
        message.includes('DialogTitle') ||
        message.includes('site_analytics') ||
        message.includes('42501');
      
      if (!shouldIgnore) {
        const errorMessage = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        setErrors(prev => {
          // Check for duplicates (within 1 second)
          const isDuplicate = prev.some(e => 
            e.message === errorMessage && 
            Date.now() - e.timestamp.getTime() < 1000
          );
          
          if (isDuplicate) return prev;
          
          const error: ErrorLog = {
            id: `${Date.now()}-${Math.random()}`,
            type: 'error',
            message: errorMessage,
            timestamp: new Date()
          };
          
          const newErrors = [error, ...prev];
          return newErrors.slice(0, 50);
        });
      }
      originalError.apply(console, args);
    };

    // Console.warn override (with filter to prevent loops)
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const message = String(args[0]);
      // Filter out common system warnings
      const shouldIgnore = 
        message.includes('ErrorDebugger') ||
        message.includes('ErrorBoundary') ||
        message.includes('Missing `Description`') ||
        message.includes('aria-describedby') ||
        message.includes('DialogContent');
      
      if (!shouldIgnore) {
        const errorMessage = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        setErrors(prev => {
          // Check for duplicates (within 1 second)
          const isDuplicate = prev.some(e => 
            e.message === errorMessage && 
            Date.now() - e.timestamp.getTime() < 1000
          );
          
          if (isDuplicate) return prev;
          
          const error: ErrorLog = {
            id: `${Date.now()}-${Math.random()}`,
            type: 'warning',
            message: errorMessage,
            timestamp: new Date()
          };
          
          const newErrors = [error, ...prev];
          return newErrors.slice(0, 50);
        });
      }
      originalWarn.apply(console, args);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [isAdmin]); // Re-run when isAdmin changes

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Успішно", description: "Скопійовано в буфер обміну!" });
  };

  const copyError = (error: ErrorLog) => {
    const text = `
╔══════════════════════════════════════════════════════════════
║ ERROR DETAILS
╚══════════════════════════════════════════════════════════════

📛 Error Name: ${error.errorName || 'Unknown'}
📝 Type: ${error.type.toUpperCase()}
💬 Message: ${error.message}
🕐 Timestamp: ${error.timestamp.toLocaleString('uk-UA')}
🔄 Count: ${error.count || 1}${error.count && error.count > 1 ? ' (repeated)' : ''}

${error.url ? `📂 File: ${error.url}:${error.line}:${error.column}` : ''}
${error.pathname ? `🌐 Path: ${error.pathname}` : ''}
${error.userId ? `👤 User ID: ${error.userId}` : '👤 User: Anonymous'}
${error.windowSize ? `📐 Window Size: ${error.windowSize}` : ''}
${error.userAgent ? `🖥️  User Agent: ${error.userAgent}` : ''}

${error.stack ? `
╔══════════════════════════════════════════════════════════════
║ STACK TRACE
╚══════════════════════════════════════════════════════════════
${error.stack}
` : ''}
${'═'.repeat(64)}
    `.trim();
    
    copyToClipboard(text);
  };

  const clearErrors = () => {
    setErrors([]);
    toast({ title: "Успішно", description: "Помилки очищено" });
  };

  const getIcon = (type: ErrorLog['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTypeColor = (type: ErrorLog['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-500/10 border-red-500/30 text-red-500';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-500';
    }
  };

  // Don't render if not admin or still loading
  if (isLoading || !isAdmin) {
    return null;
  }

  if (!isOpen && errors.length === 0) return null;

  return (
    <>
      {/* Floating button */}
      {!isOpen && errors.length > 0 && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-[9999] bg-red-500 hover:bg-red-600 text-white rounded-full w-14 h-14 shadow-lg animate-pulse"
          size="icon"
        >
          <Bug className="w-6 h-6" />
          <Badge className="absolute -top-2 -right-2 bg-white text-red-500 border-2 border-red-500">
            {errors.length}
          </Badge>
        </Button>
      )}

      {/* Debugger panel */}
      {isOpen && (
        <Card 
          className="fixed z-[9999] w-[600px] max-w-[90vw] shadow-2xl border-2 border-red-500/50 bg-background/95 backdrop-blur"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('.debugger-header')) {
              setIsDragging(true);
              const startX = e.clientX - position.x;
              const startY = e.clientY - position.y;

              const handleMouseMove = (e: MouseEvent) => {
                setPosition({
                  x: e.clientX - startX,
                  y: e.clientY - startY
                });
              };

              const handleMouseUp = () => {
                setIsDragging(false);
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
              };

              window.addEventListener('mousemove', handleMouseMove);
              window.addEventListener('mouseup', handleMouseUp);
            }
          }}
        >
          {/* Header */}
          <div className="debugger-header flex items-center justify-between p-4 border-b bg-red-500/10 cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-3">
              <div className="bg-red-500 p-2 rounded-lg">
                <Bug className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Дебагер Помилок</h3>
                <p className="text-xs text-muted-foreground">
                  {errors.length} {errors.length === 1 ? 'помилка' : errors.length < 5 ? 'помилки' : 'помилок'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearErrors}
                title="Очистити всі"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Errors list */}
          <ScrollArea className="h-[400px] p-4">
            {errors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Немає помилок</p>
              </div>
            ) : (
              <div className="space-y-3">
                {errors.map((error) => (
                  <Card 
                    key={error.id}
                    className={cn(
                      "p-4 border-2",
                      getTypeColor(error.type)
                    )}
                  >
                    {/* Error header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        {getIcon(error.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {error.errorName || error.type.toUpperCase()}
                            </Badge>
                            {error.count && error.count > 1 && (
                              <Badge variant="destructive" className="text-xs">
                                ×{error.count}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {error.timestamp.toLocaleTimeString('uk-UA')}
                            </span>
                          </div>
                          <p className="text-sm font-mono break-words">
                            {error.message}
                          </p>
                          <div className="mt-1 space-y-0.5">
                            {error.url && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <FolderOpen className="w-3 h-3" /> {error.url}:{error.line}:{error.column}
                              </p>
                            )}
                            {error.pathname && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Globe className="w-3 h-3" /> {error.pathname}
                              </p>
                            )}
                            {error.userId && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" /> User: {error.userId.substring(0, 8)}...
                              </p>
                            )}
                            {error.windowSize && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Monitor className="w-3 h-3" /> {error.windowSize}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyError(error)}
                          title="Копіювати"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setExpandedError(
                            expandedError === error.id ? null : error.id
                          )}
                          title={expandedError === error.id ? "Згорнути" : "Розгорнути"}
                        >
                          {expandedError === error.id ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedError === error.id && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        {/* Additional info */}
                        {error.userAgent && (
                          <div>
                            <p className="text-xs font-semibold mb-1">🖥️ User Agent:</p>
                            <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                              <code>{error.userAgent}</code>
                            </pre>
                          </div>
                        )}

                        {/* Stack trace */}
                        {error.stack && (
                          <div>
                            <p className="text-xs font-semibold mb-1">📚 Stack Trace:</p>
                            <pre className="text-xs bg-black/50 p-3 rounded overflow-x-auto max-h-60">
                              <code>{error.stack}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t bg-muted/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              💡 Перетягніть панель за заголовок
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const allErrors = errors.map(e => `
[${e.type.toUpperCase()}] ${e.timestamp.toLocaleString('uk-UA')}
${e.message}
${e.stack ? '\n' + e.stack : ''}
${'='.repeat(80)}
                `).join('\n');
                copyToClipboard(allErrors);
              }}
            >
              <Copy className="w-3 h-3 mr-2" />
              Копіювати всі
            </Button>
          </div>
        </Card>
      )}
    </>
  );
};

export default ErrorDebugger;


