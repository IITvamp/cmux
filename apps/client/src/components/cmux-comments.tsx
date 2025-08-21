import { api } from "@cmux/convex/api";
import { useMutation, useQuery } from "convex/react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const PlusIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="m12 5 0 14" />
  </svg>
);

const ImageIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

const TypeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" x2="15" y1="20" y2="20" />
    <line x1="12" x2="12" y1="4" y2="20" />
  </svg>
);

const MessageIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);

interface Comment {
  _id: string;
  url: string;
  page: string;
  pageTitle: string;
  nodeId: string;
  x: number;
  y: number;
  content: string;
  resolved?: boolean;
  userId: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  createdAt: number;
  updatedAt: number;
}

interface CommentMarkerProps {
  comment: Comment;
  onClick: () => void;
}

function CommentMarker({ comment, onClick }: CommentMarkerProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [showContent, setShowContent] = useState(true);

  useEffect(() => {
    const updatePosition = () => {
      try {
        let el: HTMLElement | null = null;

        // Check if it's an XPath (starts with /) or old CSS selector
        if (comment.nodeId.startsWith("/")) {
          // It's an XPath
          const result = document.evaluate(
            comment.nodeId,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          el = result.singleNodeValue as HTMLElement;
        } else {
          // Old CSS selector - try to handle it
          try {
            el = document.querySelector(comment.nodeId) as HTMLElement;
          } catch (_e) {
            // Try escaping for old Tailwind classes
            const escapedSelector = comment.nodeId.replace(/([:])/g, "\\$1");
            try {
              el = document.querySelector(escapedSelector) as HTMLElement;
            } catch (_e2) {
              console.warn(
                `Could not find element with CSS selector: ${comment.nodeId}`
              );
            }
          }
        }

        if (el) {
          const rect = el.getBoundingClientRect();
          const x = rect.left + rect.width * comment.x;
          const y = rect.top + rect.height * comment.y;
          setPosition({ x, y });
        } else {
          setPosition(null);
        }
      } catch (e) {
        console.error(
          "Failed to find element for comment:",
          e,
          "NodeId:",
          comment.nodeId
        );
        setPosition(null);
      }
    };

    // Update position initially
    updatePosition();

    // Update position on scroll and resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    // Update position when DOM changes
    const observer = new MutationObserver(updatePosition);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      observer.disconnect();
    };
  }, [comment.nodeId, comment.x, comment.y]);

  if (!position) return null;

  return (
    <>
      {/* Comment marker dot */}
      <div
        className="fixed w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white cursor-pointer shadow-lg z-[9999] transition-all duration-200 hover:scale-110"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${position.x - 16}px, ${position.y - 16}px)`,
        }}
        onClick={() => setShowContent(!showContent)}
      >
        <MessageIcon />
      </div>
      
      {/* Comment content bubble */}
      {showContent && (
        <div
          className="fixed z-[9998] rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${Math.min(position.x + 24, window.innerWidth - 320)}px, ${position.y - 16}px)`,
            width: "300px",
            background: "rgba(17, 17, 17, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div className="p-3">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                U
              </div>
              <div className="flex-1">
                <p className="text-sm text-white break-words">
                  {comment.content}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {new Date(comment.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContent(false);
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-neutral-400 hover:bg-neutral-800 transition-all"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function CmuxComments() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({
    x: window.innerWidth / 2 - 190, // Center horizontally (380px width / 2)
    y: window.innerHeight / 2 - 250, // Center vertically (approximate height)
  });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [commentDraft, setCommentDraft] = useState("");
  const [commentInputPos, setCommentInputPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingCommentData, setPendingCommentData] = useState<{
    url: string;
    page: string;
    pageTitle: string;
    nodeId: string;
    x: number;
    y: number;
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
  } | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [forceShow, setForceShow] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const comments = useQuery(api.comments.listComments, {
    url: window.location.origin,
    page: window.location.pathname,
  });

  const createComment = useMutation(api.comments.createComment);

  // Handle cursor tracking when commenting
  useEffect(() => {
    if (!isCommenting) return;

    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [isCommenting]);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Option+C on Mac produces "ç", so we check for that
      if (e.key === "ç") {
        e.preventDefault();
        setForceShow(true);
        setIsOpen(true);
      }
      // Regular C to enter comment mode
      else if (e.key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setIsCommenting(true);
        }
      }
      if (e.key === "Escape") {
        setIsCommenting(false);
        setPendingCommentData(null);
        setCommentInputPos(null);
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Handle single click commenting
  useEffect(() => {
    if (!isCommenting) return;

    const handleClick = async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const element = e.target as HTMLElement;

      // Don't create comments on the comment widgets themselves
      if (element.closest("[data-cmux-comment-widget]")) return;

      const rect = element.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Generate XPath for the element
      const getXPath = (el: Element): string => {
        if (el.id) {
          return `//*[@id="${el.id}"]`;
        }

        const paths: string[] = [];
        let current: Element | null = el;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
          let index = 0;
          let sibling = current.previousSibling;

          while (sibling) {
            if (
              sibling.nodeType === Node.ELEMENT_NODE &&
              sibling.nodeName === current.nodeName
            ) {
              index++;
            }
            sibling = sibling.previousSibling;
          }

          const tagName = current.nodeName.toLowerCase();
          const pathIndex = index > 0 ? `[${index + 1}]` : "";
          paths.unshift(`${tagName}${pathIndex}`);

          current = current.parentElement;
        }

        return "/" + paths.join("/");
      };

      const nodeId = getXPath(element);

      // Store the comment data
      const commentData = {
        url: window.location.origin,
        page: window.location.pathname,
        pageTitle: document.title,
        nodeId,
        x,
        y,
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      };

      setPendingCommentData(commentData);
      setCommentInputPos({ x: e.clientX, y: e.clientY });
      setIsCommenting(false);

      // Focus the input after it renders
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 50);
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [isCommenting]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".widget-header")) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleSubmitComment = async () => {
    if (!pendingCommentData || !commentDraft.trim()) return;

    await createComment({
      ...pendingCommentData,
      content: commentDraft,
      userId: "anonymous", // You'd get this from auth
    });

    setCommentDraft("");
    setPendingCommentData(null);
    setCommentInputPos(null);
  };

  const handleCancelComment = () => {
    setCommentDraft("");
    setPendingCommentData(null);
    setCommentInputPos(null);
  };

  // Only render if NOT on localhost:5173 OR if force shown with Option+C
  const shouldRender = () => {
    const hostname = window.location.hostname;
    const port = window.location.port;
    const isLocalhost5173 = hostname === "localhost" && port === "5173";
    return !isLocalhost5173 || forceShow;
  };

  if (!shouldRender()) {
    return null;
  }

  return createPortal(
    <>
      {/* Comment markers */}
      {comments?.map((comment: Comment) => (
        <CommentMarker
          key={comment._id}
          comment={comment}
          onClick={() => {
            setIsOpen(true);
            setForceShow(true);
          }}
        />
      ))}

      {/* Cursor indicator when in commenting mode - simple tooltip */}
      {isCommenting && (
        <div
          className="fixed z-[10000] pointer-events-none"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${cursorPos.x + 10}px, ${cursorPos.y - 10}px)`,
          }}
        >
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm shadow-lg animate-pulse">
            Click to comment
          </div>
        </div>
      )}

      {/* Comment input popup */}
      {commentInputPos && pendingCommentData && (
        <div
          className="fixed z-[10000] rounded-2xl shadow-2xl backdrop-blur-md"
          data-cmux-comment-widget="true"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${Math.min(commentInputPos.x - 50, window.innerWidth - 420)}px, ${Math.min(commentInputPos.y + 20, window.innerHeight - 200)}px)`,
            width: "400px",
            background: "rgba(17, 17, 17, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Avatar placeholder */}
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                  U
                </div>
              </div>

              {/* Input area */}
              <div className="flex-1">
                <textarea
                  ref={commentInputRef}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Start a new thread..."
                  className="w-full bg-transparent border-none outline-none text-white placeholder-gray-500 resize-none"
                  style={{ minHeight: "60px", fontSize: "15px" }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      handleSubmitComment();
                    }
                    if (e.key === "Escape") {
                      handleCancelComment();
                    }
                  }}
                />

                {/* Bottom toolbar */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1">
                    <button className="w-8 h-8 rounded-lg hover:bg-neutral-800 text-neutral-400 flex items-center justify-center transition-all">
                      <PlusIcon />
                    </button>
                    <button className="w-8 h-8 rounded-lg hover:bg-neutral-800 text-neutral-400 flex items-center justify-center transition-all">
                      <ImageIcon />
                    </button>
                    <div className="w-px h-5 bg-neutral-700 mx-1"></div>
                    <button className="w-8 h-8 rounded-lg hover:bg-neutral-800 text-neutral-400 flex items-center justify-center transition-all">
                      <TypeIcon />
                    </button>
                  </div>

                  {/* Send button */}
                  <button
                    onClick={handleSubmitComment}
                    disabled={!commentDraft.trim()}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                      commentDraft.trim()
                        ? "bg-neutral-800 hover:bg-neutral-700"
                        : "bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 100 64"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <linearGradient
                          id="cmuxGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop
                            offset="0%"
                            stopColor={
                              commentDraft.trim() ? "#00D4FF" : "#666666"
                            }
                          />
                          <stop
                            offset="100%"
                            stopColor={
                              commentDraft.trim() ? "#7C3AED" : "#666666"
                            }
                          />
                        </linearGradient>
                      </defs>
                      <polygon
                        fill="url(#cmuxGradient)"
                        points="0,0 68,32 0,64 0,48 40,32 0,16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating widget */}
      <div
        ref={widgetRef}
        data-cmux-comment-widget="true"
        className={`fixed z-[999999] rounded-2xl shadow-2xl backdrop-blur-md ${
          isOpen
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{
          left: 0,
          top: 0,
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: "380px",
          background: "rgba(17, 17, 17, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div
          className="widget-header flex items-center justify-between p-4 cursor-move select-none border-b"
          style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}
        >
          <h3 className="text-base font-medium text-white">Comments</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-800 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="space-y-3">
            {comments?.length === 0 ? (
              <p className="text-neutral-400 text-sm text-center py-8">
                No comments yet. Press "C" to add one!
              </p>
            ) : (
              comments?.map((comment: Comment) => (
                <div key={comment._id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                    U
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white break-words">
                      {comment.content}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 hover:scale-110 z-[9999]"
        >
          <MessageIcon />
        </button>
      )}
    </>,
    document.body
  );
}
