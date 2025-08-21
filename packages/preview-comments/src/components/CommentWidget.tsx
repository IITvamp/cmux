import React, { useState, useRef, useEffect } from 'react';
import { motion, useDragControls, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface Comment {
  id: string;
  text: string;
  timestamp: Date;
  author?: string;
}

interface CommentWidgetProps {
  onClose?: () => void;
  onSubmitComment?: (comment: string) => void;
  comments?: Comment[];
  position?: { x: number; y: number };
  className?: string;
}

export function CommentWidget({ 
  onClose, 
  onSubmitComment, 
  comments = [],
  position = { x: 20, y: 20 },
  className 
}: CommentWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [localComments, setLocalComments] = useState<Comment[]>(comments);
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalComments(comments);
  }, [comments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      const newComment: Comment = {
        id: Date.now().toString(),
        text: commentText,
        timestamp: new Date(),
        author: 'You'
      };
      setLocalComments([...localComments, newComment]);
      onSubmitComment?.(commentText);
      setCommentText('');
    }
  };

  const handleToggle = () => {
    if (isMinimized) {
      setIsMinimized(false);
    } else {
      setIsOpen(!isOpen);
    }
  };

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none" />
      
      <motion.div
        drag
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        initial={{ x: position.x, y: position.y }}
        className={cn(
          "fixed z-50 select-none",
          className
        )}
        style={{ touchAction: 'none' }}
      >
        <AnimatePresence mode="wait">
          {!isOpen ? (
            <motion.button
              key="closed"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleToggle}
              className="relative w-14 h-14 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full shadow-lg hover:shadow-xl transition-shadow pointer-events-auto flex items-center justify-center"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <MessageCircle className="w-6 h-6" />
              {localComments.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                  {localComments.length}
                </span>
              )}
            </motion.button>
          ) : (
            <motion.div
              key="open"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "bg-white dark:bg-neutral-900 rounded-lg shadow-2xl pointer-events-auto",
                isMinimized ? "w-64" : "w-80"
              )}
            >
              <div 
                className="flex items-center justify-between p-3 border-b border-neutral-200 dark:border-neutral-800 cursor-move"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <h3 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  Comments
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                  >
                    {isMinimized ? (
                      <Maximize2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                    ) : (
                      <Minimize2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onClose?.();
                    }}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {!isMinimized && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="max-h-96 overflow-y-auto p-3 space-y-3">
                      {localComments.length === 0 ? (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">
                          No comments yet. Be the first to comment!
                        </p>
                      ) : (
                        localComments.map((comment) => (
                          <div key={comment.id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                                {comment.author || 'Anonymous'}
                              </span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                {new Date(comment.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-700 dark:text-neutral-300">
                              {comment.text}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleSubmit} className="p-3 border-t border-neutral-200 dark:border-neutral-800">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 px-3 py-1.5 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-neutral-900 dark:text-neutral-100"
                        />
                        <button
                          type="submit"
                          disabled={!commentText.trim()}
                          className="p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}