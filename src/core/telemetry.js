// OpenTelemetry for the bot: traces, logs and metrics sent over OTLP to vdc-observability (Grafana).
// bot.js requires this before anything else, so the instrumentations can hook ioredis, prisma and
// undici before those are first loaded. Telemetry is on only when OTEL_EXPORTER_OTLP_ENDPOINT is set;
// otherwise every helper here is a no-op.

// MODULE REQUIREMENTS ----------------------------------------------------------------------------
const { trace, metrics, diag, DiagLogLevel, SpanKind, SpanStatusCode, TraceFlags, isSpanContextValid } = require(`@opentelemetry/api`);
const { logs, SeverityNumber } = require(`@opentelemetry/api-logs`);
const { NodeTracerProvider, BatchSpanProcessor, SamplingDecision } = require(`@opentelemetry/sdk-trace-node`);
const { defaultResource, resourceFromAttributes, detectResources, envDetector, hostDetector, processDetector } = require(`@opentelemetry/resources`);
const { LoggerProvider, BatchLogRecordProcessor } = require(`@opentelemetry/sdk-logs`);
const { MeterProvider, PeriodicExportingMetricReader } = require(`@opentelemetry/sdk-metrics`);
const { OTLPTraceExporter } = require(`@opentelemetry/exporter-trace-otlp-proto`);
const { OTLPLogExporter } = require(`@opentelemetry/exporter-logs-otlp-proto`);
const { OTLPMetricExporter } = require(`@opentelemetry/exporter-metrics-otlp-proto`);
const { registerInstrumentations } = require(`@opentelemetry/instrumentation`);
const { UndiciInstrumentation } = require(`@opentelemetry/instrumentation-undici`);
const { IORedisInstrumentation } = require(`@opentelemetry/instrumentation-ioredis`);
const { RuntimeNodeInstrumentation } = require(`@opentelemetry/instrumentation-runtime-node`);
const { PrismaInstrumentation } = require(`@prisma/instrumentation`);
// ################################################################################################


const SCOPE = `vdc-bot`;
const ENTRY_ATTRIBUTE = `vdc.entry`;

const enabled = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT) && !(/true/i).test(process.env.OTEL_SDK_DISABLED);

const SEVERITY = {
    VERBOSE: [SeverityNumber.DEBUG, `DEBUG`],
    DEBUG: [SeverityNumber.DEBUG, `DEBUG`],
    INFO: [SeverityNumber.INFO, `INFO`],
    WARNING: [SeverityNumber.WARN, `WARN`],
    ALERT: [SeverityNumber.WARN4, `WARN`],
    ERROR: [SeverityNumber.ERROR, `ERROR`],
};

// service.name and deployment.environment.name, honoring OTEL_SERVICE_NAME / OTEL_RESOURCE_ATTRIBUTES;
// also used to build Grafana links, so they point at this bot's own logs
const resourceOverrides = Object.fromEntries((process.env.OTEL_RESOURCE_ATTRIBUTES ?? ``).split(`,`).filter(Boolean).map((pair) => {
    const separator = pair.indexOf(`=`);
    return [pair.slice(0, separator).trim(), decodeURIComponent(pair.slice(separator + 1).trim())];
}));
const serviceName = process.env.OTEL_SERVICE_NAME || resourceOverrides[`service.name`] || `vdc-bot`;
const environment = resourceOverrides[`deployment.environment.name`] || (Boolean(Number(process.env.PROD)) ? `prod` : `dev`);

let tracerProvider, loggerProvider, meterProvider;

