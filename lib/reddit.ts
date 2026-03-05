import axios from "axios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RedditToken {
  access_token: string;
  expires_at: number; // Unix ms; refresh when Date.now() >= this
}

export interface RedditPostResult {
  url: string;  // e.g. "https://www.reddit.com/r/pittsburgh/comments/abc123/..."
  name: string; // Reddit fullname, e.g. "t3_abc123"
}

// ── In-memory token cache ─────────────────────────────────────────────────────

let _cachedToken: RedditToken | null = null;

function getRedditEnv() {
  const clientId = process.env.REDDIT_CLIENT_ID ?? "";
  const clientSecret = process.env.REDDIT_CLIENT_SECRET ?? "";
  const username = process.env.REDDIT_USERNAME ?? "";
  const password = process.env.REDDIT_PASSWORD ?? "";
  const userAgent =
    process.env.REDDIT_USER_AGENT ?? "arcane-city-admin:v1.0";

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error(
      "Missing Reddit env vars: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD"
    );
  }

  return { clientId, clientSecret, username, password, userAgent };
}

async function fetchAccessToken(): Promise<RedditToken> {
  const { clientId, clientSecret, username, password, userAgent } =
    getRedditEnv();

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const params = new URLSearchParams({
    grant_type: "password",
    username,
    password,
  });

  const res = await axios.post<{ access_token: string; expires_in: number }>(
    "https://www.reddit.com/api/v1/access_token",
    params.toString(),
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
      },
      timeout: 10000,
    }
  );

  return {
    access_token: res.data.access_token,
    // 60s buffer so we proactively refresh before actual expiry
    expires_at: Date.now() + (res.data.expires_in - 60) * 1000,
  };
}

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expires_at) {
    return _cachedToken.access_token;
  }
  _cachedToken = await fetchAccessToken();
  return _cachedToken.access_token;
}

// ── Post submission ───────────────────────────────────────────────────────────

export async function submitSelfPost(params: {
  subreddit: string;  // Without "r/" prefix
  title: string;
  body: string;       // Reddit markdown
  resubmit?: boolean; // Default true; prevents "already submitted" errors
}): Promise<RedditPostResult> {
  const { userAgent } = getRedditEnv();
  const token = await getAccessToken();

  const formData = new URLSearchParams({
    sr: params.subreddit,
    kind: "self",
    title: params.title,
    text: params.body,
    resubmit: String(params.resubmit ?? true),
  });

  const res = await axios.post<{
    json: {
      errors: [string, string, string][];
      data: { url: string; name: string };
    };
  }>("https://oauth.reddit.com/api/submit", formData.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    timeout: 15000,
  });

  // Reddit wraps errors inside a 200 response body — must check explicitly
  const { errors, data } = res.data.json;
  if (errors?.length) {
    throw new Error(
      `Reddit submission error: ${errors.map((e) => e[1]).join(", ")}`
    );
  }
  if (!data?.url) {
    throw new Error("Reddit returned no post URL");
  }

  return { url: data.url, name: data.name };
}
