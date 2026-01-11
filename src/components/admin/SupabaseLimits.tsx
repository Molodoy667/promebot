import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Database, 
  HardDrive, 
  Zap, 
  Users, 
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  Trash2,
  FolderX,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface StorageStats {
  bucket: string;
  size: number;
  fileCount: number;
  folders?: FolderStats[];
}

interface FolderStats {
  path: string;
  size: number;
  fileCount: number;
  oldFilesCount: number; // Files older than 30 days
  createdAt?: string; // First file creation date in folder
}

export const SupabaseLimits = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [storageStats, setStorageStats] = useState<StorageStats[]>([]);
  const [dbStats, setDbStats] = useState({
    tables: 0,
    totalRows: 0,
    size: '0 KB',
    estimatedSizeBytes: 0
  });
  const [edgeFunctionsStats, setEdgeFunctionsStats] = useState({
    invocationsThisMonth: 0,
    limit: 500000
  });
  const [authStats, setAuthStats] = useState({
    totalUsers: 0,
    limit: 50000 // Free tier limit
  });
  const [realtimeStats, setRealtimeStats] = useState({
    currentConnections: 0,
    limit: 200
  });
  const [cleaningInProgress, setCleaningInProgress] = useState(false);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | undefined;

    const run = async () => {
      if (!isMounted) return;
      await loadStats();
    };

    // initial load
    run();

    // auto refresh every 30 minutes
    intervalId = window.setInterval(() => {
      // fire-and-forget; loadStats has its own error handling
      void run();
    }, 30 * 60 * 1000);

    return () => {
      isMounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadStorageStats(),
        loadDatabaseStats(),
        loadAuthStats(),
        loadEdgeFunctionsStats(),
        loadRealtimeStats()
      ]);

      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити статистику",
        variant: "destructive",
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStorageStats = async () => {
    try {
      const stats: StorageStats[] = [];
      const buckets = ['avatars', 'ticket-attachments', 'vip-chat'];
      
      for (const bucketName of buckets) {
        try {
          let totalSize = 0;
          let fileCount = 0;
          const folderStats = new Map<string, FolderStats>();
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          // Quick scan - only count files, estimate size from metadata
          const processFolder = async (path: string = '', depth: number = 0) => {
            // Limit recursion depth to prevent infinite loops
            if (depth > 5) return;
            
            const { data: items, error } = await supabase.storage
              .from(bucketName)
              .list(path, { limit: 100 });

            if (error || !items) return;

            for (const item of items) {
              const itemPath = path ? `${path}/${item.name}` : item.name;
              
              // If it's a folder
              if (item.id === null || item.metadata === null) {
                await processFolder(itemPath, depth + 1);
              } else {
                // It's a file - use metadata size if available
                const fileSize = (item.metadata as any)?.size || 1024; // Default 1KB if unknown
                totalSize += fileSize;
                fileCount++;
                
                const folderPath = itemPath.includes('/') 
                  ? itemPath.substring(0, itemPath.lastIndexOf('/'))
                  : 'root';
                
                const isOld = item.created_at 
                  ? new Date(item.created_at) < thirtyDaysAgo
                  : false;
                
                if (!folderStats.has(folderPath)) {
                  folderStats.set(folderPath, {
                    path: folderPath,
                    size: 0,
                    fileCount: 0,
                    oldFilesCount: 0,
                    createdAt: item.created_at || undefined
                  });
                }
                
                const folder = folderStats.get(folderPath)!;
                folder.size += fileSize;
                folder.fileCount++;
                if (isOld) folder.oldFilesCount++;
                
                if (item.created_at && (!folder.createdAt || item.created_at < folder.createdAt)) {
                  folder.createdAt = item.created_at;
                }
              }
            }
          };

          await Promise.race([
            processFolder(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]).catch(() => {
            console.warn(`Timeout scanning ${bucketName}, using partial data`);
          });
          
          stats.push({
            bucket: bucketName,
            size: totalSize,
            fileCount: fileCount,
            folders: Array.from(folderStats.values())
          });
        } catch (err) {
          console.error(`Error processing ${bucketName}:`, err);
          stats.push({ bucket: bucketName, size: 0, fileCount: 0, folders: [] });
        }
      }

      setStorageStats(stats);
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  };

  const loadDatabaseStats = async () => {
    try {
      // Count main tables
      const tables = [
        'profiles',
        'bot_services',
        'telegram_bots',
        'tariffs',
        'subscriptions',
        'tickets',
        'ticket_messages',
        'tasks',
        'task_submissions',
        'posts_history',
        'source_channels',
        'transactions',
        'vip_subscriptions',
        'lottery_rounds',
        'lottery_tickets',
        'miner_data',
        'miner_bots',
        'app_settings',
        'category_prompts',
        'audit_log'
      ];

      // Count rows in parallel
      const counts = await Promise.all(
        tables.map(async (table) => {
          try {
            const { count } = await (supabase
              .from(table as any)
              .select('*', { count: 'exact', head: true }) as any);
            return count || 0;
          } catch {
            return 0;
          }
        })
      );

      const totalRows = counts.reduce((sum, count) => sum + count, 0);

      // Try to get real DB size via RPC (admin-only)
      let sizeBytes: number | null = null;
      try {
        const { data, error } = await supabase.rpc('get_database_size_bytes');
        if (!error && typeof data === 'number') {
          sizeBytes = data;
        }
      } catch {
        // ignore; fallback below
      }

      // Fallback estimate if RPC isn't available/allowed
      const estimatedSizeBytes = totalRows * 2048;
      const usedBytes = sizeBytes ?? estimatedSizeBytes;

      setDbStats({
        tables: tables.length,
        totalRows,
        size: formatBytes(usedBytes),
        estimatedSizeBytes: usedBytes
      });
    } catch (error) {
      console.error('Error loading database stats:', error);
    }
  };

  const loadEdgeFunctionsStats = async () => {
    try {
      // Supabase doesn't provide direct API to get Edge Function invocations count
      // We'll estimate based on various activities that trigger Edge Functions
      
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      
      // Count activities that trigger Edge Functions
      const [
        postsCount,
        ticketsCount,
        tasksCount,
        lotteryCount,
        authCount
      ] = await Promise.all([
        // AI posts generation
        supabase.from('posts_history')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth)
          .then(({ count }) => count || 0),
        
        // Ticket messages (telegram-webhook)
        supabase.from('ticket_messages')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth)
          .then(({ count }) => count || 0),
        
        // Task submissions
        supabase.from('task_submissions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth)
          .then(({ count }) => count || 0),
        
        // Lottery draws
        supabase.from('lottery_rounds')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth)
          .then(({ count }) => count || 0),
        
        // Auth operations (approximate)
        supabase.from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth)
          .then(({ count }) => count || 0)
      ]);

      // Estimate: each activity triggers 1-3 Edge Function calls
      // Posts: generate-ai-posts, generate-image, publish-to-telegram (3x)
      // Tickets: telegram-webhook (1x)
      // Tasks: validation functions (2x)
      // Lottery: lottery-draw (1x)
      // Auth: telegram-auth, verify-email (2x)
      
      const estimatedInvocations = 
        (postsCount * 3) + 
        (ticketsCount * 1) + 
        (tasksCount * 2) + 
        (lotteryCount * 1) + 
        (authCount * 2);

      console.log('Edge Functions estimation:', {
        posts: postsCount * 3,
        tickets: ticketsCount,
        tasks: tasksCount * 2,
        lottery: lotteryCount,
        auth: authCount * 2,
        total: estimatedInvocations
      });

      setEdgeFunctionsStats({
        invocationsThisMonth: estimatedInvocations,
        limit: 500000
      });
    } catch (error) {
      console.error('Error loading edge functions stats:', error);
    }
  };

  const loadAuthStats = async () => {
    try {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      setAuthStats({
        totalUsers: count || 0,
        limit: 50000
      });
    } catch (error) {
      console.error('Error loading auth stats:', error);
    }
  };

  const loadRealtimeStats = async () => {
    try {
      // Get approximate realtime connections from active subscriptions
      // This is an estimate based on users with active AI services
      const { count } = await supabase
        .from('bot_services')
        .select('*', { count: 'exact', head: true })
        .eq('is_running', true);

      setRealtimeStats({
        currentConnections: count || 0,
        limit: 200
      });
    } catch (error) {
      console.error('Error loading realtime stats:', error);
    }
  };

  const cleanOldFiles = async (bucket: string, folderPath: string) => {
    if (!confirm(`Ви впевнені що хочете видалити всі файли старіші 30 днів з папки "${folderPath}" в bucket "${bucket}"?`)) {
      return;
    }

    setCleaningInProgress(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let deletedCount = 0;
      let deletedSize = 0;

      // List all files in folder
      const path = folderPath === 'root' ? '' : folderPath;
      const { data: items, error } = await supabase.storage
        .from(bucket)
        .list(path, { limit: 1000 });

      if (error) throw error;

      const filesToDelete: string[] = [];

      for (const item of items || []) {
        if (item.id !== null && item.metadata !== null) {
          // It's a file
          const itemPath = path ? `${path}/${item.name}` : item.name;
          
          if (item.created_at && new Date(item.created_at) < thirtyDaysAgo) {
            filesToDelete.push(itemPath);
            
            // Get file size before deletion
            try {
              const { data: fileData } = await supabase.storage
                .from(bucket)
                .download(itemPath);
              if (fileData) deletedSize += fileData.size;
            } catch {}
          }
        }
      }

      if (filesToDelete.length === 0) {
        toast({
          title: "Інформація",
          description: "Немає файлів старіших 30 днів для видалення",
          duration: 3000,
        });
        setCleaningInProgress(false);
        return;
      }

      // Delete files
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove(filesToDelete);

      if (deleteError) throw deleteError;

      deletedCount = filesToDelete.length;

      toast({
        title: "Успішно видалено",
        description: `Видалено ${deletedCount} файлів (${formatBytes(deletedSize)})`,
        duration: 5000,
      });

      // Reload stats
      await loadStorageStats();
    } catch (error) {
      console.error('Error cleaning old files:', error);
      toast({
        title: "Помилка",
        description: "Не вдалося видалити старі файли",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setCleaningInProgress(false);
    }
  };

  const deleteFolder = async (bucket: string, folderPath: string) => {
    if (!confirm(`УВАГА! Ви впевнені що хочете видалити ВСЮ ПАПКУ "${folderPath}" з УСІМА файлами в bucket "${bucket}"?\n\nЦю дію не можна скасувати!`)) {
      return;
    }

    setCleaningInProgress(true);
    try {
      let deletedCount = 0;
      let deletedSize = 0;

      // List all files in folder
      const path = folderPath === 'root' ? '' : folderPath;
      const { data: items, error } = await supabase.storage
        .from(bucket)
        .list(path, { limit: 1000 });

      if (error) throw error;

      const filesToDelete: string[] = [];

      for (const item of items || []) {
        if (item.id !== null && item.metadata !== null) {
          // It's a file
          const itemPath = path ? `${path}/${item.name}` : item.name;
          filesToDelete.push(itemPath);
          
          // Get file size before deletion
          try {
            const { data: fileData } = await supabase.storage
              .from(bucket)
              .download(itemPath);
            if (fileData) deletedSize += fileData.size;
          } catch {}
        }
      }

      if (filesToDelete.length === 0) {
        toast({
          title: "Інформація",
          description: "Папка вже порожня",
          duration: 3000,
        });
        setCleaningInProgress(false);
        return;
      }

      // Delete all files
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove(filesToDelete);

      if (deleteError) throw deleteError;

      deletedCount = filesToDelete.length;

      toast({
        title: "Папку видалено",
        description: `Видалено ${deletedCount} файлів (${formatBytes(deletedSize)})`,
        duration: 5000,
      });

      // Reload stats
      await loadStorageStats();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: "Помилка",
        description: "Не вдалося видалити папку",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setCleaningInProgress(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const toggleBucket = (bucketName: string) => {
    setExpandedBuckets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bucketName)) {
        newSet.delete(bucketName);
      } else {
        newSet.add(bucketName);
      }
      return newSet;
    });
  };

  const totalStorage = storageStats.reduce((sum, stat) => sum + stat.size, 0);
  const storageLimit = 1 * 1024 * 1024 * 1024; // 1 GB in bytes (Free tier)
  const storagePercent = (totalStorage / storageLimit) * 100;

  const authPercent = (authStats.totalUsers / authStats.limit) * 100;

  const dbLimit = 500 * 1024 * 1024; // 500 MB in bytes (Free tier)
  const dbPercent = (dbStats.estimatedSizeBytes / dbLimit) * 100;

  const edgeFunctionsPercent = (edgeFunctionsStats.invocationsThisMonth / edgeFunctionsStats.limit) * 100;

  const getStatusBadge = (percent: number) => {
    if (percent < 50) return <Badge variant="outline" className="bg-success/20 text-success border-success/30">Нормально</Badge>;
    if (percent < 80) return <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">Увага</Badge>;
    return <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">Критично</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Моніторинг лімітів Supabase</h3>
          <p className="text-sm text-muted-foreground">
            Відстеження використання ресурсів проєкту
          </p>
          {lastUpdatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Останнє оновлення: {lastUpdatedAt.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <Button onClick={loadStats} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Оновити
        </Button>
      </div>

      {/* Storage Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              <CardTitle>Storage (Сховище)</CardTitle>
            </div>
            {getStatusBadge(storagePercent)}
          </div>
          <CardDescription>
            Використання файлового сховища
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Використано</span>
              <span className="font-semibold">
                {formatBytes(totalStorage)} / 1 GB
              </span>
            </div>
            <Progress value={storagePercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {storagePercent.toFixed(1)}% від ліміту
            </p>
          </div>

          <div className="space-y-4 pt-4">
            {storageStats.map((stat) => {
              const isExpanded = expandedBuckets.has(stat.bucket);
              const hasOldFiles = stat.folders?.some(f => f.oldFilesCount > 0) || false;
              
              return (
                <div key={stat.bucket} className="space-y-2">
                  <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleBucket(stat.bucket)}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </Button>
                        <span className="text-sm font-medium">{stat.bucket}</span>
                        <Badge variant="secondary">{stat.fileCount} файлів</Badge>
                        {hasOldFiles && (
                          <Badge variant="destructive" className="text-xs">
                            Є старі файли
                          </Badge>
                        )}
                      </div>
                      <p className="text-lg font-bold">{formatBytes(stat.size)}</p>
                    </div>
                    
                    {stat.folders && stat.folders.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {stat.folders.length} {stat.folders.length === 1 ? 'папка' : 'папок'}
                      </p>
                    )}
                  </div>
                  
                  {/* Folders breakdown */}
                  {isExpanded && stat.folders && stat.folders.length > 0 && (
                    <div className="ml-4 space-y-2">
                      {stat.folders.map((folder) => (
                        <div key={folder.path} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-muted-foreground truncate flex items-center gap-1"><FolderX className="w-3 h-3" /> {folder.path}</span>
                                <Badge variant="outline" className="text-xs">{folder.fileCount} файлів</Badge>
                                {folder.oldFilesCount > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {folder.oldFilesCount} старих (&gt;30д)
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-sm font-semibold">{formatBytes(folder.size)}</p>
                                {folder.createdAt && (
                                  <p className="text-xs text-muted-foreground">
                                    📅 Створено: {new Date(folder.createdAt).toLocaleDateString('uk-UA', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {folder.oldFilesCount > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cleanOldFiles(stat.bucket, folder.path)}
                                  disabled={cleaningInProgress}
                                  className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                                  title="Видалити старі файли (>30 днів)"
                                >
                                  {cleaningInProgress ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteFolder(stat.bucket, folder.path)}
                                disabled={cleaningInProgress}
                                className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                                title="ВИДАЛИТИ ВСЮ ПАПКУ з усіма файлами"
                              >
                                {cleaningInProgress ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Database Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <CardTitle>Database (База даних)</CardTitle>
            </div>
            {getStatusBadge(dbPercent)}
          </div>
          <CardDescription>
            Використання бази даних PostgreSQL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Використано (оцінка)</span>
              <span className="font-semibold">
                {dbStats.size} / 500 MB
              </span>
            </div>
            <Progress value={dbPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {dbPercent.toFixed(2)}% від ліміту Free tier
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Таблиць</span>
              </div>
              <p className="text-2xl font-bold">{dbStats.tables}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Записів</span>
              </div>
              <p className="text-2xl font-bold">{dbStats.totalRows.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Розмір (оцінка)</span>
              </div>
              <p className="text-2xl font-bold">{dbStats.size}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auth Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle>Authentication (Користувачі)</CardTitle>
            </div>
            {getStatusBadge(authPercent)}
          </div>
          <CardDescription>
            Кількість зареєстрованих користувачів
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Користувачів</span>
              <span className="font-semibold">
                {authStats.totalUsers.toLocaleString()} / {authStats.limit.toLocaleString()}
              </span>
            </div>
            <Progress value={authPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {authPercent.toFixed(2)}% від ліміту Free tier
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edge Functions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <CardTitle>Edge Functions</CardTitle>
            </div>
            {getStatusBadge(edgeFunctionsPercent)}
          </div>
          <CardDescription>
            Serverless функції та виклики
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Викликів цього місяця (оцінка)</span>
                <span className="font-semibold">
                  ~{edgeFunctionsStats.invocationsThisMonth.toLocaleString()} / 500K
                </span>
              </div>
              <Progress value={edgeFunctionsPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {edgeFunctionsPercent.toFixed(2)}% від ліміту Free tier
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Оцінка базується на активності: пости (×3), тікети (×1), завдання (×2), лотерея (×1), реєстрації (×2)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Активних функцій</span>
                </div>
                <p className="text-2xl font-bold">16</p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI bot, генерація, публікація, тощо
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Ліміт викликів</span>
                </div>
                <p className="text-2xl font-bold">500K</p>
                <p className="text-xs text-muted-foreground mt-1">
                  викликів на місяць (Free tier)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-medium">Список функцій:</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ai-bot-worker, check-bot-admin, check-telegram-channel, generate-ai-posts, 
                  generate-image, generate-post, lottery-draw, miner-auto-collect, 
                  publish-to-telegram, telegram-webhook та інші
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Realtime */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <CardTitle>Realtime</CardTitle>
            </div>
            <Badge variant="outline" className="bg-success/20 text-success border-success/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Працює
            </Badge>
          </div>
          <CardDescription>
            WebSocket з'єднання в реальному часі
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Активних з'єднань (оцінка)</span>
              <span className="font-semibold">
                ~{realtimeStats.currentConnections} / {realtimeStats.limit}
              </span>
            </div>
            <Progress value={(realtimeStats.currentConnections / realtimeStats.limit) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {((realtimeStats.currentConnections / realtimeStats.limit) * 100).toFixed(2)}% від ліміту Free tier
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Оцінка базується на кількості активних AI сервісів
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Ліміт з'єднань</span>
              </div>
              <p className="text-2xl font-bold">{realtimeStats.limit}</p>
              <p className="text-xs text-muted-foreground mt-1">
                одночасно (Free tier)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Використовується для</span>
              </div>
              <p className="text-sm font-medium mt-1">AI налаштувань</p>
              <p className="text-xs text-muted-foreground">
                синхронізація в реальному часі
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Ліміти Free Tier Plan</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-medium flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage</p>
                    <p className="text-muted-foreground">1 GB файлового сховища</p>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-medium flex items-center gap-1"><Database className="w-3 h-3" /> Database</p>
                    <p className="text-muted-foreground">500 MB PostgreSQL</p>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-medium flex items-center gap-1"><Users className="w-3 h-3" /> Auth Users</p>
                    <p className="text-muted-foreground">50,000 користувачів</p>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-medium flex items-center gap-1"><Zap className="w-3 h-3" /> Edge Functions</p>
                    <p className="text-muted-foreground">500K викликів/місяць</p>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-medium flex items-center gap-1"><Activity className="w-3 h-3" /> Realtime</p>
                    <p className="text-muted-foreground">200 з'єднань одночасно</p>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-medium flex items-center gap-1"><Activity className="w-3 h-3" /> Bandwidth</p>
                    <p className="text-muted-foreground">5 GB на місяць</p>
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-semibold mb-2">💎 Pro Plan ($25/місяць)</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 100 GB Storage (додатково $0.021/GB)</li>
                  <li>• 8 GB Database (додатково $0.125/GB)</li>
                  <li>• Unlimited Auth users</li>
                  <li>• 2M Edge Functions викликів (додатково $2/млн)</li>
                  <li>• 250 GB Bandwidth (додатково $0.09/GB)</li>
                  <li>• Щоденні автоматичні backup</li>
                </ul>
              </div>

              <div className="pt-2 border-t border-primary/20">
                <p className="text-xs text-muted-foreground mb-2">
                  ℹ️ Статистика оновлюється при кожному натисканні кнопки "Оновити"
                </p>
                <Button
                  variant="link"
                  className="text-primary p-0 h-auto text-xs"
                  onClick={() => window.open('https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/settings/billing', '_blank')}
                >
                  📊 Переглянути повну статистику в Dashboard →
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
