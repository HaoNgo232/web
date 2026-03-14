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
  status: 'online' | 'offline';
  database?: 'connected' | 'disconnected';
  serviceStatus?: string;
  error?: string;
  timestamp?: string;
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
      name: 'api',
      url: process.env.API_API_URL || 'http://api.space-cmmoixmn-space-1.svc.cluster.local:3000',
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
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return { name: api.name, status: 'offline', error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      name: api.name,
      status: 'online',
      database: data.database ?? undefined,
      serviceStatus: data.status ?? undefined,
      timestamp: data.timestamp ?? undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return { name: api.name, status: 'offline', error: message };
  }
}

export default async function Home() {
  const apis = getApiServices();
  const results = await Promise.all(apis.map(fetchHealth));
  const appName = process.env.APP_NAME || 'web';

  async function handleRefresh() {
    'use server';
    revalidatePath('/');
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans dark:bg-black dark:text-zinc-50">
      <main className="mx-auto max-w-4xl space-y-8">
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
              {results.filter((r) => r.status === 'online').length}/{results.length} online
            </span>
          </div>

          {results.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((api) => (
                <div
                  key={api.name}
                  className="rounded-xl border bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-medium">{api.name}</h3>
                    <span
                      className={`inline-flex h-3 w-3 flex-shrink-0 rounded-full ${
                        api.status === 'online'
                          ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                          : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                      }`}
                    />
                  </div>

                  <div className="min-h-[4rem] text-sm text-zinc-600 dark:text-zinc-400">
                    {api.status === 'online' ? (
                      <div className="space-y-1">
                        <p>
                          Service:{' '}
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {api.serviceStatus ?? 'ok'}
                          </span>
                        </p>
                        <p>
                          Database:{' '}
                          <span
                            className={`font-medium ${
                              api.database === 'connected'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {api.database ?? 'unknown'}
                          </span>
                        </p>
                        {api.timestamp && (
                          <p className="text-xs text-zinc-400">
                            {new Date(api.timestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    ) : (
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
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-4 dark:border-zinc-800">
                    <span className="text-xs text-zinc-500">Traefik Route</span>
                    <a
                      href={`/api/${api.name}/health`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-500 hover:text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Test Ingress
                    </a>
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

        {/* Architecture info */}
        <section className="rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl font-semibold">How it works</h2>
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Trang nay la <strong>React Server Component</strong>. Data status duoc fetch
              phia server qua <strong>Kubernetes DNS noi bo</strong>.
            </p>
            <p>
              Link &quot;Test Ingress&quot; gui request tu browser qua{' '}
              <strong>Traefik IngressRoute</strong> (path-prefix routing).
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