function start() {
    // export failures go to the container log; logger.log would loop them back into the exporter
    diag.setLogger({
        error: (...args) => console.error(`[otel]`, ...args),
        warn: (...args) => console.warn(`[otel]`, ...args),
        info: () => { }, debug: () => { }, verbose: () => { },
    }, DiagLogLevel.WARN);

    const resource = defaultResource()
        .merge(detectResources({ detectors: [hostDetector, processDetector, envDetector] }))
        .merge(resourceFromAttributes({ 'service.name': serviceName, 'deployment.environment.name': environment }));

    tracerProvider = new NodeTracerProvider({
        resource,
        sampler: entryPointSampler,
        // the span processor takes the exporter positionally, the log processor an options object
        spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
    });
    tracerProvider.register();

    loggerProvider = new LoggerProvider({ resource, processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })] });
    logs.setGlobalLoggerProvider(loggerProvider);

    meterProvider = new MeterProvider({
        resource,
        readers: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: 30_000 })],
    });
    metrics.setGlobalMeterProvider(meterProvider);

    registerInstrumentations({
        instrumentations: [
            new UndiciInstrumentation({ requestHook: redactRequestSpan }), // discord.js REST, fetch (numbers, web, Riot)
            new IORedisInstrumentation(),
            // keep the operation and the SQL; Prisma's serialization and connection spans are half of every trace
            new PrismaInstrumentation({ ignoreSpanTypes: [/serializ/, `prisma:engine:connection`] }),
            new RuntimeNodeInstrumentation(), // event loop delay & utilization, heap, GC
        ],
    });

    // the droplet has 1 GB of RAM, so watch the bot's real footprint, not just the V8 heap
    metrics.getMeter(SCOPE)
        .createObservableGauge(`process.memory.usage`, { unit: `By`, description: `Resident set size of the bot process` })
        .addCallback((result) => result.observe(process.memoryUsage.rss()));
}

/**
 * Keeps a trace only when it starts at one of our entry points (withSpan). Without this, every Prisma,
 * Redis and HTTP call made outside one (the matchmaker's 2s tick, gateway events) becomes its own trace.
 */
const entryPointSampler = {
    shouldSample(parentContext, traceId, spanName, spanKind, attributes) {
        const parent = trace.getSpanContext(parentContext);
        const keep = parent && isSpanContextValid(parent)
            ? (parent.traceFlags & TraceFlags.SAMPLED) === TraceFlags.SAMPLED
            : attributes?.[ENTRY_ATTRIBUTE] === true;
        return { decision: keep ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD };
    },
    toString: () => `EntryPointSampler`,
};

/** Secrets that ride in URLs: the meilisearch and Riot keys in query strings, and the tokens in
 *  Discord webhook / interaction paths (/webhooks/{id}/{token}, /interactions/{id}/{token}) */
