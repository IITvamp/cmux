import type { Session, WebContentsView } from "electron";

export interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface ChromeBrandInfo {
  brand: string;
  version: string;
}

interface ChromeCamouflageInfo {
  userAgent: string;
  secChUa: string;
  secChUaFullVersion: string;
  secChUaFullVersionList: string;
  secChUaPlatform: string;
  secChUaPlatformVersion: string;
  secChUaArch: string;
  secChUaBitness: string;
  secChUaModel: string;
  secChUaMobile: string;
}

interface PlatformMetadata {
  userAgentSegment: string;
  clientPlatform: string;
  platformVersion: string;
  architecture: string;
  bitness: string;
  model: string;
  mobile: boolean;
}

interface SessionCamouflageState {
  entries: Map<number, ChromeCamouflageInfo>;
  cspInterceptorInstalled: boolean;
}

const sessionCamouflageState = new WeakMap<Session, SessionCamouflageState>();

const EMBED_CSP_OVERRIDE_URLS = [
  "https://*.http.cloud.morph.so/*",
  "http://localhost:*/*",
  "http://127.0.0.1:*/*",
];

const EMBED_CSP_EXTRA_SOURCES = [
  "https://cmux.local",
  "app://cmux",
  "http://localhost:*",
  "http://127.0.0.1:*",
];

function escapeHeaderValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatBrandList(brands: ChromeBrandInfo[]): string {
  return brands
    .map((item) =>
      `"${escapeHeaderValue(item.brand)}";v="${escapeHeaderValue(item.version)}"`
    )
    .join(", ");
}

function quoteHeaderValue(value: string): string {
  return `"${escapeHeaderValue(value)}"`;
}

function getChromeVersions() {
  const fallback = "120.0.0.0";
  const fullVersion =
    typeof process?.versions?.chrome === "string" && process.versions.chrome.trim().length > 0
      ? process.versions.chrome.trim()
      : fallback;
  const majorVersion = fullVersion.split(".")[0] ?? fullVersion;
  return { fullVersion, majorVersion };
}

function getPlatformMetadata(): PlatformMetadata {
  const arch = process.arch;
  const isArm = arch === "arm64" || arch === "arm";
  const is32Bit = arch === "ia32" || arch === "arm";

  if (process.platform === "darwin") {
    return {
      userAgentSegment: "Macintosh; Intel Mac OS X 10_15_7",
      clientPlatform: "macOS",
      platformVersion: "14.0.0",
      architecture: isArm ? "arm" : "x86",
      bitness: "64",
      model: "",
      mobile: false,
    };
  }

  if (process.platform === "win32") {
    const segment = isArm
      ? "Windows NT 10.0; Win64; arm64"
      : is32Bit
        ? "Windows NT 10.0; Win32"
        : "Windows NT 10.0; Win64; x64";
    return {
      userAgentSegment: segment,
      clientPlatform: "Windows",
      platformVersion: "10.0.0",
      architecture: isArm ? "arm" : "x86",
      bitness: is32Bit ? "32" : "64",
      model: "",
      mobile: false,
    };
  }

  const linuxSegment = isArm
    ? arch === "arm64"
      ? "X11; Linux armv8l"
      : "X11; Linux armv7l"
    : "X11; Linux x86_64";

  return {
    userAgentSegment: linuxSegment,
    clientPlatform: "Linux",
    platformVersion: "6.0.0",
    architecture: isArm ? "arm" : "x86",
    bitness: is32Bit ? "32" : "64",
    model: "",
    mobile: false,
  };
}

function buildChromeCamouflageInfo(): ChromeCamouflageInfo {
  const { fullVersion, majorVersion } = getChromeVersions();
  const platform = getPlatformMetadata();
  const brands: ChromeBrandInfo[] = [
    { brand: "Not.A/Brand", version: "99" },
    { brand: "Chromium", version: majorVersion },
    { brand: "Google Chrome", version: majorVersion },
  ];
  const fullVersionBrands: ChromeBrandInfo[] = [
    { brand: "Not.A/Brand", version: "99.0.0.0" },
    { brand: "Chromium", version: fullVersion },
    { brand: "Google Chrome", version: fullVersion },
  ];

  return {
    userAgent: `Mozilla/5.0 (${platform.userAgentSegment}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullVersion} Safari/537.36`,
    secChUa: formatBrandList(brands),
    secChUaFullVersion: quoteHeaderValue(fullVersion),
    secChUaFullVersionList: formatBrandList(fullVersionBrands),
    secChUaPlatform: quoteHeaderValue(platform.clientPlatform),
    secChUaPlatformVersion: quoteHeaderValue(platform.platformVersion),
    secChUaArch: quoteHeaderValue(platform.architecture),
    secChUaBitness: quoteHeaderValue(platform.bitness),
    secChUaModel: quoteHeaderValue(platform.model),
    secChUaMobile: platform.mobile ? "?1" : "?0",
  };
}

function overrideHeader(
  headers: Record<string, string | string[]>,
  name: string,
  value: string
): void {
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      delete headers[key];
    }
  }
  headers[name] = value;
}

