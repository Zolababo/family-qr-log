"use client";

import { useEffect } from "react";

type VersionPayload = {
  version?: string;
};

type AppVersionGuardProps = {
  currentVersion: string;
};

const VERSION_URL = "/version.json";

export function AppVersionGuard({ currentVersion }: AppVersionGuardProps) {
  useEffect(() => {
    let disposed = false;

    const checkVersionAndReloadIfNeeded = async () => {
      try {
        const url = `${VERSION_URL}?t=${Date.now()}`;
        const response = await fetch(url, {
          cache: "no-store",
          headers: {
            "cache-control": "no-cache",
            pragma: "no-cache",
          },
        });
        if (!response.ok) return;

        const data = (await response.json()) as VersionPayload;
        if (!data.version) return;
        if (data.version === currentVersion) return;
        if (disposed) return;

        window.location.reload();
      } catch {
        // Ignore transient network/cache errors.
      }
    };

    void checkVersionAndReloadIfNeeded();
    document.addEventListener("visibilitychange", checkVersionAndReloadIfNeeded);
    window.addEventListener("focus", checkVersionAndReloadIfNeeded);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", checkVersionAndReloadIfNeeded);
      window.removeEventListener("focus", checkVersionAndReloadIfNeeded);
    };
  }, [currentVersion]);

  return null;
}
