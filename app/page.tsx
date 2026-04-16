/**
 * Trang Dashboard chinh cua Scaffold Frontend
 *
 * File nay la OVERLAY .hbs — Plop se render va OVERWRITE page.tsx goc.
 * API services list duoc hardcode luc gen-time tu apiDependencies.
 * Neu muon them API sau, set env var API_SERVICES (JSON) de override.
 *
 * Handlebars vars:
 *   apiDependencies: array of name+port — danh sach API services
 *   namespace: K8s namespace
 *   frontendName: ten frontend service
 */

export const dynamic = 'force-dynamic';
import { revalidatePath } from 'next/cache';

// Interface cho config API service
interface ApiServiceConfig {
  name: string;
  url: string;
}

// Interface cho ket qua health check
interface HealthResult {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  database?: 'connected' | 'disconnected';
  serviceStatus?: string;
  itemsCount?: number;
  error?: string;
  timestamp?: string;
}

// Interface cho items data
interface ItemData {
  id: number;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

interface ItemsResult {
  name: string;
  items: ItemData[];
  total: number;
  error?: string;
}

interface ApiHealthPayload {
  status?: string;
  database?: 'connected' | 'disconnected';
  itemsCount?: number;
  timestamp?: string;
}

function normalizeHealthPayload(payload: unknown): ApiHealthPayload {
  if (typeof payload !== 'object' || payload === null) {
    return {};
  }

  const value = payload as Record<string, unknown>;
  const normalizedDatabase =
    value.database === 'connected' || value.database === 'disconnected'
      ? value.database
      : undefined;
  const normalizedStatus = typeof value.status === 'string' ? value.status.toLowerCase() : undefined;
  const normalizedTimestamp = typeof value.timestamp === 'string' ? value.timestamp : undefined;
  const normalizedItemsCount = typeof value.itemsCount === 'number' ? value.itemsCount : undefined;

  return {
    status: normalizedStatus,
    database: normalizedDatabase,
    itemsCount: normalizedItemsCount,
    timestamp: normalizedTimestamp,
  };
}

function getDotClass(status: HealthResult['status']): string {
  if (status === 'online') {
    return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
  }

  if (status === 'degraded') {
    return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
  }

  return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
}

function getServiceStatusClass(serviceStatus: string | undefined): string {
  if (serviceStatus === 'ok') {
    return 'text-green-600 dark:text-green-400';
  }

  if (serviceStatus === 'degraded') {
    return 'text-amber-600 dark:text-amber-400';
  }

  return 'text-zinc-600 dark:text-zinc-300';
}

function getStatusBadgeClass(status: string): string {
  if (status === 'active') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  }
  if (status === 'pending') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }
  return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
}

/**
 * Lay danh sach API services
 * Uu tien: env var API_SERVICES (runtime override) > hardcoded list (gen-time)
 */
function getApiServices(): ApiServiceConfig[] {
  // Runtime override: cho phep them/bot API service ma khong can re-gen
  const envOverride = process.env.API_SERVICES;
  if (envOverride) {
    try {
      const parsed = JSON.parse(envOverride);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      console.error('[Dashboard] Failed to parse API_SERVICES env var');
    }
  }

  // Hardcoded list — Plop inject luc gen-time
  return [
    {
      name: 'order-api',
      url: process.env.SVC_ORDER_API_URL || 'http://cmnzn5wi4000139eag6m6kh4i-project-2-order-api.space-cmnzn5wi-space-1.svc.cluster.local:3000',
    },
    {
      name: 'user-api',
      url: process.env.SVC_USER_API_URL || 'http://cmnzn5wi4000139eag6m6kh4i-project-2-user-api.space-cmnzn5wi-space-1.svc.cluster.local:3000',
    },
  ];
}

/**
 * Fetch health check cua 1 API service
 * Timeout 3 giay de tranh block render qua lau
 */