function redactUrl(url) {
    return String(url)
        .replace(/(meiliauth|api_key)=[^&#]*/gi, `$1=REDACTED`)
        .replace(/\/(webhooks|interactions)\/(\d+)\/[^/?#]+/g, `/$1/$2/REDACTED`);
}

function redactRequestSpan(span, request) {
    const url = new URL(request.path, request.origin);
    span.setAttribute(`url.full`, redactUrl(url.toString()));
    span.setAttribute(`url.path`, redactUrl(url.pathname));
    if (url.search) span.setAttribute(`url.query`, redactUrl(url.search));
    span.updateName(requestSpanName(request.method, url));
}

/**
 * `GET discord.com /guilds/:id/members/:id` instead of a bare `GET`, so a trace shows which call was slow and
 * Tempo's span metrics give latency per route. IDs become `:id` to keep the names few. Only Discord and our own
 * hosts get their path; other hosts' paths can hold player names, so they get just the host.
 */
function requestSpanName(method, url) {
    const isDiscord = url.hostname === `discord.com`;
    if (!isDiscord && url.hostname !== `vdc.gg` && !url.hostname.endsWith(`.vdc.gg`)) return `${method} ${url.host}`;

    const path = redactUrl(url.pathname).replace(isDiscord ? /^\/api\/v\d+(?=\/)/ : /^$/, ``);
    const route = path.split(`/`).map((segment) => {
        if (segment === `REDACTED`) return `:token`;
        return /^\d+$/.test(segment) || segment.length >= 20 ? `:id` : segment;
    }).join(`/`);
    return `${method} ${url.host} ${route}`;
}

if (enabled) start();
const tracer = trace.getTracer(SCOPE);

/**
 * Run fn as a traced entry point: a command, a button, a worker run. Logs written inside it carry its
 * trace ID, and the Prisma, Redis and HTTP calls it makes show up as child spans.
 * @param {String} name span name; keep it low-cardinality (IDs go in attributes), since Tempo turns
 *                      each span name into its own rate / error / duration series
 * @param {Object} attributes span attributes
 * @param {(span: import('@opentelemetry/api').Span) => Promise<any>} fn
 * @param {{ kind?: SpanKind }} [options]
 */
function withSpan(name, attributes, fn, options = {}) {
    const spanOptions = { kind: options.kind ?? SpanKind.INTERNAL, attributes: { ...attributes, [ENTRY_ATTRIBUTE]: true } };
    return tracer.startActiveSpan(name, spanOptions, async (span) => {
        try {
            return await fn(span);
        } catch (error) {
            markError(span, error);
            throw error;
        } finally {
            span.end();
        }
    });
}

/** Mark a span (default: the active one) as failed, with the exception attached */
function markError(span = trace.getActiveSpan(), error, message) {
    if (!span?.isRecording()) return;
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: message ?? error?.message ?? String(error) });
}

/**
 * Send a logger.log() line to Loki. It's tied to the active trace automatically, and an ERROR inside a
 * traced command also marks that command's span as failed, even when the command caught the error itself.
 * @param {String} level logger level (INFO, ERROR, ...)
 * @param {String} message
 * @param {Error|String} [detail] the logger's stack argument: an Error, a stack string, or any extra detail
 */
function emitLog(level, message, detail, timestamp) {
    if (!enabled) return;
    const [severityNumber, severityText] = SEVERITY[level] ?? [SeverityNumber.INFO, `INFO`];
    const attributes = { 'vdc.level': level, ...detailAttributes(detail) };

    logs.getLogger(SCOPE).emit({ severityNumber, severityText, body: String(message), attributes, timestamp });

    if (level === `ERROR`) {
        const error = detail instanceof Error ? detail : { name: `Error`, message: String(message), stack: attributes[`exception.stacktrace`] };
        markError(trace.getActiveSpan(), error, String(message));
    }
}

function detailAttributes(detail) {
    if (detail === undefined || detail === null) return {};
    if (detail instanceof Error) return { 'exception.type': detail.name, 'exception.message': detail.message, 'exception.stacktrace': detail.stack };

    const text = String(detail);
    return /\n\s+at /.test(text) ? { 'exception.stacktrace': text } : { 'vdc.detail': text };
}

/**
 * Grafana link for a log line posted to Discord: the active trace when there is one, otherwise this bot's
 * logs in the minute around the line. null when telemetry is off or GRAFANA_URL isn't set.
 * @returns {{ label: `trace` | `logs`, url: String } | null}
 */
function grafanaLink(timestamp = Date.now()) {
    if (!enabled || !process.env.GRAFANA_URL) return null;

    const span = trace.getActiveSpan();
    const inTrace = Boolean(span?.isRecording());
    const pane = inTrace ? {
        datasource: `tempo`,
        queries: [{ refId: `A`, datasource: { type: `tempo`, uid: `tempo` }, queryType: `traceql`, query: span.spanContext().traceId }],
        range: { from: `now-6h`, to: `now` },
    } : {
        datasource: `loki`,
        queries: [{ refId: `A`, datasource: { type: `loki`, uid: `loki` }, expr: `{service_name="${serviceName}", deployment_environment_name="${environment}"}` }],
        range: { from: String(timestamp - 30_000), to: String(timestamp + 30_000) },
    };
    const url = `${process.env.GRAFANA_URL.replace(/\/$/, ``)}/explore?schemaVersion=1&orgId=1&panes=${encodeURIComponent(JSON.stringify({ a: pane }))}`;
    return { label: inTrace ? `trace` : `logs`, url };
}

/** Flush whatever is still buffered; call before exiting. Gives up after timeoutMs so shutdown can't hang. */
async function shutdownTelemetry(timeoutMs = 5000) {
    if (!enabled) return;
    const flushed = Promise.allSettled([tracerProvider.shutdown(), loggerProvider.shutdown(), meterProvider.shutdown()]);
    await Promise.race([flushed, new Promise((resolve) => setTimeout(resolve, timeoutMs).unref())]);
}

module.exports = { enabled, withSpan, markError, emitLog, grafanaLink, shutdownTelemetry, redactUrl, SpanKind };
