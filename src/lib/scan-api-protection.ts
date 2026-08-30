export function checkOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function createRateLimiter(limit: number, windowMs: number) {
  const clients = new Map<string, { count: number; resetAt: number }>();
  return (client: string, now = Date.now()): boolean => {
    const current = clients.get(client);
    if (!current || now >= current.resetAt) {
      clients.set(client, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}

export async function readLimitedBody(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Ukuran permintaan terlalu besar");
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}
