const NEON_DATA_API_URL =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_NEON_DATA_API_URL ?? "").replace(/\/$/, "")
    : "";
const NEON_DATA_API_KEY =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_NEON_DATA_API_KEY ?? "" : "";

let cachedToken: string | null = null;

async function getToken(): Promise<string | null> {
  if (NEON_DATA_API_KEY) return NEON_DATA_API_KEY;
  const res = await fetch("/api/neon-token");
  if (!res.ok) return null;
  const data = await res.json();
  const token = data?.token;
  if (typeof token === "string") {
    cachedToken = token;
    return token;
  }
  return null;
}

export function isNeonDataApiConfigured(): boolean {
  return Boolean(NEON_DATA_API_URL);
}

export async function fetchRandomSitesFromNeon(limit: number): Promise<string[]> {
  if (!NEON_DATA_API_URL) return [];
  let token = cachedToken ?? (await getToken());
  const url = `${NEON_DATA_API_URL}/rpc/get_random_sites`;
  const doFetch = (t: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ lim: Math.min(Math.max(1, limit), 30) }),
    });
  let res = token ? await doFetch(token) : null;
  if (res?.status === 401 && !NEON_DATA_API_KEY) {
    cachedToken = null;
    token = await getToken();
    if (token) res = await doFetch(token);
  }
  if (!res?.ok) return [];
  const data = await res.json();
  if (Array.isArray(data)) return data.filter((u): u is string => typeof u === "string");
  return [];
}
