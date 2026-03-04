"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const ENV_VARS = [
  {
    name: "ARCANE_CITY_API_URL",
    description: "Arcane City API base URL",
    example: "https://arcane.city",
    required: true,
  },
  {
    name: "ARCANE_CITY_API_KEY",
    description: "Bearer token (preferred over username/password)",
    example: "your_api_key",
    required: false,
    sensitive: true,
  },
  {
    name: "ARCANE_CITY_USERNAME",
    description: "Basic auth username (fallback if no API key)",
    example: "your_username",
    required: false,
  },
  {
    name: "ARCANE_CITY_PASSWORD",
    description: "Basic auth password (fallback if no API key)",
    example: "your_password",
    required: false,
    sensitive: true,
  },
  {
    name: "ANTHROPIC_API_KEY",
    description: "Anthropic Claude API key",
    example: "sk-ant-...",
    required: true,
    sensitive: true,
  },
];

const ENV_TEMPLATE = `# Arcane City API
ARCANE_CITY_API_URL=https://arcane.city

# Preferred: bearer token auth
ARCANE_CITY_API_KEY=your_api_key

# Fallback: basic auth (used if API key is not set)
# ARCANE_CITY_USERNAME=your_username
# ARCANE_CITY_PASSWORD=your_password

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Optional: override for development
# ARCANE_CITY_API_URL=https://dev.arcane.city
`;

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  const {
    data: connectionData,
    isLoading: isTestingConnection,
    refetch: testConnection,
    isFetching,
  } = useQuery<{ ok: boolean; latencyMs: number; error?: string }>({
    queryKey: ["connection"],
    queryFn: async () => {
      const res = await fetch("/api/connection");
      return res.json();
    },
    enabled: false, // Only fetch when manually triggered
    retry: false,
  });

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(ENV_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          API configuration and connection status
        </p>
      </div>

      {/* Connection status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">API Connection</CardTitle>
          <CardDescription>
            Tests connectivity to the Arcane City API using your configured credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            onClick={() => testConnection()}
            disabled={isFetching}
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>

          {connectionData && (
            <div className="flex items-center gap-3">
              {connectionData.ok ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      Connected
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Latency: {connectionData.latencyMs}ms
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Connection failed
                    </p>
                    {connectionData.error && (
                      <p className="text-xs text-muted-foreground">
                        {connectionData.error}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Environment variables */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Environment Variables</CardTitle>
          <CardDescription>
            Set these in your <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> file.
            Restart the dev server after making changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ENV_VARS.map((v) => (
            <div key={v.name} className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                    {v.name}
                  </code>
                  {v.required && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                  {v.sensitive && (
                    <Badge variant="secondary" className="text-xs">
                      Secret
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {v.description} — e.g.{" "}
                  <code className="text-xs">{v.sensitive ? "••••••••" : v.example}</code>
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* .env.local template */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">.env.local Template</CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopyTemplate}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            Copy this template, create <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> in the project root, and fill in your values.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted rounded-md p-4 overflow-x-auto whitespace-pre">
            {ENV_TEMPLATE}
          </pre>
        </CardContent>
      </Card>

      <Separator />

      {/* App info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Arcane City Admin — standalone event management tool</p>
          <p>
            LLM: Claude Sonnet 4.6 via Anthropic API
          </p>
          <p>
            API:{" "}
            <a
              href="https://arcane.city"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              arcane.city
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
