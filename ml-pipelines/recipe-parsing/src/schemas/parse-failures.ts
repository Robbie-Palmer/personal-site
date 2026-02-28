import { z } from "zod";

export const ParseAttemptErrorSchema = z.object({
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

export const ParseFailureEntrySchema = z.object({
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
  attemptErrors: z.array(ParseAttemptErrorSchema).optional(),
});

export const ParseFailuresDatasetSchema = z.object({
  entries: z.array(ParseFailureEntrySchema),
});

export type ParseFailuresDataset = z.infer<typeof ParseFailuresDatasetSchema>;