function getOrCreateSessionState(ses: Session): SessionCamouflageState {
  let state = sessionCamouflageState.get(ses);
  if (state) {
    return state;
  }

  state = { entries: new Map(), cspInterceptorInstalled: false };
  sessionCamouflageState.set(ses, state);

  const sessionState = state;
  ses.webRequest.onBeforeSendHeaders({ urls: ["*://*/*"] }, (details, callback) => {
    const requestHeaders: Record<string, string | string[]> = {
      ...details.requestHeaders,
    };
    const entry = sessionState.entries.get(details.webContentsId ?? -1);
    if (!entry) {
      callback({ cancel: false, requestHeaders });
      return;
    }

    overrideHeader(requestHeaders, "User-Agent", entry.userAgent);
    overrideHeader(requestHeaders, "Sec-CH-UA", entry.secChUa);
    overrideHeader(requestHeaders, "Sec-CH-UA-Full-Version", entry.secChUaFullVersion);
    overrideHeader(
      requestHeaders,
      "Sec-CH-UA-Full-Version-List",
      entry.secChUaFullVersionList
    );
    overrideHeader(requestHeaders, "Sec-CH-UA-Platform", entry.secChUaPlatform);
    overrideHeader(
      requestHeaders,
      "Sec-CH-UA-Platform-Version",
      entry.secChUaPlatformVersion
    );
    overrideHeader(requestHeaders, "Sec-CH-UA-Arch", entry.secChUaArch);
    overrideHeader(requestHeaders, "Sec-CH-UA-Bitness", entry.secChUaBitness);
    overrideHeader(requestHeaders, "Sec-CH-UA-Model", entry.secChUaModel);
    overrideHeader(requestHeaders, "Sec-CH-UA-Mobile", entry.secChUaMobile);

    callback({ cancel: false, requestHeaders });
  });

  return state;
}

function ensureCspOverrideInstalled(
  ses: Session,
  state: SessionCamouflageState
): void {
  if (state.cspInterceptorInstalled) return;

  ses.webRequest.onHeadersReceived(
    { urls: EMBED_CSP_OVERRIDE_URLS },
    (details, callback) => {
      const originalHeaders = details.responseHeaders ?? {};
      const responseHeaders: Record<string, string[]> = { ...originalHeaders };
      const cspKey = Object.keys(responseHeaders).find(
        (key) => key.toLowerCase() === "content-security-policy"
      );

      if (!cspKey) {
        callback({ cancel: false, responseHeaders: originalHeaders });
        return;
      }

      const currentValues = responseHeaders[cspKey];
      if (!currentValues || currentValues.length === 0) {
        callback({ cancel: false, responseHeaders: originalHeaders });
        return;
      }

      const patchedValues = currentValues.map((header) => {
        let workingHeader = header;

        const updateDirective = (directive: string) => {
          const regex = new RegExp(`${directive}\\s+([^;]+)`, "i");
          const match = workingHeader.match(regex);
          if (!match) return;

          const sources = match[1]
            .split(/\s+/)
            .filter((token) => token.length > 0);
          if (directive === "frame-ancestors" && !sources.includes("'self'")) {
            sources.unshift("'self'");
          }
          for (const extra of EMBED_CSP_EXTRA_SOURCES) {
            if (!sources.includes(extra)) {
              sources.push(extra);
            }
          }
          const replacement = `${directive} ${sources.join(" ")}`;
          workingHeader = workingHeader.replace(regex, replacement);
        };

        updateDirective("frame-src");
        updateDirective("child-src");

        if (!/frame-ancestors/i.test(workingHeader)) {
          const ancestorSources = ["'self'", ...EMBED_CSP_EXTRA_SOURCES];
          workingHeader += `; frame-ancestors ${ancestorSources.join(" ")}`;
        } else {
          updateDirective("frame-ancestors");
        }

        return workingHeader;
      });

      responseHeaders[cspKey] = patchedValues;

      // TODO(cmux-iframe-csp): Remove CSP override once upstream VS Code servers allow embedding.
      callback({ cancel: false, responseHeaders });
    }
  );
  state.cspInterceptorInstalled = true;
}

export function applyChromeCamouflage(view: WebContentsView, logger: Logger): void {
  const contents = view.webContents;
  const metadata = buildChromeCamouflageInfo();

  try {
    contents.setUserAgent(metadata.userAgent);
  } catch (error) {
    logger.warn("Failed to set WebContentsView user agent override", error);
  }

  const ses = contents.session;
  if (!ses) return;

  const state = getOrCreateSessionState(ses);
  ensureCspOverrideInstalled(ses, state);

  const alreadyTracked = state.entries.has(contents.id);
  state.entries.set(contents.id, metadata);

  if (!alreadyTracked) {
    contents.once("destroyed", () => {
      const currentState = sessionCamouflageState.get(ses);
      currentState?.entries.delete(contents.id);
    });
  }
}

export function ensureEmbedCspForSession(session: Session): void {
  const state = getOrCreateSessionState(session);
  ensureCspOverrideInstalled(session, state);
}
