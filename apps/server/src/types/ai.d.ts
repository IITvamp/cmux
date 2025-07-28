declare module 'ai' {
  export function generateObject(options: any): Promise<{ object: any }>;
}

declare module '@ai-sdk/anthropic' {
  export function anthropic(model: string): any;
}