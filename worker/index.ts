import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
  /**
   * Cron trigger (vite.config.ts, every 5 minutes): refreshes the most overdue watches so pages open with recent data.
   * REFRESH_BATCH watches per run (default 1, about 40 source requests, within the free plan's per-run request limit).
   */
  scheduled(_controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    // Loaded on demand: a static import would put the 15 MB catalog on every request's cold start.
    const run = async () => {
      const [{ findCatalogModel }, { runScheduledRefresh }] = await Promise.all([import("../lib/catalog"), import("../lib/market-archive/scheduled-refresh")]);
      return runScheduledRefresh(findCatalogModel, Math.min(10, Math.max(1, Number(env.REFRESH_BATCH) || 1)));
    };
    ctx.waitUntil(
      run().then(
        (r) => console.log(JSON.stringify({ event: "scheduled-refresh", ...r })),
        (e) => console.error(JSON.stringify({ event: "scheduled-refresh-failed", message: e instanceof Error ? e.message : String(e) })),
      ),
    );
  },
};

export default worker;
