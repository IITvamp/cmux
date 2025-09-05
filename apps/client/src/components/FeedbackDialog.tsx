import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamSlugOrId: string;
}

export function FeedbackDialog({ open, onOpenChange, teamSlugOrId }: FeedbackDialogProps) {
  const submitFeedback = useMutation("feedback:submit");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      toast.error("Please enter your feedback.");
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        teamSlugOrId,
        message: trimmed,
        pageUrl: window.location.href,
      });
      toast.success("Thanks! Your feedback was sent.");
      setMessage("");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to send feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Feedback</DialogTitle>
          <DialogDescription>
            Tell us what’s working or what could be better. We’ll read every message.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your feedback here..."
            className="min-h-32 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={submitting}>
              {submitting ? "Sending…" : "Send Feedback"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
