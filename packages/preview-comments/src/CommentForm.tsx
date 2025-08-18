import React, { useState } from 'react';

interface CommentFormProps {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function CommentForm({ onSubmit, onCancel }: CommentFormProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSubmit(text.trim());
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cmux-space-y-3">
      <div>
        <label className="cmux-block cmux-text-sm cmux-font-medium cmux-text-neutral-700 cmux-mb-1">
          Add a comment
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="cmux-w-full cmux-px-3 cmux-py-2 cmux-border cmux-border-neutral-300 cmux-rounded-md cmux-text-sm focus:cmux-outline-none focus:cmux-ring-2 focus:cmux-ring-blue-500 focus:cmux-border-transparent"
          rows={4}
          placeholder="Type your comment..."
          autoFocus
        />
      </div>
      <div className="cmux-flex cmux-gap-2 cmux-justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="cmux-px-3 cmux-py-1.5 cmux-text-sm cmux-text-neutral-600 hover:cmux-text-neutral-900 cmux-transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!text.trim()}
          className="cmux-px-3 cmux-py-1.5 cmux-bg-blue-500 cmux-text-white cmux-text-sm cmux-rounded-md hover:cmux-bg-blue-600 disabled:cmux-opacity-50 disabled:cmux-cursor-not-allowed cmux-transition-colors"
        >
          Submit
        </button>
      </div>
    </form>
  );
}