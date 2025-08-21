'use client';

import React, { useState, useEffect } from 'react';
import { CommentWidget } from '@cmux/preview-comments';

export function PreviewCommentsProvider() {
  const [comments, setComments] = useState<Array<{ id: string; text: string; timestamp: Date; author?: string }>>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmitComment = (comment: string) => {
    console.log('New comment submitted:', comment);
    // Here you can add logic to send the comment to a backend API
  };

  const handleClose = () => {
    console.log('Comment widget closed');
  };

  if (!mounted) {
    return null;
  }

  return (
    <CommentWidget 
      onClose={handleClose}
      onSubmitComment={handleSubmitComment}
      comments={comments}
      position={{ x: window.innerWidth - 100, y: window.innerHeight - 100 }}
    />
  );
}