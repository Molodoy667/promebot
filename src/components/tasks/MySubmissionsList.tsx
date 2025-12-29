import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Upload } from "lucide-react";
import { useState } from "react";
import { SubmitTaskDialog } from "./SubmitTaskDialog";
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
            <Card key={submission.id}>
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant={statusLabels[submission.status]?.variant}>
                    {statusLabels[submission.status]?.label}
                  </Badge>
                  <span className="text-lg font-bold text-primary">
                    {task.reward_amount.toFixed(2)} ₴
                  </span>
                </div>
                <CardTitle className="line-clamp-2">{task.title}</CardTitle>
                {timeRemaining && (
                  <CardDescription>
                    <Clock className="h-4 w-4 inline mr-1" />
                    {isExpired ? (
                      <span className="text-destructive font-medium">{timeRemaining}</span>
                    ) : (
                      <span>Залишилось: {timeRemaining}</span>
                    )}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent>
                {submission.review_comment && (
                  <div className="text-sm p-3 bg-muted rounded-lg">
                    <p className="font-medium mb-1">Коментар:</p>
                    <p className="text-muted-foreground">{submission.review_comment}</p>
                  </div>
                )}
              </CardContent>

              {(submission.status === "in_progress" || submission.status === "revision_requested") && !isExpired && (
                <CardFooter>
                  <Button 
                    className="w-full"
                    onClick={() => setSelectedSubmission({ ...submission, task })}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Подати звіт
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>

      {selectedSubmission && (
        <SubmitTaskDialog
          submission={selectedSubmission}
          open={!!selectedSubmission}
          onOpenChange={(open) => !open && setSelectedSubmission(null)}
        />
      )}
    </>
  );
};