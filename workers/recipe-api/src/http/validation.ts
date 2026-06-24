import type { Context } from "hono";
import { type ZodIssue, type ZodType, z } from "zod";

type ValidationDetail = {
  path: Array<string | number>;
  message: string;
};

function detailsFromIssues(issues: ZodIssue[]): ValidationDetail[] {
  return issues.map((issue) => ({
    path: issue.path.map((segment) =>
      typeof segment === "symbol" ? segment.toString() : segment,
    ),
    message: issue.message,
  }));
}

export function validationErrorResponse(c: Context, issues: ZodIssue[]) {
  return c.json(
    {
      error: "Invalid request body",
      details: detailsFromIssues(issues),
    },
    400,
  );
}

export function invalidJsonResponse(c: Context) {
  return c.json(
    {
      error: "Invalid JSON",
      details: [
        {
          path: [],
          message: "Request body must be valid JSON",
        },
      ],
    },
    400,
  );
}

export async function parseJsonBody<TSchema extends ZodType>(
  c: Context,
  schema: TSchema,
): Promise<
  | { success: true; data: z.infer<TSchema> }
  | { success: false; response: Response }
> {
  const body = await c.req.json().catch(() => undefined);
  if (body === undefined) {
    return {
      success: false,
      response: invalidJsonResponse(c),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: validationErrorResponse(c, result.error.issues),
    };
  }
  return { success: true, data: result.data };
}
