import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TaskSubmissionsReviewDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskSubmissionsReviewDialog = ({ task, open, onOpenChange }: TaskSubmissionsReviewDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectingSubmission, setRejectingSubmission] = useState<any>(null);
  const [rejectionComment, setRejectionComment] = useState("");

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["task-submissions-review", task?.id],
    queryFn: async () => {
      if (!task?.id) return [];

      const { data, error } = await supabase
        .from("task_submissions")
        .select(`
          *,
          profiles!task_submissions_user_id_fkey (
            telegram_username,
            full_name,
            avatar_url
          )
        `)
        .eq("task_id", task.id)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!task?.id && open,
  });

  const approveMutation = useMutation({
    mutationFn: async (submissionId: string) => {
      const { error } = await supabase
        .from("task_submissions")
        .update({ 
          status: "approved",
          reviewed_at: new Date().toISOString()
        })
        .eq("id", submissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Успішно", description: "Звіт схвалено" });
      queryClient.invalidateQueries({ queryKey: ["task-submissions-review", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ submissionId, comment }: { submissionId: string; comment: string }) => {
      if (!comment.trim()) {
        throw new Error("Коментар обов'язковий при відхиленні");
      }

      const { error } = await supabase
        .from("task_submissions")
        .update({ 
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          review_comment: comment
        })
        .eq("id", submissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Успішно", description: "Звіт відхилено" });
      setRejectingSubmission(null);
      setRejectionComment("");
      queryClient.invalidateQueries({ queryKey: ["task-submissions-review", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: (error: Error) => {
      toast({ title: "Помилка", description: error.message, variant: "destructive" });
    },
  });

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Звіти до завдання: {task.title}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8">Завантаження...</div>
        ) : !submissions || submissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Немає звітів для перегляду
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission: any) => (
              <div key={submission.id} className="border rounded-lg p-4 space-y-3">
                {/* User Info */}
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={submission.profiles?.avatar_url} />
                    <AvatarFallback>
                      {(submission.profiles?.telegram_username?.[0] || submission.profiles?.full_name?.[0] || "?").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {submission.profiles?.telegram_username || submission.profiles?.full_name || "Користувач"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(submission.submitted_at).toLocaleString("uk-UA")}
                    </p>
                  </div>
                </div>

                {/* Submission Details */}
                {submission.submission_comment && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-semibold mb-1">Коментар:</p>
                    <p className="text-sm">{submission.submission_comment}</p>
                  </div>
                )}

                {submission.screenshot_url && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Скріншот:</p>
                    <a 
                      href={submission.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img 
                        src={submission.screenshot_url}
                        alt="Screenshot"
                        className="max-h-64 rounded-lg border"
                      />
                    </a>
                  </div>
                )}

                {/* Actions */}
                {rejectingSubmission?.id === submission.id ? (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Вкажіть причину відхилення (обов'язково)"
                      value={rejectionComment}
                      onChange={(e) => setRejectionComment(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => rejectMutation.mutate({ submissionId: submission.id, comment: rejectionComment })}
                        disabled={!rejectionComment.trim() || rejectMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        Підтвердити відхилення
                      </Button>
                      <Button
                        onClick={() => {
                          setRejectingSubmission(null);
                          setRejectionComment("");
                        }}
                        variant="outline"
                      >
                        Скасувати
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => approveMutation.mutate(submission.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Схвалити
                    </Button>
                    <Button
                      onClick={() => setRejectingSubmission(submission)}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Відхилити
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
