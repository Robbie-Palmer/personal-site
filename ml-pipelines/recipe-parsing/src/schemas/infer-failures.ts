import { z } from "zod";

export const InferAttemptErrorSchema = z.object({
  attempt: z.number().int().positive(),
  retryable: z.boolean().optional(),
  errorType: z.string().min(1),
  errorMessage: z.string().min(1),
  statusCode: z.number().int().optional(),
  requestId: z.string().optional(),
  providerErrorType: z.string().optional(),
  providerErrorCode: z.string().optional(),
  providerErrorParam: z.string().optional(),
  providerErrorBody: z.unknown().optional(),
  causeMessage: z.string().optional(),
});

export const InferFailureEntrySchema = z.object({
  images: z.array(z.string().min(1)).min(1),
  attemptCount: z.number().int().positive(),
  model: z.string().optional(),
  errorType: z.string().min(1),
  errorMessage: z.string().min(1),
  statusCode: z.number().int().optional(),
  requestId: z.string().optional(),
  causeMessage: z.string().optional(),
  providerErrorType: z.string().optional(),
  providerErrorCode: z.string().optional(),
  providerErrorParam: z.string().optional(),
  providerErrorBody: z.unknown().optional(),
  attemptErrors: z.array(InferAttemptErrorSchema).optional(),
});

export const InferFailuresDatasetSchema = z.object({
  entries: z.array(InferFailureEntrySchema),
});

export type InferFailuresDataset = z.infer<typeof InferFailuresDatasetSchema>;