async function fetchHealth(api: ApiServiceConfig): Promise<HealthResult> {
  try {
    const res = await fetch(`${api.url}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { name: api.name, status: 'offline', error: `HTTP ${res.status}` };
    }

    const data: unknown = await res.json();
    const normalized = normalizeHealthPayload(data);
    const serviceStatus = normalized.status ?? 'unknown';
    const isDegraded = serviceStatus === 'degraded' || normalized.database === 'disconnected';

    return {
      name: api.name,
      status: isDegraded ? 'degraded' : 'online',
      database: normalized.database,
      serviceStatus,
      itemsCount: normalized.itemsCount,
      timestamp: normalized.timestamp,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return { name: api.name, status: 'offline', error: message };
  }
}

/**
 * Fetch items data tu 1 API service (public endpoint, khong can auth)
 */
async function fetchItems(api: ApiServiceConfig): Promise<ItemsResult> {
  try {
    const res = await fetch(`${api.url}/api/items/public`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { name: api.name, items: [], total: 0, error: `HTTP ${res.status}` };
    }

    const data = await res.json() as { items?: ItemData[]; total?: number };
    return {
      name: api.name,
      items: Array.isArray(data.items) ? data.items : [],
      total: typeof data.total === 'number' ? data.total : 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return { name: api.name, items: [], total: 0, error: message };
  }
}

export default async function Home() {
  const apis = getApiServices();
  const [healthResults, itemsResults] = await Promise.all([
    Promise.all(apis.map(fetchHealth)),
    Promise.all(apis.map(fetchItems)),
  ]);
  const appName = process.env.APP_NAME || 'web';
  const onlineCount = healthResults.filter((r) => r.status === 'online').length;
  const degradedCount = healthResults.filter((r) => r.status === 'degraded').length;
  const offlineCount = healthResults.filter((r) => r.status === 'offline').length;

  async function handleRefresh() {
    'use server';
    revalidatePath('/');
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black dark:text-zinc-50">
      <main className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <header className="border-b pb-4 dark:border-zinc-800">
          <h1 className="text-2xl font-bold">{appName}</h1>
          <p className="mt-1 text-sm text-zinc-500">Scaffold Dashboard</p>
        </header>

        {/* API Services Status */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">API Services</h2>
              <form action={handleRefresh}>
                <button
                  type="submit"
                  className="rounded-md border bg-white px-3 py-1 text-sm font-medium shadow-sm hover:bg-zinc-50 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
>
                  Refresh
                </button>
              </form>
            </div>
            <span className="text-sm text-zinc-500">
              {onlineCount} online · {degradedCount} degraded · {offlineCount} offline
            </span>
          </div>

          {healthResults.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {healthResults.map((api) => (
                <div
                  key={api.name}
                  className="rounded-xl border bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-medium">{api.name}</h3>
                    <span className={`inline-flex h-3 w-3 shrink-0 rounded-full ${getDotClass(api.status)}`} />
                  </div>

                  <div className="min-h-16 text-sm text-zinc-600 dark:text-zinc-400">
                    {api.status === 'offline' ? (
                      <div className="space-y-1">
                        <p>
                          Status:{' '}
                          <span className="font-medium text-red-600 dark:text-red-400">
                            Offline
                          </span>
                        </p>
                        <p className="truncate text-xs text-red-500" title={api.error}>
                          {api.error}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p>
                          API:{' '}
                          <span className={`font-medium ${getServiceStatusClass(api.serviceStatus)}`}>
                            {api.serviceStatus ?? 'ok'}
                          </span>
                        </p>
                        <p>
                          Database:{' '}
                          <span
                            className={`font-medium ${
                              api.database === 'connected'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
>
                            {api.database ?? 'unknown'}
                          </span>
                        </p>
                        {typeof api.itemsCount === 'number' && (
                          <p>
                            DB Records:{' '}
                            <span className="font-medium text-blue-600 dark:text-blue-400">
                              {api.itemsCount}
                            </span>
                          </p>
                        )}
                        {api.timestamp && (
                          <p className="text-xs text-zinc-400">
                            {new Date(api.timestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border-t pt-4 dark:border-zinc-800">
                    <span className="text-xs text-zinc-500">
                      {api.status === 'online' ? 'Connected via internal DNS' : 'Unreachable'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-zinc-500 dark:border-zinc-800">
              <p>Chua co API service nao duoc cau hinh.</p>
            </div>
          )}
        </section>

        {/* DB Data Section — chứng minh UI ↔ API ↔ DB connectivity */}
        {itemsResults.some((r) => r.items.length > 0) && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Database Records</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Auto-seeded data fetched from API services to verify full-stack connectivity.
              </p>
            </div>

            <div className="space-y-6">
              {itemsResults.map((result) => (
                <div key={result.name} className="rounded-xl border bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between border-b px-6 py-4 dark:border-zinc-800">
                    <h3 className="font-medium">{result.name}</h3>
                    <span className="text-sm text-zinc-500">
                      {result.error ? (
                        <span className="text-red-500">{result.error}</span>
                      ) : (
                        `${result.total} records`
                      )}
                    </span>
                  </div>

                  {result.items.length > 0 ? (
                    <div className="divide-y dark:divide-zinc-800">
                      {result.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-4 px-6 py-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {item.id}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{item.title}</p>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(item.status)}`}>
                                {item.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-6 py-8 text-center text-sm text-zinc-500">
                      No items found
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Connectivity Proof Banner */}
        {healthResults.some((r) => r.status === 'online' && r.database === 'connected') &&
          itemsResults.some((r) => r.items.length > 0) && (
          <section className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white text-lg">
                ✓
              </span>
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">
                  Full Stack Connectivity Verified
                </p>
                <p className="text-sm text-green-700 dark:text-green-400">
                  Frontend → API Service → PostgreSQL Database — all layers are connected and data is flowing.
                </p>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}