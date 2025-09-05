import { Form, Input, Modal, Typography } from "antd";
import { useState } from "react";
import { Button } from "./button";

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FeedbackModal({ visible, onClose }: FeedbackModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: { type: string; message: string }) => {
    setLoading(true);
    try {
      // Create GitHub issue URL with pre-filled content
      const issueTitle = `[Feedback] ${values.type}`;
      const issueBody = values.message;
      const githubUrl = `https://github.com/manaflow-ai/cmux/issues/new?title=${encodeURIComponent(
        issueTitle
      )}&body=${encodeURIComponent(issueBody)}`;

      // Open GitHub in new tab
      window.open(githubUrl, "_blank", "noopener,noreferrer");

      // Show success state
      setSuccess(true);

      // Close after showing success message
      setTimeout(() => {
        onClose();
        form.resetFields();
        setSuccess(false);
      }, 2000);
    } catch (error) {
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
      width={480}
      centered
      closable={!success}
      title={!success ? "Send Feedback" : undefined}
    >
      <div className="py-2">
        {success ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <Title level={4} className="!mb-2">
              Thank you!
            </Title>

            <Paragraph className="text-neutral-500 dark:text-neutral-400">
              Your feedback has been sent to GitHub.
            </Paragraph>
          </div>
        ) : (
          <>
            <Paragraph className="text-neutral-500 dark:text-neutral-400 mb-4">
              Share your thoughts, report bugs, or suggest features. Your
              feedback will be submitted as a GitHub issue.
            </Paragraph>

            <Form
              form={form}
              onFinish={handleSubmit}
              layout="vertical"
              className="w-full"
              initialValues={{ type: "General Feedback" }}
            >
              <Form.Item
                name="type"
                label="Type"
                rules={[
                  { required: true, message: "Please select a feedback type" },
                ]}
              >
                <select
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="General Feedback">General Feedback</option>
                  <option value="Bug Report">Bug Report</option>
                  <option value="Feature Request">Feature Request</option>
                  <option value="Performance Issue">Performance Issue</option>
                  <option value="Documentation">Documentation</option>
                </select>
              </Form.Item>

              <Form.Item
                name="message"
                label="Message"
                rules={[
                  { required: true, message: "Please enter your feedback" },
                  {
                    min: 10,
                    message: "Please provide at least 10 characters",
                  },
                ]}
              >
                <TextArea
                  rows={6}
                  placeholder="Describe your feedback in detail..."
                  className="!rounded-md"
                  maxLength={1000}
                  showCount
                />
              </Form.Item>

              <div className="flex gap-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send to GitHub"}
                </Button>
              </div>
            </Form>
          </>
        )}
      </div>
    </Modal>
  );
}