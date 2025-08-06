import type { Context, Next } from 'hono';

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);
    
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = error instanceof Error && 'status' in error ? (error as any).status : 500;
    
    return c.json({
      success: false,
      error: message,
    }, status);
  }
}