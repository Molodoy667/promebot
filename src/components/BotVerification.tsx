import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, Loader2, Info, HelpCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import addBotInstruction from "@/assets/add-bot-instruction.jpg";

interface BotVerificationProps {
  selectedBotId: string | null;
  botUsername: string;
  onVerificationComplete: (targetChannel: string) => void;
  onCheckBot: (targetChannel: string) => Promise<{
    isMember: boolean;
    hasPermissions: boolean;
  }>;
}

export const BotVerification = ({
  selectedBotId,
  botUsername,
  onVerificationComplete,
  onCheckBot
}: BotVerificationProps) => {
  const { toast } = useToast();
  const [targetChannel, setTargetChannel] = useState("");
  const [isCheckingChannel, setIsCheckingChannel] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    isMember: boolean | null;
    hasPermissions: boolean | null;
  }>({ isMember: null, hasPermissions: null });

  const handleCheckBot = async () => {
    if (!targetChannel.trim()) {
      toast({
        title: "Помилка",
        description: "Вкажіть канал",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    setIsCheckingChannel(true);
    try {
      const result = await onCheckBot(targetChannel);
      setVerificationStatus(result);

      if (result.isMember && result.hasPermissions) {
        toast({
          title: "✅ Перевірка успішна",
          description: "Бот підключено до каналу",
          duration: 2000,
        });
        onVerificationComplete(targetChannel);
      } else if (!result.isMember) {
        toast({
          title: "❌ Бот не в каналі",
          description: "Додайте бота до каналу як адміністратора",
          variant: "destructive",
          duration: 3000,
        });
      } else if (!result.hasPermissions) {
        toast({
          title: "❌ Недостатньо прав",
          description: "Надайте боту права адміністратора",
          variant: "destructive",
          duration: 3000,
        });
      }
    } catch (error: any) {
      toast({
        title: "Помилка перевірки",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
      setVerificationStatus({ isMember: false, hasPermissions: false });
    } finally {
      setIsCheckingChannel(false);
    }
  };

  return (
    <Card className="p-8">
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Крок 1: Додайте бота до каналу</h3>
          <p className="text-muted-foreground">
            Додайте бота до свого каналу та надайте йому права адміністратора
          </p>
        </div>

        {selectedBotId && (
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <AlertDescription className="text-sm">
              <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                Ваш бот: @{botUsername}
              </p>
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <p><strong>Важливо:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Додайте бота @{botUsername} до вашого каналу</li>
                  <li>
                    <strong>Обов'язково:</strong> Щоб бот міг публікувати під іменем каналу (а не від імені бота), 
                    зробіть його <strong>адміністратором каналу</strong>
                  </li>
                  <li>Вкажіть username вашого каналу нижче</li>
                  <li>Натисніть "Перевірити підключення"</li>
                </ol>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg overflow-hidden border">
          <img 
            src={addBotInstruction} 
            alt="Інструкція як додати бота до каналу" 
            className="w-full h-auto"
          />
        </div>

        <Alert className="bg-blue-500/10 border-blue-500/20">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <AlertDescription>
            <div className="text-sm space-y-2">
              <p className="font-semibold text-blue-700 dark:text-blue-300">Як підключити канал:</p>
              <div className="space-y-1 text-blue-600 dark:text-blue-400">
                <p className="break-words"><strong>Публічні канали:</strong> вкажіть @username або посилання https://t.me/username</p>
                <p className="break-words"><strong>Приватні канали:</strong> вам потрібен числовий chat_id (формат: -1001234567890)</p>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="targetChannel">Username, посилання або chat_id</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="inline-flex items-center justify-center rounded-full w-5 h-5 bg-muted hover:bg-muted/80 transition-colors">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 z-[100]" side="top" align="start">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Приватний канал</p>
                    <p className="text-xs text-muted-foreground">
                      Для читання постів боту <strong>НЕ потрібні</strong> права адміністратора!
                    </p>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="bg-muted/50 p-3 rounded-md space-y-2">
                      <p className="font-medium">Як підключити:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2 text-muted-foreground">
                        <li>Додайте бота в приватний канал як звичайного учасника</li>
                        <li>Отримайте числовий chat_id каналу</li>
                        <li>Вкажіть chat_id нижче (формат: -1001234567890)</li>
                      </ol>
                    </div>
                    
                    <div className="bg-muted/50 p-3 rounded-md space-y-2">
                      <p className="font-medium">Як отримати chat_id:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2 text-muted-foreground">
                        <li>Додайте @userinfobot або @JsonDumpBot у Telegram</li>
                        <li>Перешліть повідомлення з приватного каналу в бота</li>
                        <li>Бот покаже вам chat_id каналу</li>
                      </ol>
                      
                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.open('https://t.me/userinfobot', '_blank');
                            toast({
                              title: "Відкрито @userinfobot",
                              description: "Натисніть /start в боті",
                              duration: 3000,
                            });
                          }}
                          className="text-xs h-7"
                        >
                          Відкрити @userinfobot
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.open('https://t.me/JsonDumpBot', '_blank');
                            toast({
                              title: "Відкрито @JsonDumpBot",
                              description: "Натисніть /start в боті",
                              duration: 3000,
                            });
                          }}
                          className="text-xs h-7"
                        >
                          Відкрити @JsonDumpBot
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Input
            id="targetChannel"
            placeholder="@channel, https://t.me/channel або -1001234567890"
            value={targetChannel}
            onChange={(e) => setTargetChannel(e.target.value)}
          />
        </div>

        <Button 
          onClick={handleCheckBot} 
          disabled={isCheckingChannel || !targetChannel.trim()}
          className="w-full"
          size="lg"
        >
          {isCheckingChannel ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Перевірка...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Перевірити підключення
            </>
          )}
        </Button>

        {verificationStatus.isMember !== null && (
          <div className="space-y-2">
            <Alert className={verificationStatus.isMember ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}>
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${verificationStatus.isMember ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={verificationStatus.isMember ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                    {verificationStatus.isMember ? "✅ Бот є в каналі" : "❌ Бот не доданий до каналу"}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
            
            <Alert className={verificationStatus.hasPermissions ? "border-green-500/50 bg-green-500/10" : "border-red-500/50 bg-red-500/10"}>
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${verificationStatus.hasPermissions ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={verificationStatus.hasPermissions ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}>
                    {verificationStatus.hasPermissions ? "✅ Бот має права адміністратора" : "❌ Недостатньо прав"}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </Card>
  );
};
