import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const figuresRoot = join(repoRoot, "docs", "figures");
const svgRoot = join(figuresRoot, "svg");
const pngRoot = join(figuresRoot, "png");

const FONT = "IBM Plex Sans, Segoe UI, Arial, sans-serif";
const C = {
  page: "#FFFFFF",
  ink: "#101828",
  muted: "#475467",
  subtle: "#667085",
  line: "#98A2B3",
  border: "#D0D5DD",
  panel: "#F8FAFC",
  panelAlt: "#F2F4F7",
  app: "#EFF4FF",
  appStrong: "#DCE7FF",
  backend: "#ECFDF3",
  backendStrong: "#D3F8DF",
  external: "#F9F5FF",
  externalStrong: "#EDE4FF",
  hardware: "#FFF7ED",
  hardwareStrong: "#FEDFBE",
  auth: "#F4F3FF",
  authStrong: "#DDD6FE",
  accent: "#155EEF",
  success: "#067647",
  warning: "#B54708",
  danger: "#B42318",
  dark: "#0F172A",
  white: "#FFFFFF",
};

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const rect = (x, y, width, height, options = {}) => {
  const {
    rx = 16,
    fill = C.white,
    stroke = C.border,
    strokeWidth = 1,
    opacity = 1,
    dash = null,
  } = options;

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ""} />`;
};

const line = (x1, y1, x2, y2, options = {}) => {
  const {
    stroke = C.line,
    strokeWidth = 1.5,
    dash = null,
    markerEnd = false,
    opacity = 1,
  } = options;

  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ""}${markerEnd ? ' marker-end="url(#arrow)"' : ""} />`;
};

const polyline = (points, options = {}) => {
  const {
    stroke = C.ink,
    strokeWidth = 2,
    dash = null,
    markerEnd = false,
    fill = "none",
    opacity = 1,
  } = options;

  const pts = points.map(([x, y]) => `${x},${y}`).join(" ");
  return `<polyline points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ""}${markerEnd ? ' marker-end="url(#arrow)"' : ""} />`;
};

const circle = (cx, cy, r, options = {}) => {
  const { fill = C.white, stroke = C.border, strokeWidth = 1 } = options;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
};

const text = (x, y, value, options = {}) => {
  const {
    size = 14,
    weight = 500,
    fill = C.ink,
    anchor = "start",
    letterSpacing = 0,
  } = options;

  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letterSpacing}">${esc(value)}</text>`;
};

