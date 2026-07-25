import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Context,
  type Span,
} from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
} from "@opentelemetry/semantic-conventions";

const DEFAULT_OTLP_BASE_URL = "https://eu.i.posthog.com";

export type PostHogObservabilityEnv = {
  POSTHOG_KEY?: string;
  POSTHOG_OTLP_BASE_URL?: string;
  DEPLOYMENT_ENV?: string;
};

export type TraceCarrier = {
  traceparent: string;
  tracestate?: string;
};

export type TraceIdentity = {
  posthogDistinctId?: string;
  sessionId?: string;
};

type WaitUntilContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type TelemetryState = {
  serviceName: string;
  traceProvider: BasicTracerProvider;
  logProvider: LoggerProvider;
};

let telemetryState: TelemetryState | undefined;
let globalsRegistered = false;

const headerGetter = {
  get(carrier: Headers, key: string): string | undefined {
    return carrier.get(key) ?? undefined;
  },
  keys(carrier: Headers): string[] {
    return Array.from(carrier.keys());
  },
};

const recordGetter = {
  get(carrier: TraceCarrier, key: string): string | undefined {
    if (key === "traceparent") return carrier.traceparent;
    if (key === "tracestate") return carrier.tracestate;
    return undefined;
  },
  keys(carrier: TraceCarrier): string[] {
    return carrier.tracestate
      ? ["traceparent", "tracestate"]
      : ["traceparent"];
  },
};

function normalizedBaseUrl(env: PostHogObservabilityEnv): string {
  return (env.POSTHOG_OTLP_BASE_URL || DEFAULT_OTLP_BASE_URL).replace(/\/+$/, "");
}

function registerGlobals(
  traceProvider: BasicTracerProvider,
  logProvider: LoggerProvider,
): void {
  if (globalsRegistered) return;

  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(traceProvider);
  logs.setGlobalLoggerProvider(logProvider);
  globalsRegistered = true;
}

