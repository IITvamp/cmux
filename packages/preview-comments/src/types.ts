export interface Comment {
  id: string;
  text: string;
  nodeId: string;
  x: number;
  y: number;
  page: string;
  pageTitle: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  userId: string;
  userName: string;
  timestamp: string;
  resolved?: boolean;
}

export interface CommentInput extends Omit<Comment, 'id'> {}