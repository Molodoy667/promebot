import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, TestTube, CheckCircle2, XCircle, AlertCircle, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

interface AIServiceSettings {
  id: string;
  service_name: string;
  provider: string;
  api_endpoint: string;
  api_key: string;
  model_name: string;
  is_active: boolean;
  test_status: string | null;
  test_message: string | null;
  test_last_run: string | null;
}

export default function AIServicesPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  
  const [textService, setTextService] = useState<AIServiceSettings | null>(null);
  const [imageService, setImageService] = useState<AIServiceSettings | null>(null);
  const [chatService, setChatService] = useState<AIServiceSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('ai_service_settings')
        .select('*')
        .in('service_name', ['text_generation', 'image_generation', 'ai_chat']);

      if (error) throw error;

      if (data) {
        const text = data.find(s => s.service_name === 'text_generation');
        const image = data.find(s => s.service_name === 'image_generation');
        const chat = data.find(s => s.service_name === 'ai_chat');
        
        setTextService(text || null);
        setImageService(image || null);
        setChatService(chat || null);
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (serviceName: string) => {
    try {
      setSaving(true);
      
      const service = serviceName === 'text_generation' ? textService : 
                      serviceName === 'image_generation' ? imageService : chatService;
      if (!service) return;

      const { error } = await supabase
        .from('ai_service_settings')
        .upsert({
          id: service.id,
          service_name: service.service_name,
          provider: service.provider,
          api_endpoint: service.api_endpoint,
          api_key: service.api_key,
          model_name: service.model_name,
          is_active: service.is_active,
        });

      if (error) throw error;

      toast({
        title: "Успішно",
        description: "Налаштування збережено",
      });
      
      await loadSettings();
    } catch (error: any) {
      console.error('Error saving:', error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (serviceName: string) => {
    try {
      setTesting(serviceName);
      
      const service = serviceName === 'text_generation' ? textService : 
                      serviceName === 'image_generation' ? imageService : chatService;
      if (!service) return;

      console.log('Testing service:', serviceName);
      console.log('Endpoint:', service.api_endpoint);
      console.log('Model:', service.model_name);

      // Test the API endpoint
      const testPrompt = serviceName === 'text_generation' || serviceName === 'ai_chat'
        ? "Привіт! Це тестове повідомлення."
        : "Generate a test image";

      // Check if this is Vertex AI
      const isVertexAI = service.provider?.toLowerCase().includes('vertex') || 
                         service.api_endpoint?.includes('aiplatform.googleapis.com');
      const isImagenAPI = serviceName === 'image_generation' && isVertexAI;

      let apiUrl = service.api_endpoint;
      let requestBody: any;
      let requestHeaders: any = {
        'Content-Type': 'application/json',
      };

      if (isVertexAI) {
        // Vertex AI тестується тільки через Edge Function (OAuth)
        const testMessage = `⚠️ Vertex AI тестується через Edge Function
        
Пряме тестування з браузера неможливе через OAuth 2.0.
Але якщо генерація постів/чат працює - все налаштовано правильно!

Endpoint: ${service.api_endpoint}
Model: ${service.model_name}`;

        await supabase
          .from('ai_service_settings')
          .update({
            test_status: 'info',
            test_message: testMessage,
            last_tested_at: new Date().toISOString()
          })
          .eq('id', service.id);

        toast({
          title: "ℹ️ Vertex AI",
          description: "Використовуйте генерацію постів або чат для перевірки",
        });
        
        setTesting(null);
        return;
      }

      // OpenAI/Generic format
      requestHeaders['Authorization'] = `Bearer ${service.api_key}`;
      
      requestBody = {
        model: service.model_name,
        messages: [
          {
            role: 'user',
            content: testPrompt
          }
        ],
        ...(serviceName === 'image_generation' && {
          modalities: ['image', 'text']
        })
      };

      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      console.log('API URL:', apiUrl.replace(/key=[^&]+/, 'key=***'));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      let responseData: any;
      let testMessage: string;
      let result: string | null = null;
      const testStatus = response.ok ? 'success' : 'failed';

      try {
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        if (responseText) {
          responseData = JSON.parse(responseText);
        } else {
          responseData = { error: { message: 'Пустий response від API' } };
        }
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        responseData = { error: { message: 'Неможливо розпарсити відповідь API' } };
      }

      if (response.ok) {
        testMessage = `✅ API працює!\nСтатус: ${response.status}\nМодель: ${service.model_name}\nПровайдер: ${service.provider}`;
        
        // Log success details
        if (isImagenAPI) {
          // Google image response format
          if (responseData.predictions?.[0]?.bytesBase64Encoded) {
            console.log('Vertex AI Imagen: Image data received');
          } else if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
            // Vertex AI Gemini text response
            result = `✅ Відповідь отримано:\n\n${responseData.candidates[0].content.parts[0].text}`;
          } else if (responseData.generatedImages?.[0]?.imageBytes) {
            console.log('Gemini API: Image data received');
          }
        } else {
          // OpenAI format
          if (responseData.choices && responseData.choices.length > 0) {
            const content = responseData.choices[0].message?.content;
            if (content) {
              console.log('Generated content preview:', content.substring(0, 100));
            }
          }
        }
      } else {
        // Detailed error message
        const errorDetails = [];
        errorDetails.push(`❌ HTTP ${response.status}: ${response.statusText}`);
        
        if (responseData.error) {
          if (responseData.error.message) {
            errorDetails.push(`Повідомлення: ${responseData.error.message}`);
          }
          if (responseData.error.type) {
            errorDetails.push(`Тип: ${responseData.error.type}`);
          }
          if (responseData.error.code) {
            errorDetails.push(`Код: ${responseData.error.code}`);
          }
        } else if (responseData.message) {
          errorDetails.push(`Повідомлення: ${responseData.message}`);
        }
        
        // Add endpoint info
        errorDetails.push(`\nEndpoint: ${service.api_endpoint}`);
        errorDetails.push(`Model: ${service.model_name}`);
        
        testMessage = errorDetails.join('\n');
        console.error('Test failed:', testMessage);
      }

      // Update test status in database
      await supabase
        .from('ai_service_settings')
        .update({
          test_status: testStatus,
          test_message: testMessage,
          test_last_run: new Date().toISOString(),
        })
        .eq('id', service.id);

      toast({
        title: testStatus === 'success' ? "Тест успішний ✅" : "Тест провалився ❌",
        description: testMessage.split('\n')[0], // First line for toast
        variant: testStatus === 'success' ? "default" : "destructive",
      });

      await loadSettings();
    } catch (error: any) {
      console.error('Exception during test:', error);
      
      const service = serviceName === 'text_generation' ? textService : 
                      serviceName === 'image_generation' ? imageService : chatService;
      
      const isVertexAI = !!service && (
        service.provider?.toLowerCase().includes('vertex') ||
        service.api_endpoint?.includes('aiplatform.googleapis.com')
      );
      
      // Special handling for Google API CORS errors
      let errorMessage = `❌ Помилка з'єднання:\n${error.message}\n\nПеревірте:\n- Правильність URL\n- Доступність API\n- Інтернет з'єднання`;
      
      if (error.message.includes('Failed to fetch') && isVertexAI) {
        errorMessage = `⚠️ CORS обмеження від Vertex AI\n\nТест з браузера неможливий через CORS політику Google Cloud.\n\nАле генерація ПРАЦЮВАТИМЕ через Edge Function!\n\nПеревірте:\n1. Endpoint: aiplatform.googleapis.com правильний\n2. Access Token (Bearer) правильний\n3. Project ID та Region правильні\n4. Спробуйте реальну генерацію в додатку`;
      }
      
      if (service) {
        await supabase
          .from('ai_service_settings')
          .update({
            test_status: 'failed',
            test_message: errorMessage,
            test_last_run: new Date().toISOString(),
          })
          .eq('id', service.id);
      }

      toast({
        title: "Помилка тесту",
        description: error.message,
        variant: "destructive",
      });
      
      await loadSettings();
    } finally {
      setTesting(null);
    }
  };

  const updateService = (serviceName: string, field: keyof AIServiceSettings, value: any) => {
    if (serviceName === 'text_generation' && textService) {
      setTextService({ ...textService, [field]: value });
    } else if (serviceName === 'image_generation' && imageService) {
      setImageService({ ...imageService, [field]: value });
    } else if (serviceName === 'ai_chat' && chatService) {
      setChatService({ ...chatService, [field]: value });
    }
  };

  const renderServiceCard = (service: AIServiceSettings | null, title: string, description: string) => {
    if (!service) return null;

    const isTextService = service.service_name === 'text_generation';

    return (
      <Card className="p-6 glass-effect border-border/50">
        <div className="space-y-6">
          <div>
            <h3 className="text-base md:text-lg font-bold">{title}</h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{description}</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex-1">
              <Label className="text-sm md:text-base">Активний</Label>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Використовувати цей сервіс для генерації
              </p>
            </div>
            <Switch
              checked={service.is_active}
              onCheckedChange={(checked) =>
                updateService(service.service_name, 'is_active', checked)
              }
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`provider-${service.service_name}`} className="text-sm md:text-base">
                Провайдер
              </Label>
              <Input
                id={`provider-${service.service_name}`}
                value={service.provider}
                onChange={(e) =>
                  updateService(service.service_name, 'provider', e.target.value)
                }
                placeholder="vertex-ai, openai, anthropic, custom"
                className="text-sm md:text-base w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`endpoint-${service.service_name}`} className="text-sm md:text-base">
                API Endpoint
              </Label>
              <Input
                id={`endpoint-${service.service_name}`}
                value={service.api_endpoint}
                onChange={(e) =>
                  updateService(service.service_name, 'api_endpoint', e.target.value)
                }
                placeholder="https://api.megallm.io/v1/chat/completions"
                className="text-sm md:text-base font-mono w-full break-all"
              />
              <p className="text-xs text-muted-foreground break-words">
                {service.service_name === 'image_generation' 
                  ? 'Vertex AI Imagen: https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict'
                  : 'Vertex AI Gemini: https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1/publishers/google/models/gemini-1.5-flash:generateContent'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`key-${service.service_name}`} className="text-sm md:text-base">
                {service.provider?.toLowerCase().includes('vertex') 
                  ? 'Service Account JSON' 
                  : 'API Key'}
              </Label>
              <textarea
                id={`key-${service.service_name}`}
                value={service.api_key}
                onChange={(e) =>
                  updateService(service.service_name, 'api_key', e.target.value)
                }
                placeholder={service.provider?.toLowerCase().includes('vertex')
                  ? '{"type": "service_account", "project_id": "...", "private_key": "...", ...}'
                  : 'sk-... або ваш ключ'}
                className="text-sm md:text-base font-mono w-full break-all border rounded-md p-2 min-h-[120px] bg-background"
                rows={6}
              />
              {service.provider?.toLowerCase().includes('vertex') && (
                <p className="text-xs text-muted-foreground">
                  Вставте повний JSON з Google Cloud Console → Service Accounts → Keys
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`model-${service.service_name}`} className="text-sm md:text-base">
                Модель
              </Label>
              <Input
                id={`model-${service.service_name}`}
                value={service.model_name}
                onChange={(e) =>
                  updateService(service.service_name, 'model_name', e.target.value)
                }
                placeholder="gpt-4, claude-3, gemini-pro"
                className="text-sm md:text-base w-full"
              />
            </div>
          </div>

          {service.test_status && (
            <Alert variant={service.test_status === 'success' ? 'default' : 'destructive'}>
              <div className="flex items-start gap-2">
                {service.test_status === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                ) : service.test_status === 'failed' ? (
                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <AlertDescription>
                    <div className="font-medium mb-1 text-xs md:text-sm">
                      {service.test_status === 'success' ? '✅ Тест успішний' : '❌ Тест провалився'}
                    </div>
                    <div className="text-xs md:text-sm whitespace-pre-wrap break-words font-mono">
                      {service.test_message}
                    </div>
                    {service.test_last_run && (
                      <div className="text-xs mt-2 text-muted-foreground">
                        Останній тест: {new Date(service.test_last_run).toLocaleString('uk-UA', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
            <Button
              onClick={() => handleSave(service.service_name)}
              disabled={saving || testing !== null}
              className="flex-1 text-sm md:text-base"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Збереження...</span>
                  <span className="sm:hidden">Збереження</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Зберегти
                </>
              )}
            </Button>

            <Button
              onClick={() => handleTest(service.service_name)}
              disabled={!service.api_key || testing !== null || saving}
              variant="outline"
              className="flex-1 text-sm md:text-base"
            >
              {testing === service.service_name ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Тестування...</span>
                  <span className="sm:hidden">Тест</span>
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Протестувати</span>
                  <span className="sm:hidden">Тест</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <PageBreadcrumbs />
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">AI Сервіси</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Налаштування AI провайдерів для генерації текстів та зображень
          </p>
        </div>
        
        <Button
          onClick={() => navigate('/admin/category-prompts')}
          variant="outline"
          className="shrink-0"
        >
          <FileText className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Промти категорій</span>
          <span className="sm:hidden">Промти</span>
        </Button>
      </div>

      <Alert className="border-blue-500/50 bg-blue-500/10">
        <AlertCircle className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm">
          <strong>Важливо:</strong> Після зміни налаштувань рекомендується протестувати підключення.
          Якщо сервіс активний, він буде використовуватись для всіх AI Bot сервісів.<br/><br/>
          <strong>Google Imagen:</strong> Тест може провалитися через CORS, але реальна генерація працюватиме через серверну функцію.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {renderServiceCard(
          textService,
          "Генерація текстів",
          "AI сервіс для створення постів та контенту"
        )}
        
        {renderServiceCard(
          imageService,
          "Генерація зображень",
          "AI сервіс для створення ілюстрацій до постів"
        )}
      </div>

      <div className="grid gap-6">
        {renderServiceCard(
          chatService,
          "AI Чат",
          "AI сервіс для спілкування з користувачами в чаті"
        )}
      </div>
    </div>
  );
}