function getTelemetry(
  env: PostHogObservabilityEnv,
  serviceName: string,
): TelemetryState | undefined {
  const projectToken = env.POSTHOG_KEY?.trim();
  if (!projectToken) return undefined;

  if (telemetryState) {
    if (telemetryState.serviceName !== serviceName) {
      throw new Error(
        `OpenTelemetry already initialized for ${telemetryState.serviceName}; cannot reinitialize it for ${serviceName}`,
      );
    }
    return telemetryState;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
      env.DEPLOYMENT_ENV || "production",
  });
  const headers = { Authorization: `Bearer ${projectToken}` };
  const baseUrl = normalizedBaseUrl(env);

  const traceProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [
      new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: `${baseUrl}/i/v1/traces`,
          headers,
        }),
      ),
    ],
  });
  const logProvider = new LoggerProvider({
    resource,
    processors: [
      new SimpleLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${baseUrl}/i/v1/logs`,
          headers,
        }),
      }),
    ],
  });

  telemetryState = { serviceName, traceProvider, logProvider };
  registerGlobals(traceProvider, logProvider);
  return telemetryState;
}

function identityAttributes(identity: TraceIdentity): Attributes {
  return {
    posthogDistinctId: identity.posthogDistinctId,
    sessionId: identity.sessionId,
  };
}

function emitLog(
  state: TelemetryState,
  severityNumber: SeverityNumber,
  severityText: string,
  body: string,
  attributes: Attributes,
  logContext: Context = context.active(),
): void {
  state.logProvider.getLogger(state.serviceName).emit({
    severityNumber,
    severityText,
    body,
    attributes,
    context: logContext,
  });
}

function recordFailure(
  span: Span,
  state: TelemetryState,
  error: unknown,
  attributes: Attributes,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const errorType =
    error instanceof Error && error.name ? error.name : "UnknownError";
  span.recordException(error instanceof Error ? error : new Error(message));
  span.setStatus({ code: SpanStatusCode.ERROR, message });
  emitLog(state, SeverityNumber.ERROR, "ERROR", message, {
    ...attributes,
    "error.type": errorType,
    "error.message": message,
  });
}

async function flushTelemetry(state: TelemetryState): Promise<void> {
  // Telemetry must never become a new failure mode for the application.
  await Promise.allSettled([
    state.traceProvider.forceFlush(),
    state.logProvider.forceFlush(),
  ]);
}

async function flushAfter(
  state: TelemetryState,
  waitUntil?: WaitUntilContext,
): Promise<void> {
  const flush = flushTelemetry(state);
  if (waitUntil) {
    waitUntil.waitUntil(flush);
  } else {
    await flush;
  }
}

export function traceIdentityFromHeaders(headers: Headers): TraceIdentity {
  return {
    posthogDistinctId: headers.get("x-posthog-distinct-id") ?? undefined,
    sessionId: headers.get("x-posthog-session-id") ?? undefined,
  };
}

export function injectTraceContext(headers: Headers): Headers {
  propagation.inject(context.active(), headers, {
    set(carrier, key, value) {
      carrier.set(key, value);
    },
  });
  return headers;
}

export function currentTraceCarrier(): TraceCarrier | undefined {
  const carrier: Partial<TraceCarrier> = {};
  propagation.inject(context.active(), carrier, {
    set(target, key, value) {
      if (key === "traceparent") target.traceparent = value;
      if (key === "tracestate") target.tracestate = value;
    },
  });
  return carrier.traceparent
    ? {
        traceparent: carrier.traceparent,
        ...(carrier.tracestate ? { tracestate: carrier.tracestate } : {}),
      }
    : undefined;
}

export async function withPostHogRequest<T extends Response>(
  options: {
    env: PostHogObservabilityEnv;
    serviceName: string;
    spanName: string;
    request: Request;
    waitUntil?: WaitUntilContext;
    attributes?: Attributes;
  },
  operation: () => Promise<T>,
): Promise<T> {
  const state = getTelemetry(options.env, options.serviceName);
  if (!state) return operation();

  const identity = traceIdentityFromHeaders(options.request.headers);
  const attributes: Attributes = {
    "http.request.method": options.request.method,
    "url.path": new URL(options.request.url).pathname,
    ...identityAttributes(identity),
    ...options.attributes,
  };
  const parentContext = propagation.extract(
    ROOT_CONTEXT,
    options.request.headers,
    headerGetter,
  );
  const tracer = state.traceProvider.getTracer(options.serviceName);

  return tracer.startActiveSpan(
    options.spanName,
    { kind: SpanKind.SERVER, attributes },
    parentContext,
    async (span) => {
      try {
        const response = await operation();
        span.setAttribute("http.response.status_code", response.status);
        if (response.status >= 500) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${response.status}`,
          });
        }
        emitLog(
          state,
          response.status >= 500 ? SeverityNumber.ERROR : SeverityNumber.INFO,
          response.status >= 500 ? "ERROR" : "INFO",
          `${options.request.method} ${new URL(options.request.url).pathname}`,
          { ...attributes, "http.response.status_code": response.status },
        );
        return response;
      } catch (error) {
        recordFailure(span, state, error, attributes);
        throw error;
      } finally {
        span.end();
        await flushAfter(state, options.waitUntil);
      }
    },
  );
}

export async function withPostHogSpan<T>(
  options: {
    env: PostHogObservabilityEnv;
    serviceName: string;
    spanName: string;
    traceCarrier?: TraceCarrier;
    kind?: SpanKind;
    waitUntil?: WaitUntilContext;
    attributes?: Attributes;
  },
  operation: (span: Span) => Promise<T>,
): Promise<T> {
  const state = getTelemetry(options.env, options.serviceName);
  if (!state) {
    const span = trace.getTracer(options.serviceName).startSpan("noop");
    try {
      return await operation(span);
    } finally {
      span.end();
    }
  }

  const parentContext = options.traceCarrier
    ? propagation.extract(ROOT_CONTEXT, options.traceCarrier, recordGetter)
    : context.active();
  const tracer = state.traceProvider.getTracer(options.serviceName);

  return tracer.startActiveSpan(
    options.spanName,
    {
      kind: options.kind ?? SpanKind.INTERNAL,
      attributes: options.attributes,
    },
    parentContext,
    async (span) => {
      try {
        const result = await operation(span);
        emitLog(
          state,
          SeverityNumber.INFO,
          "INFO",
          options.spanName,
          options.attributes ?? {},
        );
        return result;
      } catch (error) {
        recordFailure(span, state, error, options.attributes ?? {});
        throw error;
      } finally {
        span.end();
        await flushAfter(state, options.waitUntil);
      }
    },
  );
}

export { SpanKind };
