import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Upload } from "lucide-react";
import { useState } from "react";
import { MyTaskSubmissionDialog } from "./MyTaskSubmissionDialog";
import { differenceInMinutes, addHours } from "date-fns";

const statusLabels: Record<string, { label: string; variant: any }> = {
  in_progress: { label: "В процесі", variant: "secondary" },
  submitted: { label: "Очікує перевірки", variant: "default" },
  approved: { label: "Схвалено", variant: "default" },
  rejected: { label: "Відхилено", variant: "destructive" },
  revision_requested: { label: "На доопрацювання", variant: "secondary" },
};

export const MySubmissionsList = () => {
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("task_submissions")
        .select(`
          *,
          tasks (
            id,
            title,
            description,
            reward_amount,
            task_type,
            time_limit_hours,
            requires_screenshot
          )
        `)
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getTimeRemaining = (startedAt: string, timeLimitHours: number) => {
    const deadline = addHours(new Date(startedAt), timeLimitHours);
    const now = new Date();
    const minutesLeft = differenceInMinutes(deadline, now);
    
    if (minutesLeft <= 0) return "Час вийшов";
    
    const hours = Math.floor(minutesLeft / 60);
    const minutes = minutesLeft % 60;
    
    return `${hours}г ${minutes}хв`;
  };

  if (isLoading) {
    return <div className="text-center py-8">Завантаження...</div>;
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ви ще не взяли жодного завдання</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {submissions.map((submission: any) => {
          const task = submission.tasks;
          const timeRemaining = submission.status === "in_progress" 
            ? getTimeRemaining(submission.started_at, task.time_limit_hours)
            : null;
          const isExpired = timeRemaining === "Час вийшов";

          return (
            <Card 
              key={submission.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedSubmission({ ...submission, task })}
            >
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={statusLabels[submission.status]?.variant}>
                    {statusLabels[submission.status]?.label}
                  </Badge>
                  <span className="text-lg font-bold text-primary">
                    {task.reward_amount.toFixed(2)} ₴
                  </span>
                </div>
                <CardTitle className="line-clamp-1 text-base">{task.title}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">
                  {task.description}
                </CardDescription>
                {timeRemaining && (
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="h-4 w-4" />
                    {isExpired ? (
                      <span className="text-destructive font-medium text-sm">{timeRemaining}</span>
                    ) : (
                      <span className="text-sm">Залишилось: {timeRemaining}</span>
                    )}
                  </div>
                )}
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {selectedSubmission && (
        <MyTaskSubmissionDialog
          submission={selectedSubmission}
          open={!!selectedSubmission}
          onOpenChange={(open) => !open && setSelectedSubmission(null)}
        />
      )}
    </>
  );
};