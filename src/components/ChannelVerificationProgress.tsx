import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

interface VerificationStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'success' | 'error';
  errorMessage?: string;
}

interface ChannelVerificationProgressProps {
  steps: VerificationStep[];
  currentStep: number;
  totalSteps: number;
}

export const ChannelVerificationProgress = ({
  steps,
  currentStep,
  totalSteps
}: ChannelVerificationProgressProps) => {
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  const getStepIcon = (status: VerificationStep['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          Перевірка каналу
        </CardTitle>
        <CardDescription>
          Крок {currentStep} з {totalSteps}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {Math.round(progress)}% завершено
          </p>
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                step.status === 'in_progress'
                  ? 'bg-primary/10 border border-primary/30'
                  : step.status === 'success'
                  ? 'bg-success/5 border border-success/20'
                  : step.status === 'error'
                  ? 'bg-destructive/5 border border-destructive/20'
                  : 'bg-muted/30 border border-transparent'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getStepIcon(step.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      step.status === 'pending'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/20 text-primary'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <h4
                    className={`text-sm font-medium ${
                      step.status === 'pending'
                        ? 'text-muted-foreground'
                        : step.status === 'error'
                        ? 'text-destructive'
                        : 'text-foreground'
                    }`}
                  >
                    {step.title}
                  </h4>
                </div>
                
                <p
                  className={`text-xs mt-1 ${
                    step.status === 'pending'
                      ? 'text-muted-foreground'
                      : step.status === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.errorMessage || step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