const textBlock = (x, y, lines, options = {}) => {
  const {
    size = 13,
    weight = 400,
    fill = C.muted,
    anchor = "start",
    lineHeight = 18,
  } = options;

  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${lines
    .map(
      (value, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(value)}</tspan>`
    )
    .join("")}</text>`;
};

const chip = (x, y, label, options = {}) => {
  const { fill = C.panelAlt, color = C.ink, width = null } = options;
  const computedWidth = width ?? Math.max(80, label.length * 7 + 22);
  return [
    rect(x, y, computedWidth, 26, { rx: 13, fill, stroke: fill }),
    text(x + computedWidth / 2, y + 17, label, {
      size: 11,
      weight: 700,
      fill: color,
      anchor: "middle",
      letterSpacing: 0.4,
    }),
  ].join("");
};

const card = ({
  x,
  y,
  width,
  height,
  label,
  title,
  lines = [],
  fill = C.white,
  stroke = C.border,
  titleSize = 16,
}) => {
  const parts = [rect(x, y, width, height, { rx: 16, fill, stroke })];
  if (label) {
    parts.push(
      text(x + 18, y + 24, label.toUpperCase(), {
        size: 10,
        weight: 700,
        fill: C.subtle,
        letterSpacing: 1.2,
      })
    );
  }
  parts.push(
    text(x + 18, y + (label ? 50 : 30), title, {
      size: titleSize,
      weight: 700,
    })
  );
  if (lines.length) {
    parts.push(
      textBlock(x + 18, y + (label ? 74 : 54), lines, {
        size: 13,
        fill: C.muted,
        lineHeight: 18,
      })
    );
  }
  return parts.join("");
};

const group = ({
  x,
  y,
  width,
  height,
  title,
  subtitle = null,
  fill = C.panel,
  stroke = C.border,
  body = "",
}) => {
  const parts = [rect(x, y, width, height, { rx: 20, fill, stroke })];
  parts.push(text(x + 20, y + 30, title, { size: 18, weight: 700 }));
  if (subtitle) {
    parts.push(text(x + 20, y + 52, subtitle, { size: 12, fill: C.muted }));
  }
  parts.push(
    line(x + 20, y + 68, x + width - 20, y + 68, {
      stroke: C.border,
      strokeWidth: 1,
    })
  );
  parts.push(body);
  return parts.join("");
};

const labelAt = (x, y, value, options = {}) => {
  const { fill = C.white, stroke = C.border, color = C.ink } = options;
  const width = Math.max(36, value.length * 7 + 14);
  return [
    rect(x - width / 2, y - 12, width, 24, { rx: 12, fill, stroke }),
    text(x, y + 5, value, {
      size: 11,
      weight: 700,
      fill: color,
      anchor: "middle",
    }),
  ].join("");
};

const sectionTitle = (label, subtitle = "") => {
  const parts = [text(56, 48, label, { size: 24, weight: 700 })];
  if (subtitle) {
    parts.push(text(56, 72, subtitle, { size: 13, fill: C.muted }));
  }
  return parts.join("");
};

const svgDocument = (width, height, content) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${C.ink}" />
    </marker>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${C.page}" />
  ${content}
</svg>`;

const renderFigure310 = () => {
  const width = 1800;
  const height = 560;
  const y = 240;
  const boxWidth = 198;
  const boxHeight = 96;
  const startX = 62;
  const gap = 40;
  const boxes = [
    { title: "Location", fill: C.hardware },
    { title: "Open-Meteo API", fill: C.external },
    { title: "Environmental Context", fill: C.app },
    { title: "Physiological Prediction", fill: C.app },
    { title: "Prompt Construction", fill: C.panel },
    { title: "LLM", fill: C.external },
    { title: "Coaching Message", fill: C.backend },
  ];

  const parts = [
    sectionTitle(
      "Contextual Coaching Pipeline",
      "Project-derived high-level flow used by the dashboard Coach feature"
    ),
  ];

  parts.push(rect(56, 118, 452, 250, { rx: 20, fill: C.panel, stroke: C.border }));
  parts.push(rect(536, 118, 452, 250, { rx: 20, fill: C.panel, stroke: C.border }));
  parts.push(rect(1016, 118, 728, 250, { rx: 20, fill: C.panel, stroke: C.border }));
  parts.push(text(76, 148, "Input Acquisition", { size: 14, weight: 700, fill: C.subtle }));
  parts.push(text(556, 148, "Context And Inference", { size: 14, weight: 700, fill: C.subtle }));
  parts.push(text(1036, 148, "Generation", { size: 14, weight: 700, fill: C.subtle }));

  boxes.forEach((box, index) => {
    const x = startX + index * (boxWidth + gap);
    parts.push(
      card({
        x,
        y,
        width: boxWidth,
        height: boxHeight,
        title: box.title,
        fill: box.fill,
        stroke: C.border,
        lines: [],
      })
    );
    if (index < boxes.length - 1) {
      parts.push(
        polyline(
          [
            [x + boxWidth, y + boxHeight / 2],
            [x + boxWidth + gap - 14, y + boxHeight / 2],
          ],
          { stroke: C.ink, strokeWidth: 2.5, markerEnd: true }
        )
      );
    }
  });

  parts.push(
    card({
      x: 770,
      y: 392,
      width: 220,
      height: 72,
      label: "Support Input",
      title: "Latest Biometric Window",
      lines: ["BLE-derived state and fused score"],
      fill: C.hardware,
      stroke: C.border,
      titleSize: 15,
    })
  );

  parts.push(
    polyline(
      [
        [880, 392],
        [880, 352],
        [935, 352],
        [935, 336],
      ],
      { stroke: C.ink, strokeWidth: 2, markerEnd: true }
    )
  );

  parts.push(
    textBlock(
      116,
      494,
      [
        "Location permissions and geocoding feed Open-Meteo requests.",
        "Environmental context and current physiological state are fused into a concise prompt before LLM generation.",
      ],
      { size: 13, fill: C.muted, lineHeight: 20 }
    )
  );

  return { width, height, svg: svgDocument(width, height, parts.join("")) };
};

const renderFigure311 = () => {
  const participants = [
    "User",
    "Dashboard",
    "Env Hook",
    "Env Service",
    "Open-Meteo",
    "Prompt Builder",
    "OpenRouter Client",
    "Supabase Auth",
    "Edge Function",
    "OpenRouter",
  ];
  const xStart = 120;
  const xGap = 190;
  const xs = participants.map((_, index) => xStart + index * xGap);
  const width = 2000;
  const height = 1420;
  const topY = 120;
  const bottomY = 1320;
  const rowStart = 220;
  const rowGap = 46;

  const messages = [
    [0, 1, "Open dashboard", false],
    [1, 2, "load()", false],
    [2, 3, "getEnvironmentalContext()", false],
    [3, 4, "weather + air-quality requests", false],
    [4, 3, "weather and AQI payloads", true],
    [3, 2, "envContext", true],
    [2, 1, "context ready", true],
    [0, 1, "Tap Generate Insight", false],
    [1, 5, "buildInsightPrompt(envContext, insightEvents)", false],
    [5, 1, "prompt string", true],
    [1, 6, "askOpenRouter(system, user)", false],
    [6, 7, "getSession()", false],
    [7, 6, "access token", true],
    [6, 8, "POST prompt + x-supabase-auth", false],
    [8, 7, "getUser(accessToken)", false],
    [7, 8, "authenticated user", true],
    [8, 9, "chat/completions", false],
    [9, 8, "assistant content", true],
    [8, 6, "{ content }", true],
    [6, 1, "coaching text", true],
    [1, 0, "Render Coach card", true],
  ];

  const parts = [
    sectionTitle(
      "Sequence Diagram For Contextual Coaching Generation",
      "Actual request path implemented by the Dashboard coach flow"
    ),
  ];

  participants.forEach((name, index) => {
    const x = xs[index];
    parts.push(rect(x - 66, topY, 132, 40, { rx: 12, fill: C.panelAlt, stroke: C.border }));
    parts.push(text(x, topY + 25, name, { size: 13, weight: 700, anchor: "middle" }));
    parts.push(
      line(x, topY + 40, x, bottomY, {
        stroke: C.border,
        strokeWidth: 1.2,
        dash: "6 6",
      })
    );
  });

  messages.forEach((message, index) => {
    const [from, to, label, dashed] = message;
    const y = rowStart + index * rowGap;
    if (index % 2 === 0) {
      parts.push(rect(56, y - 20, width - 112, 32, { rx: 8, fill: C.panel, stroke: C.panel }));
    }
    parts.push(
      polyline(
        [
          [xs[from], y],
          [xs[to], y],
        ],
        {
          stroke: C.ink,
          strokeWidth: 1.8,
          markerEnd: true,
          dash: dashed ? "6 4" : null,
        }
      )
    );
    parts.push(
      text((xs[from] + xs[to]) / 2, y - 8, label, {
        size: 12,
        weight: 500,
        anchor: "middle",
        fill: C.muted,
      })
    );
  });

  parts.push(rect(290, 520, 430, 58, { rx: 12, fill: C.hardware, stroke: C.border }));
  parts.push(
    textBlock(
      312,
      546,
      [
        "Current physiological state is already available from the BLE /",
        "stress-prediction pipeline before the insight request is generated.",
      ],
      { size: 12, fill: C.ink, lineHeight: 16 }
    )
  );

  return { width, height, svg: svgDocument(width, height, parts.join("")) };
};

const renderFigure312 = () => {
  const width = 1800;
  const height = 1080;
  const connect = (points, strokeWidth = 2.2) =>
    polyline(points, { stroke: C.ink, strokeWidth, markerEnd: true });
  const parts = [
    sectionTitle(
      "Mobile Application System Architecture",
      "Runtime view spanning wearable input, React Native app, Supabase, and external services"
    ),
  ];

  parts.push(
    group({
      x: 56,
      y: 112,
      width: 250,
      height: 760,
      title: "Wearable Layer",
      subtitle: "ESP32 prototype and BLE transport",
      fill: C.hardware,
      body: [
        card({
          x: 76,
          y: 198,
          width: 210,
          height: 100,
          label: "Sensors",
          title: "PPG, temp, EDA, accelerometer",
          fill: C.white,
          stroke: C.border,
          lines: ["Sampling used for 60-second feature windows"],
        }),
        card({
          x: 76,
          y: 334,
          width: 210,
          height: 90,
          label: "Firmware",
          title: "mindpulse_esp32.ino",
          fill: C.white,
          stroke: C.border,
          lines: ["Packages primary CSV stream and PPG characteristic"],
        }),
        card({
          x: 76,
          y: 462,
          width: 210,
          height: 90,
          label: "Transport",
          title: "BLE GATT service",
          fill: C.white,
          stroke: C.border,
          lines: ["Primary characteristic + PPG characteristic"],
        }),
      ].join(""),
    })
  );

  parts.push(
    group({
      x: 340,
      y: 112,
      width: 810,
      height: 860,
      title: "Expo React Native Application",
      subtitle: "Presentation, state management, and service orchestration",
      fill: C.app,
      body: [
        rect(364, 190, 762, 160, { rx: 16, fill: C.white, stroke: C.border }),
        text(384, 216, "Presentation", { size: 14, weight: 700, fill: C.subtle }),
        card({
          x: 384,
          y: 238,
          width: 150,
          height: 88,
          title: "DashboardScreen",
          fill: C.panel,
          stroke: C.border,
          lines: ["Current state, Coach card, stress detection"],
        }),
        card({
          x: 554,
          y: 238,
          width: 150,
          height: 88,
          title: "InsightsScreen",
          fill: C.panel,
          stroke: C.border,
          lines: ["Timeline, charts, environmental context"],
        }),
        card({
          x: 724,
          y: 238,
          width: 170,
          height: 88,
          title: "InterventionScreen",
          fill: C.panel,
          stroke: C.border,
          lines: ["Breathing session workflow"],
        }),
        card({
          x: 914,
          y: 238,
          width: 188,
          height: 88,
          title: "SettingsScreen",
          fill: C.panel,
          stroke: C.border,
          lines: ["Profile, theme, device actions"],
        }),

        rect(364, 382, 762, 138, { rx: 16, fill: C.white, stroke: C.border }),
        text(384, 408, "State And Hooks", { size: 14, weight: 700, fill: C.subtle }),
        card({
          x: 384,
          y: 430,
          width: 150,
          height: 68,
          title: "AuthContext",
          fill: C.panel,
          stroke: C.border,
          lines: ["Session and profile state"],
        }),
        card({
          x: 554,
          y: 430,
          width: 150,
          height: 68,
          title: "BleContext",
          fill: C.panel,
          stroke: C.border,
          lines: ["Live readings and connection state"],
        }),
        card({
          x: 724,
          y: 430,
          width: 180,
          height: 68,
          title: "useEnvironmentalContext",
          fill: C.panel,
          stroke: C.border,
          lines: ["Location, weather, AQI"],
        }),
        card({
          x: 924,
          y: 430,
          width: 178,
          height: 68,
          title: "useLlmInsight",
          fill: C.panel,
          stroke: C.border,
          lines: ["Insight generation state"],
        }),

        rect(364, 552, 762, 240, { rx: 16, fill: C.white, stroke: C.border }),
        text(384, 578, "Application Services", { size: 14, weight: 700, fill: C.subtle }),
        card({
          x: 384,
          y: 602,
          width: 150,
          height: 74,
          title: "ble.js",
          fill: C.panel,
          stroke: C.border,
          lines: ["Decoding, permissions, BLE manager"],
        }),
        card({
          x: 554,
          y: 602,
          width: 150,
          height: 74,
          title: "db.ts",
          fill: C.panel,
          stroke: C.border,
          lines: ["CRUD for snapshots, predictions, interventions"],
        }),
        card({
          x: 724,
          y: 602,
          width: 178,
          height: 74,
          title: "environment.js",
          fill: C.panel,
          stroke: C.border,
          lines: ["Location and Open-Meteo integration"],
        }),
        card({
          x: 922,
          y: 602,
          width: 180,
          height: 74,
          title: "stressPrediction.js",
          fill: C.panel,
          stroke: C.border,
          lines: ["Invokes hf-stress-predict"],
        }),
        card({
          x: 384,
          y: 698,
          width: 150,
          height: 74,
          title: "openrouter.js",
          fill: C.panel,
          stroke: C.border,
          lines: ["Invokes openrouter-insight"],
        }),
        card({
          x: 554,
          y: 698,
          width: 172,
          height: 74,
          title: "functionClient.js",
          fill: C.panel,
          stroke: C.border,
          lines: ["Authenticated Edge Function transport"],
        }),
        card({
          x: 746,
          y: 698,
          width: 178,
          height: 74,
          title: "buildInsightPrompt",
          fill: C.panel,
          stroke: C.border,
          lines: ["Formats context into concise prompt text"],
        }),
        card({
          x: 944,
          y: 698,
          width: 158,
          height: 74,
          title: "AsyncStorage",
          fill: C.panel,
          stroke: C.border,
          lines: ["Auth and remembered device state"],
        }),
      ].join(""),
    })
  );

  parts.push(
    group({
      x: 1184,
      y: 112,
      width: 260,
      height: 394,
      title: "Supabase Platform",
      subtitle: "Auth, Postgres, and Edge Functions",
      fill: C.backend,
      body: [
        card({
          x: 1204,
          y: 198,
          width: 220,
          height: 74,
          title: "Supabase Auth",
          fill: C.white,
          stroke: C.border,
          lines: ["Session lookup and user validation"],
        }),
        card({
          x: 1204,
          y: 292,
          width: 220,
          height: 74,
          title: "Postgres + Realtime",
          fill: C.white,
          stroke: C.border,
          lines: ["Application tables and realtime subscriptions"],
        }),
        card({
          x: 1204,
          y: 386,
          width: 220,
          height: 94,
          title: "Edge Functions",
          fill: C.white,
          stroke: C.border,
          lines: ["hf-stress-predict", "openrouter-insight"],
        }),
      ].join(""),
    })
  );

  parts.push(
    group({
      x: 1184,
      y: 544,
      width: 260,
      height: 328,
      title: "External Services",
      subtitle: "Third-party APIs called by app or edge functions",
      fill: C.external,
      body: [
        card({
          x: 1204,
          y: 630,
          width: 220,
          height: 68,
          title: "Open-Meteo APIs",
          fill: C.white,
          stroke: C.border,
          lines: ["Weather forecast and air-quality endpoints"],
        }),
        card({
          x: 1204,
          y: 718,
          width: 220,
          height: 68,
          title: "OpenRouter API",
          fill: C.white,
          stroke: C.border,
          lines: ["Chat completion provider for coaching"],
        }),
        card({
          x: 1204,
          y: 806,
          width: 220,
          height: 68,
          title: "Hugging Face Space",
          fill: C.white,
          stroke: C.border,
          lines: ["Stress inference endpoint"],
        }),
      ].join(""),
    })
  );

  parts.push(
    connect(
      [
        [286, 507],
        [332, 507],
        [332, 639],
        [384, 639],
      ],
      2.2
    )
  );
  parts.push(
    connect(
      [
        [745, 350],
        [745, 382],
        [745, 382],
        [745, 382],
      ],
      2
    )
  );
  parts.push(
    connect(
      [
        [745, 520],
        [745, 552],
      ],
      2
    )
  );
  parts.push(
    connect(
      [
        [459, 430],
        [459, 170],
        [1160, 170],
        [1160, 235],
        [1204, 235],
      ],
      2.2
    )
  );
  parts.push(
    connect(
      [
        [534, 464],
        [1160, 464],
        [1160, 235],
        [1204, 235],
      ],
      2.2
    )
  );
  parts.push(
    connect(
      [
        [704, 639],
        [1160, 639],
        [1160, 329],
        [1204, 329],
      ],
      2.2
    )
  );
  parts.push(
    connect(
      [
        [813, 639],
        [1160, 639],
        [1160, 664],
        [1204, 664],
      ],
      2.2
    )
  );
  parts.push(
    connect(
      [
        [1012, 639],
        [1160, 639],
        [1160, 433],
        [1204, 433],
      ],
      2.2
    )
  );
  parts.push(
    connect(
      [
        [459, 735],
        [1160, 735],
        [1160, 433],
        [1204, 433],
      ],
      2.2
    )
  );
  parts.push(
    connect(
      [
        [1314, 480],
        [1314, 718],
      ],
      2.2
    )
  );
  parts.push(
    connect(
      [
        [1338, 480],
        [1338, 806],
      ],
      2.2
    )
  );

  parts.push(
    text(
      1204,
      918,
      "Runtime flows: BLE, environment, prediction, coaching.",
      { size: 12, fill: C.muted }
    )
  );

  return { width, height, svg: svgDocument(width, height, parts.join("")) };
};

const renderFigure313 = () => {
  const width = 1800;
  const height = 1080;
  const connect = (points, strokeWidth = 1.9) =>
    polyline(points, { stroke: C.ink, strokeWidth, markerEnd: true });
  const parts = [
    sectionTitle(
      "UML Class / Component Diagram Of The Mobile Application",
      "Repository-oriented component view of the client-side architecture"
    ),
  ];

  parts.push(
    group({
      x: 56,
      y: 112,
      width: 300,
      height: 860,
      title: "Screens",
      subtitle: "Top-level user-facing modules",
      fill: C.panel,
      body: [
        card({
          x: 76,
          y: 190,
          width: 260,
          height: 110,
          title: "DashboardScreen",
          fill: C.white,
          stroke: C.border,
          lines: [
            "Current state, BLE sync status, detection modal, Coach card",
            "Coordinates prompt generation and sync flows",
          ],
        }),
        card({
          x: 76,
          y: 330,
          width: 260,
          height: 96,
          title: "InsightsScreen",
          fill: C.white,
          stroke: C.border,
          lines: ["History view for predictions and environmental context"],
        }),
        card({
          x: 76,
          y: 456,
          width: 260,
          height: 96,
          title: "InterventionScreen",
          fill: C.white,
          stroke: C.border,
          lines: ["Breathing session flow and intervention completion"],
        }),
        card({
          x: 76,
          y: 582,
          width: 260,
          height: 96,
          title: "SettingsScreen",
          fill: C.white,
          stroke: C.border,
          lines: ["Profile editing, theme selection, account actions"],
        }),
        card({
          x: 76,
          y: 708,
          width: 260,
          height: 96,
          title: "App.js",
          fill: C.white,
          stroke: C.border,
          lines: ["Composes navigation and root providers"],
        }),
      ].join(""),
    })
  );

  parts.push(
    group({
      x: 392,
      y: 112,
      width: 300,
      height: 860,
      title: "Providers",
      subtitle: "Shared application state",
      fill: C.app,
      body: [
        card({
          x: 412,
          y: 206,
          width: 260,
          height: 94,
          title: "AuthContext",
          fill: C.white,
          stroke: C.border,
          lines: ["Session, profile, and auth actions"],
        }),
        card({
          x: 412,
          y: 332,
          width: 260,
          height: 94,
          title: "BleContext",
          fill: C.white,
          stroke: C.border,
          lines: ["BLE device state, connection flow, latest reading"],
        }),
        card({
          x: 412,
          y: 458,
          width: 260,
          height: 94,
          title: "ThemeProvider",
          fill: C.white,
          stroke: C.border,
          lines: ["Theme mode and resolved scheme"],
        }),
      ].join(""),
    })
  );

  parts.push(
    group({
      x: 728,
      y: 112,
      width: 330,
      height: 860,
      title: "Hooks And Utilities",
      subtitle: "Feature-local orchestration and prompt formatting",
      fill: C.panel,
      body: [
        card({
          x: 748,
          y: 190,
          width: 290,
          height: 94,
          title: "useEnvironmentalContext",
          fill: C.white,
          stroke: C.border,
          lines: ["Coordinates location, weather, and AQI requests"],
        }),
        card({
          x: 748,
          y: 316,
          width: 290,
          height: 94,
          title: "useLlmInsight",
          fill: C.white,
          stroke: C.border,
          lines: ["Wraps insight request state and response handling"],
        }),
        card({
          x: 748,
          y: 442,
          width: 290,
          height: 94,
          title: "dashboard/pipeline.js",
          fill: C.white,
          stroke: C.border,
          lines: ["BLE buffering and prediction payload assembly"],
        }),
        card({
          x: 748,
          y: 568,
          width: 290,
          height: 94,
          title: "buildInsightPrompt",
          fill: C.white,
          stroke: C.border,
          lines: ["Formats state and environment into prompt text"],
        }),
        card({
          x: 748,
          y: 694,
          width: 290,
          height: 94,
          title: "biometric utils",
          fill: C.white,
          stroke: C.border,
          lines: ["Normalization and sensor range validation"],
        }),
      ].join(""),
    })
  );

  parts.push(
    group({
      x: 1094,
      y: 112,
      width: 330,
      height: 860,
      title: "Services",
      subtitle: "Transport and persistence adapters",
      fill: C.backend,
      body: [
        card({
          x: 1114,
          y: 176,
          width: 290,
          height: 84,
          title: "db.ts",
          fill: C.white,
          stroke: C.border,
          lines: ["Snapshot persistence, history queries, interventions"],
        }),
        card({
          x: 1114,
          y: 288,
          width: 290,
          height: 84,
          title: "environment.js",
          fill: C.white,
          stroke: C.border,
          lines: ["expo-location and Open-Meteo adapter"],
        }),
        card({
          x: 1114,
          y: 400,
          width: 290,
          height: 84,
          title: "stressPrediction.js",
          fill: C.white,
          stroke: C.border,
          lines: ["Edge Function client for stress inference"],
        }),
        card({
          x: 1114,
          y: 512,
          width: 290,
          height: 84,
          title: "openrouter.js",
          fill: C.white,
          stroke: C.border,
          lines: ["Edge Function client for coaching generation"],
        }),
        card({
          x: 1114,
          y: 624,
          width: 290,
          height: 84,
          title: "functionClient.js",
          fill: C.white,
          stroke: C.border,
          lines: ["Authenticated POST, timeout, and retry handling"],
        }),
        card({
          x: 1114,
          y: 736,
          width: 290,
          height: 84,
          title: "supabase.js",
          fill: C.white,
          stroke: C.border,
          lines: ["Shared Supabase client instance"],
        }),
      ].join(""),
    })
  );

  parts.push(
    group({
      x: 1460,
      y: 112,
      width: 284,
      height: 420,
      title: "Remote Components",
      subtitle: "Server-side modules reached from the app",
      fill: C.external,
      body: [
        card({
          x: 1480,
          y: 198,
          width: 244,
          height: 92,
          title: "hf-stress-predict",
          fill: C.white,
          stroke: C.border,
          lines: ["Auth check and Hugging Face request forwarding"],
        }),
        card({
          x: 1480,
          y: 320,
          width: 244,
          height: 92,
          title: "openrouter-insight",
          fill: C.white,
          stroke: C.border,
          lines: ["Auth check and OpenRouter chat completion request"],
        }),
      ].join(""),
    })
  );

  parts.push(
    connect(
      [
        [336, 245],
        [374, 245],
        [374, 253],
        [412, 253],
      ]
    )
  );
  parts.push(
    connect(
      [
        [336, 630],
        [374, 630],
        [374, 253],
        [412, 253],
      ]
    )
  );
  parts.push(
    connect(
      [
        [336, 756],
        [374, 756],
        [374, 505],
        [412, 505],
      ]
    )
  );
  parts.push(
    connect(
      [
        [336, 378],
        [710, 378],
        [710, 237],
        [748, 237],
      ]
    )
  );
  parts.push(
    connect(
      [
        [336, 245],
        [710, 245],
        [710, 615],
        [748, 615],
      ]
    )
  );
  parts.push(
    connect(
      [
        [672, 253],
        [710, 253],
        [710, 778],
        [1114, 778],
      ]
    )
  );
  parts.push(
    connect(
      [
        [1038, 237],
        [1076, 237],
        [1076, 330],
        [1114, 330],
      ]
    )
  );
  parts.push(
    connect(
      [
        [1038, 363],
        [1076, 363],
        [1076, 554],
        [1114, 554],
      ]
    )
  );
  parts.push(
    connect(
      [
        [1038, 489],
        [1076, 489],
        [1076, 442],
        [1114, 442],
      ]
    )
  );
  parts.push(
    connect(
      [
        [1254, 484],
        [1254, 624],
      ]
    )
  );
  parts.push(
    connect(
      [
        [1278, 596],
        [1278, 624],
      ]
    )
  );
  parts.push(
    connect(
      [
        [1404, 666],
        [1442, 666],
        [1442, 244],
        [1480, 244],
      ]
    )
  );
  parts.push(
    connect(
      [
        [1404, 666],
        [1442, 666],
        [1442, 366],
        [1480, 366],
      ]
    )
  );

  parts.push(
    text(1460, 588, "Arrows indicate dependency direction.", {
      size: 12,
      fill: C.muted,
    })
  );

  return { width, height, svg: svgDocument(width, height, parts.join("")) };
};

const renderTable = ({ x, y, width, title, fill, fields }) => {
  const rowHeight = 26;
  const headerHeight = 42;
  const height = headerHeight + fields.length * rowHeight;
  const parts = [rect(x, y, width, height, { rx: 14, fill: C.white, stroke: C.border })];
  parts.push(rect(x, y, width, headerHeight, { rx: 14, fill, stroke: fill }));
  parts.push(text(x + 16, y + 26, title, { size: 15, weight: 700, fill: C.ink }));
  fields.forEach((field, index) => {
    const rowY = y + headerHeight + index * rowHeight;
    parts.push(line(x, rowY, x + width, rowY, { stroke: C.border, strokeWidth: 1 }));
    parts.push(text(x + 16, rowY + 18, field, { size: 12, fill: C.muted }));
  });
  return { svg: parts.join(""), height };
};

const renderFigure314 = () => {
  const width = 1440;
  const height = 980;
  const parts = [
    sectionTitle(
      "Supabase Database Schema / Entity-Relationship Diagram",
      "Current relational structure defined in supabase/schema.sql"
    ),
  ];

  const tables = [
    {
      key: "auth",
      x: 56,
      y: 116,
      width: 380,
      title: "auth.users",
      fill: C.authStrong,
      fields: ["id : uuid [PK]", "email : string"],
    },
    {
      key: "users",
      x: 530,
      y: 116,
      width: 380,
      title: "public.users",
      fill: C.appStrong,
      fields: [
        "id : uuid [PK, FK -> auth.users.id]",
        "email : varchar(255) [UK]",
        "full_name : text",
        "baseline_hr_bpm : integer",
        "baseline_temp_c : decimal(4,2)",
        "created_at : timestamptz",
        "updated_at : timestamptz",
      ],
    },
    {
      key: "settings",
      x: 1004,
      y: 116,
      width: 380,
      title: "public.user_settings",
      fill: C.backendStrong,
      fields: [
        "user_id : uuid [PK, FK -> users.id]",
        "push_notifications : boolean",
        "breathing_duration : integer",
        "haptic_feedback : boolean",
        "created_at : timestamptz",
        "updated_at : timestamptz",
      ],
    },
    {
      key: "bio",
      x: 56,
      y: 470,
      width: 380,
      title: "public.biometric_windows",
      fill: C.hardwareStrong,
      fields: [
        "id : bigint [PK]",
        "user_id : uuid [FK -> users.id]",
        "timestamp : timestamptz",
        "hr_mean : decimal(5,2)",
        "hrv_sdnn : decimal(6,2)",
        "temp_mean : decimal(4,2)",
        "eda_peaks : integer",
        "created_at : timestamptz",
      ],
    },
    {
      key: "pred",
      x: 530,
      y: 470,
      width: 380,
      title: "public.predictions_log",
      fill: C.externalStrong,
      fields: [
        "id : bigint [PK]",
        "user_id : uuid [FK -> users.id]",
        "window_id : bigint [FK -> biometric_windows.id]",
        "rf_confidence : decimal(3,2)",
        "lstm_confidence : decimal(3,2)",
        "fused_score : decimal(3,2)",
        "final_state : varchar(20)",
        "created_at : timestamptz",
      ],
    },
    {
      key: "int",
      x: 1004,
      y: 470,
      width: 380,
      title: "public.interventions",
      fill: C.panelAlt,
      fields: [
        "id : bigint [PK]",
        "user_id : uuid [FK -> users.id]",
        "prediction_id : bigint [nullable FK -> predictions_log.id]",
        "started_at : timestamptz",
        "completed_secs : integer",
        "trigger_type : varchar(20)",
        "user_feedback : varchar(20)",
        "created_at : timestamptz",
      ],
    },
  ];

  tables.forEach((table) => {
    const rendered = renderTable(table);
    parts.push(rendered.svg);
  });

  const rel = (points, startLabel, endLabel, caption, labelX, labelY) => {
    parts.push(polyline(points, { stroke: C.ink, strokeWidth: 2.1 }));
    parts.push(labelAt(points[0][0], points[0][1], startLabel, { fill: C.white }));
    const last = points[points.length - 1];
    parts.push(labelAt(last[0], last[1], endLabel, { fill: C.white }));
    if (caption) {
      parts.push(
        chip(labelX, labelY, caption, {
          fill: C.panelAlt,
          color: C.muted,
          width: Math.max(90, caption.length * 7 + 24),
        })
      );
    }
  };

  rel(
    [
      [436, 209],
      [530, 209],
    ],
    "1",
    "1",
    "identity mirror",
    483,
    182
  );
  rel(
    [
      [910, 209],
      [1004, 209],
    ],
    "1",
    "1",
    "has one",
    957,
    182
  );
  rel(
    [
      [630, 314],
      [630, 430],
      [246, 430],
      [246, 470],
    ],
    "1",
    "0..*",
    "records",
    362,
    404
  );
  rel(
    [
      [720, 314],
      [720, 470],
    ],
    "1",
    "0..*",
    "owns",
    764,
    392
  );
  rel(
    [
      [810, 314],
      [810, 430],
      [1194, 430],
      [1194, 470],
    ],
    "1",
    "0..*",
    "performs",
    1078,
    404
  );
  rel(
    [
      [436, 589],
      [530, 589],
    ],
    "1",
    "0..*",
    "drives",
    483,
    562
  );
  rel(
    [
      [910, 589],
      [1004, 589],
    ],
    "1",
    "0..*",
    "optionally triggers",
    957,
    562
  );

  parts.push(
    text(
      56,
      930,
      "All application tables are protected by row-level security policies keyed to auth.uid().",
      { size: 12, fill: C.muted }
    )
  );

  return { width, height, svg: svgDocument(width, height, parts.join("")) };
};

const screenFrame = ({ x, y, width = 260, height = 520, title, body }) =>
  [
    rect(x, y, width, height, { rx: 28, fill: C.white, stroke: C.border }),
    rect(x + 18, y + 18, width - 36, 14, {
      rx: 7,
      fill: C.panelAlt,
      stroke: C.panelAlt,
    }),
    text(x + 24, y - 18, title, { size: 16, weight: 700 }),
    body,
  ].join("");

const renderFigure315 = () => {
  const width = 980;
  const height = 1260;
  const parts = [
    sectionTitle(
      "User Interface Design",
      "Implemented application screens"
    ),
  ];

  const login = screenFrame({
    x: 56,
    y: 120,
    title: "Login",
    body: [
      text(82, 190, "Welcome back", { size: 24, weight: 700 }),
      text(82, 214, "Sign in to continue monitoring and coaching.", {
        size: 12,
        fill: C.muted,
      }),
      rect(82, 250, 208, 48, { rx: 14, fill: C.panel, stroke: C.border }),
      rect(82, 318, 208, 48, { rx: 14, fill: C.panel, stroke: C.border }),
      rect(82, 392, 208, 46, { rx: 14, fill: C.dark, stroke: C.dark }),
      text(186, 421, "Log in", {
        size: 14,
        weight: 700,
        fill: C.white,
        anchor: "middle",
      }),
      text(82, 280, "Email address", { size: 13, fill: C.subtle }),
      text(82, 348, "Password", { size: 13, fill: C.subtle }),
      text(186, 474, "Create account", {
        size: 13,
        fill: C.accent,
        weight: 600,
        anchor: "middle",
      }),
    ].join(""),
  });

  const dashboard = screenFrame({
    x: 354,
    y: 120,
    title: "Dashboard",
    body: [
      text(380, 182, "MindPulse Dashboard", { size: 20, weight: 700 }),
      chip(534, 160, "Watch Connected", {
        fill: C.backend,
        color: C.success,
        width: 124,
      }),
      rect(380, 212, 208, 104, { rx: 18, fill: C.app, stroke: C.border }),
      text(398, 238, "CURRENT STATE", {
        size: 10,
        weight: 700,
        fill: C.subtle,
        letterSpacing: 1.2,
      }),
      text(398, 276, "Relaxed", { size: 30, weight: 700 }),
      text(398, 300, "Confidence 85%", {
        size: 13,
        weight: 600,
        fill: C.muted,
      }),
      rect(380, 336, 98, 82, { rx: 16, fill: C.panel, stroke: C.border }),
      rect(490, 336, 98, 82, { rx: 16, fill: C.panel, stroke: C.border }),
      text(398, 360, "HEART RATE", {
        size: 10,
        weight: 700,
        fill: C.subtle,
        letterSpacing: 1,
      }),
      text(398, 390, "72 BPM", { size: 22, weight: 700 }),
      text(508, 360, "SKIN TEMP", {
        size: 10,
        weight: 700,
        fill: C.subtle,
        letterSpacing: 1,
      }),
      text(508, 390, "33.5 C", { size: 22, weight: 700 }),
      rect(380, 444, 208, 126, { rx: 18, fill: C.panel, stroke: C.border }),
      text(398, 470, "Coach", { size: 16, weight: 700 }),
      circle(420, 520, 22, { fill: C.dark, stroke: C.dark }),
      rect(454, 488, 118, 54, { rx: 16, fill: C.panelAlt, stroke: C.border }),
      textBlock(
        468,
        510,
        ["AQI is moderate today.", "Take a short indoor reset."],
        { size: 11, fill: C.ink, lineHeight: 16 }
      ),
      rect(398, 584, 174, 38, { rx: 14, fill: C.dark, stroke: C.dark }),
      text(485, 608, "Generate Insight", {
        size: 12,
        weight: 700,
        fill: C.white,
        anchor: "middle",
      }),
    ].join(""),
  });

  const insights = screenFrame({
    x: 652,
    y: 120,
    title: "Insights",
    body: [
      text(678, 182, "Weekly Stress", { size: 20, weight: 700 }),
      rect(678, 214, 208, 138, { rx: 18, fill: C.panel, stroke: C.border }),
      line(702, 318, 860, 318, { stroke: C.border, strokeWidth: 1 }),
      line(702, 286, 860, 286, { stroke: C.border, strokeWidth: 1 }),
      line(702, 254, 860, 254, { stroke: C.border, strokeWidth: 1 }),
      polyline(
        [
          [706, 310],
          [734, 284],
          [762, 294],
          [790, 246],
          [818, 268],
          [846, 232],
        ],
        { stroke: C.dark, strokeWidth: 3 }
      ),
      rect(678, 374, 208, 88, { rx: 18, fill: C.panel, stroke: C.border }),
      text(696, 402, "Recent event", { size: 13, weight: 700 }),
      chip(796, 384, "Stressed", {
        fill: C.hardware,
        color: C.warning,
        width: 72,
      }),
      textBlock(
        696,
        424,
        ["Fused 85%  RF 82%  LSTM 88%", "Indoor recommendation triggered after AQI increase"],
        { size: 11, fill: C.muted, lineHeight: 16 }
      ),
      rect(678, 482, 208, 124, { rx: 18, fill: C.panel, stroke: C.border }),
      text(696, 510, "Environmental snapshot", { size: 13, weight: 700 }),
      rect(696, 526, 170, 44, { rx: 12, fill: C.panelAlt, stroke: C.border }),
      text(712, 554, "Bangkok, Thailand  |  AQI 74", { size: 11, fill: C.ink }),
      text(696, 592, "31.2 C    68% humidity    Partly cloudy", {
        size: 11,
        fill: C.muted,
      }),
    ].join(""),
  });

  const intervention = screenFrame({
    x: 56,
    y: 700,
    title: "Intervention",
    body: [
      rect(74, 728, 224, 474, { rx: 24, fill: C.dark, stroke: C.dark }),
      text(186, 798, "Box Breathing", {
        size: 24,
        weight: 700,
        fill: C.white,
        anchor: "middle",
      }),
      text(186, 826, "Follow the circle and reset your pace", {
        size: 12,
        fill: "#CBD5E1",
        anchor: "middle",
      }),
      circle(186, 934, 84, { fill: "#1E293B", stroke: C.white, strokeWidth: 2 }),
      circle(186, 934, 58, { fill: "#334155", stroke: "#334155" }),
      text(186, 1058, "Inhale", {
        size: 24,
        weight: 700,
        fill: C.white,
        anchor: "middle",
      }),
      text(186, 1086, "4s inhale  |  4s hold  |  4s exhale", {
        size: 12,
        fill: "#94A3B8",
        anchor: "middle",
      }),
      rect(102, 1116, 168, 42, { rx: 14, fill: C.white, stroke: C.white }),
      text(186, 1143, "I feel better", {
        size: 13,
        weight: 700,
        fill: C.dark,
        anchor: "middle",
      }),
    ].join(""),
  });

  const settings = screenFrame({
    x: 354,
    y: 700,
    title: "Settings",
    body: [
      text(380, 768, "Profile", { size: 20, weight: 700 }),
      rect(380, 792, 208, 112, { rx: 18, fill: C.panel, stroke: C.border }),
      circle(414, 838, 18, { fill: C.appStrong, stroke: C.appStrong }),
      text(444, 832, "Alex Morgan", { size: 15, weight: 700 }),
      text(444, 854, "user@mindpulse.app", { size: 12, fill: C.muted }),
      chip(496, 868, "Connected", {
        fill: C.backend,
        color: C.success,
        width: 82,
      }),
      rect(380, 926, 208, 86, { rx: 18, fill: C.panel, stroke: C.border }),
      text(398, 954, "Appearance", { size: 13, weight: 700 }),
      rect(398, 970, 60, 30, { rx: 12, fill: C.dark, stroke: C.dark }),
      rect(466, 970, 60, 30, { rx: 12, fill: C.white, stroke: C.border }),
      rect(534, 970, 36, 30, { rx: 12, fill: C.white, stroke: C.border }),
      text(428, 989, "System", {
        size: 11,
        weight: 700,
        fill: C.white,
        anchor: "middle",
      }),
      text(496, 989, "Light", {
        size: 11,
        weight: 700,
        fill: C.ink,
        anchor: "middle",
      }),
      text(552, 989, "Dark", {
        size: 11,
        weight: 700,
        fill: C.ink,
        anchor: "middle",
      }),
      rect(380, 1034, 208, 68, { rx: 18, fill: C.panel, stroke: C.border }),
      text(398, 1060, "Push notifications", { size: 13, weight: 700 }),
      text(398, 1080, "Stress alerts and breathing reminders", {
        size: 11,
        fill: C.muted,
      }),
      rect(530, 1052, 40, 22, { rx: 11, fill: C.dark, stroke: C.dark }),
      circle(556, 1063, 8, { fill: C.white, stroke: C.white }),
    ].join(""),
  });

  parts.push(login, dashboard, insights, intervention, settings);

  return { width, height, svg: svgDocument(width, height, parts.join("")) };
};

const figures = [
  ["figure-3-10-contextual-coaching-pipeline", renderFigure310],
  ["figure-3-11-contextual-coaching-sequence", renderFigure311],
  ["figure-3-12-mobile-system-architecture", renderFigure312],
  ["figure-3-13-mobile-application-class-diagram", renderFigure313],
  ["figure-3-14-supabase-database-schema-erd", renderFigure314],
  ["figure-3-15-user-interface-design", renderFigure315],
];

mkdirSync(svgRoot, { recursive: true });
mkdirSync(pngRoot, { recursive: true });

for (const [name, render] of figures) {
  const { width, height, svg } = render();
  const svgPath = join(svgRoot, `${name}.svg`);
  const pngPath = join(pngRoot, `${name}.png`);

  writeFileSync(svgPath, svg, "utf8");

  const command = `${npxCommand} -y svgexport "${svgPath}" "${pngPath}" png 100%`;
  execSync(command, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });

  console.log(`Exported ${name} (${width}x${height})`);
}

console.log("Professional thesis figures exported.");
