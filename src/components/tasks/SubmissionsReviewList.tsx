import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Eye } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface SubmissionsReviewListProps {
  submissions: any[];
  taskId: string;
  task: any;
}

const statusLabels: Record<string, { label: string; variant: any }> = {
  in_progress: { label: "� ������", variant: "secondary" },
  submitted: { label: "����� ��������", variant: "default" },
  approved: { label: "��������", variant: "default" },
  rejected: { label: "³�������", variant: "destructive" },
  revision_requested: { label: "�� �������������", variant: "secondary" },
};

export const SubmissionsReviewList = ({ submissions, taskId, task }: SubmissionsReviewListProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const reviewMutation = useMutation({
    mutationFn: async ({ 
      submissionId, 
      status, 
      comment,
      taskRewardAmount,
    }: { 
      submissionId: string; 
      status: string; 
      comment: string;
      taskRewardAmount: number;
    }) => {
      // Update submission status
      const { error: submissionError } = await supabase
        .from("task_submissions")
        .update({
          status,
          review_comment: comment,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (submissionError) throw submissionError;

      // If approved, use the approve_task_submission function
      // This will deduct from task budget and credit the user
      if (status === "approved") {
        const { error: approveError } = await supabase.rpc("approve_task_submission", {
          submission_id: submissionId,
          reward: taskRewardAmount,
        });

        if (approveError) throw approveError;
      }
    },
    onSuccess: (_, variables) => {
      const action = variables.status === "approved" ? "��������" : 
                     variables.status === "rejected" ? "��������" : "���������� �� �������������";
      toast({ title: "Успішно", description: `��� ${action}${variables.status === "approved" ? " �� ��������� ����������" : ""}` });
      queryClient.invalidateQueries({ queryKey: ["task-submissions", taskId] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setReviewComments((prev) => {
        const newComments = { ...prev };
        delete newComments[variables.submissionId];
        return newComments;
      });
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message || "������� ��� ������� ����", variant: "destructive" });
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  const handleReview = async (submission: any, status: string, task: any) => {
    const comment = reviewComments[submission.id] || "";
    
    // Check if task has enough budget for approval
    if (status === "approved") {
      if (!task.budget || task.budget < task.reward_amount) {
        toast({ title: "Помилка", description: "����������� ������� ��� ��������� ���������. �������� ������ ��������.", variant: "destructive" });
        return;
      }
    }
    
    setProcessingId(submission.id);
    await reviewMutation.mutateAsync({
      submissionId: submission.id,
      status,
      comment,
      taskRewardAmount: task.reward_amount,
    });
  };

  if (submissions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        ���� ���� ��������
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission: any) => (
        <Card key={submission.id}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{submission.profiles?.full_name || "����������"}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(submission.started_at), "d MMM yyyy, HH:mm", { locale: uk })}
                </p>
              </div>
              <Badge variant={statusLabels[submission.status]?.variant}>
                {statusLabels[submission.status]?.label}
              </Badge>
            </div>
          </CardHeader>

          {submission.status === "submitted" && (
            <>
              <CardContent className="space-y-3">
                {submission.report_text && (
                  <div>
                    <p className="text-sm font-medium mb-1">���:</p>
                    <p className="text-sm text-muted-foreground">{submission.report_text}</p>
                  </div>
                )}

                {submission.screenshot_url && (
                  <div>
                    <p className="text-sm font-medium mb-2">�������:</p>
                    <img 
                      src={submission.screenshot_url} 
                      alt="������� ���������" 
                      className="max-w-full h-auto rounded-lg border"
                    />
                  </div>
                )}

                <Textarea
                  placeholder="�������� �� �������� (�����������)"
                  value={reviewComments[submission.id] || ""}
                  onChange={(e) =>
                    setReviewComments((prev) => ({
                      ...prev,
                      [submission.id]: e.target.value,
                    }))
                  }
                />
              </CardContent>

              <CardFooter className="gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleReview(submission, "approved", task)}
                  disabled={processingId === submission.id}
                >
                  <Check className="h-4 w-4 mr-1" />
                  ��������
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleReview(submission, "revision_requested", task)}
                  disabled={processingId === submission.id}
                >
                  �� �������������
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleReview(submission, "rejected", task)}
                  disabled={processingId === submission.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  ³�������
                </Button>
              </CardFooter>
            </>
          )}

          {submission.status !== "submitted" && submission.status !== "in_progress" && (
            <CardContent>
              {submission.review_comment && (
                <div className="text-sm">
                  <p className="font-medium mb-1">��������:</p>
                  <p className="text-muted-foreground">{submission.review_comment}</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};


