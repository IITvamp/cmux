import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { Comment, CommentInput } from './types';
import { CommentsList } from './CommentsList';
import { CommentForm } from './CommentForm';
import { CommentMarker } from './CommentMarker';

interface CommentsFloatingWidgetProps {
  apiUrl: string;
  userId: string;
  userName: string;
}

export function CommentsFloatingWidget({
  apiUrl,
  userId,
  userName
}: CommentsFloatingWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [comments, setComments] = useState<Comment[]>([]);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Fetch comments on mount
  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleAddComment = () => {
    setIsAddingComment(true);
    setSelectedElement(null);
    
    // Add click listener to parent document
    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const target = e.target as HTMLElement;
      
      // Ignore clicks on the widget itself
      if (dragRef.current?.contains(target)) {
        return;
      }
      
      setSelectedElement(target);
      setIsAddingComment(false);
      
      // Remove the listener
      document.removeEventListener('click', handleClick, true);
    };
    
    // Use capture phase to intercept before other handlers
    setTimeout(() => {
      document.addEventListener('click', handleClick, true);
    }, 100);
  };

  const handleSubmitComment = async (text: string) => {
    if (!selectedElement) return;
    
    const rect = selectedElement.getBoundingClientRect();
    const nodeId = getNodeSelector(selectedElement);
    
    const commentData: CommentInput = {
      text,
      nodeId,
      x: rect.x / rect.width,
      y: rect.y / rect.height,
      page: window.location.pathname,
      pageTitle: document.title,
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      userId,
      userName,
      timestamp: new Date().toISOString()
    };
    
    try {
      const response = await fetch(`${apiUrl}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData)
      });
      
      if (response.ok) {
        const newComment = await response.json();
        setComments([...comments, newComment]);
        setSelectedElement(null);
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const getNodeSelector = (element: HTMLElement): string => {
    const path: string[] = [];
    let current: HTMLElement | null = element;
    
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `#${current.id}`;
      } else {
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            child => child.tagName === current!.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }
      }
      
      if (current.className) {
        selector += `.${current.className.split(' ').filter(Boolean).join('.')}`;
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    const cssSelector = 'body>' + path.join('>');
    const computedSelector = path.length > 0 ? cssSelector + ',' + 'body.' + element.className.split(' ').filter(Boolean).join('.') + '>' + path.join('>') : '';
    
    return computedSelector || cssSelector;
  };

  return (
    <>
      {/* Comment markers */}
      {comments.map(comment => (
        <CommentMarker key={comment.id} comment={comment} />
      ))}
      
      {/* Main widget */}
      <div
        ref={dragRef}
        className={clsx(
          'cmux-fixed cmux-bg-white cmux-rounded-lg cmux-shadow-2xl cmux-border cmux-border-neutral-200',
          isDragging && 'cmux-cursor-grabbing',
          'cmux-transition-transform'
        )}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: isOpen ? '360px' : 'auto',
          height: isOpen ? '480px' : 'auto',
          maxHeight: '80vh'
        }}
        onMouseDown={handleMouseDown}
      >
        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            className="cmux-p-3 cmux-cursor-pointer hover:cmux-bg-neutral-50 cmux-rounded-lg cmux-transition-colors"
            data-no-drag
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C13.19 22 14.34 21.78 15.41 21.39L21 23L19.39 17.41C20.78 15.34 22 13.19 22 12C22 6.48 17.52 2 12 2ZM7 11H17V13H7V11ZM7 7H17V9H7V7ZM7 15H13V17H7V15Z" fill="currentColor"/>
            </svg>
          </button>
        ) : (
          <div className="cmux-flex cmux-flex-col cmux-h-full">
            {/* Header */}
            <div className="cmux-flex cmux-items-center cmux-justify-between cmux-p-4 cmux-border-b cmux-border-neutral-200 cmux-cursor-grab">
              <h3 className="cmux-text-lg cmux-font-semibold cmux-text-neutral-900">Comments</h3>
              <div className="cmux-flex cmux-gap-2" data-no-drag>
                <button
                  onClick={handleAddComment}
                  className={clsx(
                    'cmux-p-2 cmux-rounded-md cmux-transition-colors',
                    isAddingComment 
                      ? 'cmux-bg-blue-500 cmux-text-white' 
                      : 'hover:cmux-bg-neutral-100'
                  )}
                  title="Add comment"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="cmux-p-2 hover:cmux-bg-neutral-100 cmux-rounded-md cmux-transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="cmux-flex-1 cmux-overflow-y-auto cmux-p-4" data-no-drag>
              {selectedElement ? (
                <CommentForm
                  onSubmit={handleSubmitComment}
                  onCancel={() => setSelectedElement(null)}
                />
              ) : isAddingComment ? (
                <div className="cmux-text-center cmux-py-8 cmux-text-neutral-500">
                  Click on an element to add a comment
                </div>
              ) : (
                <CommentsList comments={comments} />
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Visual feedback for selected element */}
      {selectedElement && (
        <div
          className="cmux-fixed cmux-border-2 cmux-border-blue-500 cmux-pointer-events-none cmux-z-[9998]"
          style={{
            left: selectedElement.getBoundingClientRect().left + 'px',
            top: selectedElement.getBoundingClientRect().top + 'px',
            width: selectedElement.getBoundingClientRect().width + 'px',
            height: selectedElement.getBoundingClientRect().height + 'px',
          }}
        />
      )}
    </>
  );
}