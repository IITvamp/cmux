import { z } from "zod";

export const codeEvaluationSchema = z.object({
  score: z.number().min(0).max(100).describe("Overall score from 0-100"),
  codeQuality: z.number().min(0).max(100).describe("Code quality, readability, and maintainability score"),
  adherenceToRequirements: z.number().min(0).max(100).describe("How well the code meets the task requirements"),
  testCoverage: z.number().min(0).max(100).describe("Test coverage and quality of tests"),
  performance: z.number().min(0).max(100).describe("Performance considerations and optimization"),
  security: z.number().min(0).max(100).describe("Security best practices and vulnerability assessment"),
  reasoning: z.string().describe("Detailed explanation of the evaluation and scoring"),
});

export type CodeEvaluation = z.infer<typeof codeEvaluationSchema>;

export const codeReviewRequestSchema = z.object({
  taskDescription: z.string().describe("The original task description"),
  agentOutputs: z.array(
    z.object({
      agentName: z.string().describe("Name of the agent (e.g., Claude Sonnet, GPT-4)"),
      diff: z.string().describe("Git diff of the changes"),
      terminalLog: z.string().describe("Terminal output from the agent"),
    })
  ),
});

export type CodeReviewRequest = z.infer<typeof codeReviewRequestSchema>;

export const codeReviewResponseSchema = z.object({
  evaluations: z.array(
    z.object({
      agentName: z.string(),
      evaluation: codeEvaluationSchema,
    })
  ),
  winner: z.object({
    agentName: z.string(),
    reasoning: z.string().describe("Why this agent's solution was chosen as the best"),
  }),
});

export type CodeReviewResponse = z.infer<typeof codeReviewResponseSchema>;