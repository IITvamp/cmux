import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@cmux/convex/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitFeedback = useMutation(api.feedback.submitFeedback);

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      toast.error("Please enter your feedback");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback({ message: feedback.trim() });
      toast.success("Thank you for your feedback! We'll review it shortly.");
      setFeedback("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve Cmux by sharing your thoughts, suggestions, or reporting issues.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            placeholder="Tell us what's on your mind..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="min-h-[150px] resize-none"
            disabled={isSubmitting}
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Your feedback will be sent to the Cmux team along with your email address for follow-up.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !feedback.trim()}
          >
            {isSubmitting ? "Sending..." : "Send Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}