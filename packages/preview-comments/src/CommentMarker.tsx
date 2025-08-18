import React, { useEffect, useState } from 'react';
import { Comment } from './types';

interface CommentMarkerProps {
  comment: Comment;
}

export function CommentMarker({ comment }: CommentMarkerProps) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Try to find the element using the nodeId selector
    try {
      const selectors = comment.nodeId.split(',');
      let targetElement: Element | null = null;
      
      for (const selector of selectors) {
        targetElement = document.querySelector(selector.trim());
        if (targetElement) break;
      }
      
      if (targetElement && targetElement instanceof HTMLElement) {
        setElement(targetElement);
        updatePosition(targetElement);
      }
    } catch (error) {
      console.error('Failed to find element for comment:', error);
    }
  }, [comment.nodeId]);

  useEffect(() => {
    if (!element) return;

    const updatePos = () => updatePosition(element);
    
    // Update position on scroll/resize
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [element]);

  const updatePosition = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width * comment.x,
      y: rect.top + rect.height * comment.y
    });
  };

  if (!position) return null;

  return (
    <div
      className="cmux-fixed cmux-w-6 cmux-h-6 cmux-bg-blue-500 cmux-rounded-full cmux-border-2 cmux-border-white cmux-shadow-lg cmux-z-[9997] cmux-cursor-pointer hover:cmux-scale-110 cmux-transition-transform"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)'
      }}
      title={comment.text}
    >
      <span className="cmux-flex cmux-items-center cmux-justify-center cmux-h-full cmux-text-white cmux-text-xs cmux-font-bold">
        {comment.id.slice(0, 2)}
      </span>
    </div>
  );
}