import { useState } from "react";
import { Modal, Form, Input, Typography } from "antd";
import { useConvex } from "convex/react";
import { Button } from "./button";

const { Title, Paragraph } = Typography;

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  teamSlugOrId: string;
}

export function FeedbackModal({ visible, onClose, teamSlugOrId }: FeedbackModalProps) {
  const convex = useConvex();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: { message: string; email?: string }) => {
    setLoading(true);
    try {
      await convex.mutation("feedback:submit", {
        teamSlugOrId,
        message: values.message,
        email: values.email ?? undefined,
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        form.resetFields();
        setSuccess(false);
      }, 1400);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error submitting feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={!success ? onClose : undefined}
      footer={null}
      width={520}
      centered
      closable={!success}
    >
      <div className="flex flex-col items-stretch py-2">
        {success ? (
          <div className="flex flex-col items-center text-center py-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <Title level={3} className="!mb-2">
              Thanks for the feedback!
            </Title>
            <Paragraph className="text-neutral-500 dark:text-neutral-400">
              We received your message.
            </Paragraph>
          </div>
        ) : (
          <>
            <Title level={3} className="!mb-2">
              Send Feedback
            </Title>
            <Paragraph className="text-neutral-500 dark:text-neutral-400 mb-4">
              Share bugs, ideas, or anything else. We read every note.
            </Paragraph>
            <Form form={form} onFinish={handleSubmit} layout="vertical">
              <Form.Item
                name="message"
                label={<span className="text-neutral-800 dark:text-neutral-200">Message</span>}
                rules={[{ required: true, message: "Please enter your feedback" }]}
              >
                <Input.TextArea
                  rows={6}
                  placeholder="What can we improve?"
                  className="!rounded-md"
                />
              </Form.Item>
              <Form.Item
                name="email"
                label={
                  <span className="text-neutral-800 dark:text-neutral-200">
                    Contact email (optional)
                  </span>
                }
              >
                <Input placeholder="you@example.com" className="!rounded-md" />
              </Form.Item>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={loading}>
                  {loading ? "Sending..." : "Send"}
                </Button>
              </div>
            </Form>
          </>
        )}
      </div>
    </Modal>
  );
}

