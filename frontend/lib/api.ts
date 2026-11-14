export interface HealthResponse {
  status: 'ok';
  service: string;
}

export async function checkHealth(): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch('/api/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error('Backend unavailable. Start the backend and try again.');
  }
  if (!response.ok) throw new Error('Backend unavailable. Start the backend and try again.');
  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'ok'
    || !('service' in data) || typeof data.service !== 'string') {
    throw new Error('The backend returned an unexpected response.');
  }
  return data as HealthResponse;
}
