import { z } from 'zod';

export const PreviewConfigSchema = z.object({
  gitUrl: z.string().url(),
  branch: z.string(),
  prNumber: z.number().optional(),
  hasDevcontainer: z.boolean().default(false),
  startupScript: z.string().optional(),
});

export type PreviewConfig = z.infer<typeof PreviewConfigSchema>;

export const PreviewStatusSchema = z.enum([
  'creating',
  'running',
  'paused',
  'error',
  'terminated'
]);

export type PreviewStatus = z.infer<typeof PreviewStatusSchema>;

export interface PreviewEnvironment {
  id: string;
  config: PreviewConfig;
  status: PreviewStatus;
  morphInstanceId?: string;
  snapshotId?: string;
  urls?: {
    vscode: string;
    worker: string;
    preview?: string;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
  pausedAt?: Date;
}

export const CreatePreviewRequestSchema = PreviewConfigSchema;

export const PreviewResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export type PreviewResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};