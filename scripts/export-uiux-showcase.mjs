import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const outDir = join(repoRoot, "docs", "ui-ux");
const svgPath = join(outDir, "mindpulse-uiux-showcase.svg");
const pngPath = join(outDir, "mindpulse-uiux-showcase.png");

mkdirSync(outDir, { recursive: true });

const ui = {
  light: {
    background: "#F4F3EF",
    surface: "#FFFFFF",
    surfaceAlt: "#F0EFEA",
    textPrimary: "#1A1A1A",
    textSecondary: "#4A4A4A",
    textMuted: "#6A6A6A",
    textSubtle: "#8A8A8A",
    border: "#DADADA",
    accent: "#1A1A1A",
    accentText: "#FFFFFF",
    warning: "#B84A3A",
    stressedCard: "#F5EFEE",
    stressedText: "#6A2C2C",
    calmCard: "#F0F1F1",
    calmText: "#1A1A1A",
  },
  dark: {
    background: "#0F0F0F",
    surface: "#151515",
    surfaceAlt: "#1B1B1B",
    textPrimary: "#F2F2F2",
    textSecondary: "#B5B5B5",
    textMuted: "#8C8C8C",
    textSubtle: "#6C6C6C",
    border: "#2A2A2A",
    accent: "#F2F2F2",
    accentText: "#0F0F0F",
    warning: "#E07A5F",
    stressedCard: "#2A1E1E",
    stressedText: "#F4CFCF",
    calmCard: "#1D1F1F",
    calmText: "#F2F2F2",
  },
  board: {
    backdrop: "#ECEAE3",
    outline: "#121212",
    cardShadow: "rgba(18,18,18,0.08)",
    mint: "#DCEDE8",
    blush: "#F0E0DD",
    olive: "#D9DDC7",
  },
};

const FONT = "IBM Plex Sans, Segoe UI, Arial, sans-serif";

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const text = ({
  x,
  y,
  value,
  size = 14,
  weight = 400,
  fill = ui.light.textPrimary,
  opacity = 1,
  anchor = "start",
  letterSpacing = 0,
}) =>
  `<text x="${x}" y="${y}" fill="${fill}" opacity="${opacity}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letterSpacing}">${esc(
    value
  )}</text>`;

const rect = ({
  x,
  y,
  width,
  height,
  rx = 16,
  fill = "none",
  stroke = "none",
  strokeWidth = 1,
  filter = "",
  opacity = 1,
}) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" ${filter ? `filter="${filter}"` : ""} />`;

const line = ({ x1, y1, x2, y2, stroke, strokeWidth = 1, opacity = 1 }) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />`;

const circle = ({ cx, cy, r, fill, stroke = "none", strokeWidth = 1, opacity = 1 }) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" />`;

const button = ({
  x,
  y,
  width,
  height = 50,
  label,
  fill,
  color,
  stroke = "none",
  strokeWidth = 1,
  size = 15,
}) =>
  [
    rect({ x, y, width, height, rx: 18, fill, stroke, strokeWidth }),
    text({
      x: x + width / 2,
      y: y + height / 2 + 5,
      value: label,
      size,
      weight: 600,
      fill: color,
      anchor: "middle",
    }),
  ].join("");

const field = ({ x, y, width, label, value, palette }) =>
  [
    text({
      x,
      y,
      value: label,
      size: 12,
      weight: 600,
      fill: palette.textSecondary,
      letterSpacing: 0.4,
    }),
    rect({
      x,
      y: y + 10,
      width,
      height: 48,
      rx: 14,
      fill: palette.surface,
      stroke: palette.border,
    }),
    text({
      x: x + 14,
      y: y + 40,
      value,
      size: 14,
      fill: palette.textMuted,
    }),
  ].join("");

const badge = ({ x, y, label, fill, color }) =>
  [
    rect({ x, y, width: label.length * 7 + 24, height: 28, rx: 14, fill }),
    text({
      x: x + (label.length * 7 + 24) / 2,
      y: y + 19,
      value: label,
      size: 12,
      weight: 600,
      fill: color,
      anchor: "middle",
    }),
  ].join("");

const card = ({ x, y, width, height, palette, fill = palette.surface, inner = "" }) =>
  [
    rect({
      x,
      y,
      width,
      height,
      rx: 24,
      fill,
      stroke: palette.border,
      filter: "url(#softShadow)",
    }),
    inner,
  ].join("");

const tabBar = ({ x, y, width, active, palette }) => {
  const tabs = ["Dashboard", "Insights", "Settings"];
  const gap = width / tabs.length;
  const items = [
    rect({
      x,
      y,
      width,
      height: 60,
      rx: 22,
      fill: palette.surface,
      stroke: palette.border,
    }),
  ];

  tabs.forEach((label, index) => {
    const cx = x + gap * index + gap / 2;
    const selected = label === active;
    if (selected) {
      items.push(
        rect({
          x: x + gap * index + 10,
          y: y + 9,
          width: gap - 20,
          height: 42,
          rx: 18,
          fill: palette.surfaceAlt,
        })
      );
    }
    items.push(
      circle({
        cx,
        cy: y + 20,
        r: selected ? 6 : 5,
        fill: selected ? palette.accent : palette.textSubtle,
        opacity: selected ? 1 : 0.35,
      })
    );
    items.push(
      text({
        x: cx,
        y: y + 43,
        value: label,
        size: 10,
        weight: selected ? 700 : 500,
        fill: selected ? palette.textPrimary : palette.textSecondary,
        anchor: "middle",
      })
    );
  });

  return items.join("");
};

const phoneShell = ({ x, y, title, subtitle = "", palette, content }) =>
  `
  <g transform="translate(${x},${y})">
    ${text({ x: 180, y: -22, value: title, size: 18, weight: 700, fill: ui.board.outline, anchor: "middle" })}
    ${subtitle ? text({ x: 180, y: -2, value: subtitle, size: 11, fill: ui.light.textMuted, anchor: "middle" }) : ""}
    ${rect({ x: 0, y: 0, width: 360, height: 760, rx: 42, fill: "#0E0E0E", filter: "url(#phoneShadow)" })}
    ${rect({ x: 12, y: 12, width: 336, height: 736, rx: 34, fill: palette.background })}
    ${rect({ x: 124, y: 24, width: 112, height: 14, rx: 7, fill: palette.border, opacity: 0.8 })}
    ${content}
  </g>
`;

const loginScreenLegacy = (() => {
  const p = ui.light;
  return phoneShell({
    x: 520,
    y: 130,
    title: "Login",
    subtitle: "Auth flow",
    palette: p,
    content: `
      ${text({ x: 36, y: 92, value: "Welcome back", size: 24, weight: 700, fill: p.textPrimary })}
      ${text({ x: 36, y: 118, value: "Log in to continue your recovery flow.", size: 14, fill: p.textSecondary })}
      ${card({
        x: 24,
        y: 150,
        width: 312,
        height: 344,
        palette: p,
        inner: `
          ${field({ x: 46, y: 188, width: 268, label: "EMAIL", value: "you@email.com", palette: p })}
          ${field({ x: 46, y: 272, width: 268, label: "PASSWORD", value: "••••••••••", palette: p })}
          ${text({ x: 46, y: 362, value: "Remember email", size: 13, fill: p.textSecondary })}
          ${rect({ x: 250, y: 344, width: 64, height: 32, rx: 16, fill: p.accent })}
          ${circle({ cx: 294, cy: 360, r: 12, fill: p.accentText })}
          ${button({ x: 46, y: 396, width: 268, label: "Log in", fill: p.accent, color: p.accentText })}
          ${text({ x: 180, y: 472, value: "Forgot password?", size: 13, weight: 600, fill: p.accent, anchor: "middle" })}
        `,
      })}
      ${text({ x: 180, y: 556, value: "New here?", size: 13, fill: p.textSecondary, anchor: "middle" })}
      ${button({ x: 72, y: 576, width: 216, label: "Create an account", fill: "transparent", color: p.accent, stroke: p.border })}
    `,
  });
})();

const loginScreen = (() => {
  const p = ui.light;
  return phoneShell({
    x: 520,
    y: 130,
    title: "Login",
    subtitle: "Auth flow",
    palette: p,
    content: `
      ${badge({ x: 34, y: 76, label: "Secure Sign In", fill: ui.board.mint, color: p.textPrimary })}
      ${text({ x: 36, y: 126, value: "Welcome back", size: 24, weight: 700, fill: p.textPrimary })}
      ${text({ x: 36, y: 152, value: "Log in to resume monitoring and coaching.", size: 14, fill: p.textSecondary })}
      ${card({
        x: 24,
        y: 186,
        width: 312,
        height: 318,
        palette: p,
        inner: `
          ${field({ x: 46, y: 220, width: 268, label: "EMAIL", value: "you@email.com", palette: p })}
          ${field({ x: 46, y: 304, width: 268, label: "PASSWORD", value: "**********", palette: p })}
          ${text({ x: 46, y: 394, value: "Remember email", size: 13, fill: p.textSecondary })}
          ${text({ x: 314, y: 394, value: "Forgot?", size: 13, weight: 600, fill: p.accent, anchor: "end" })}
          ${rect({ x: 254, y: 376, width: 60, height: 30, rx: 15, fill: p.accent })}
          ${circle({ cx: 292, cy: 391, r: 11, fill: p.accentText })}
          ${button({ x: 46, y: 420, width: 268, label: "Log in", fill: p.accent, color: p.accentText })}
          ${text({ x: 180, y: 482, value: "Protected by Supabase authentication", size: 12, fill: p.textSubtle, anchor: "middle" })}
        `,
      })}
      ${text({ x: 180, y: 548, value: "New here?", size: 13, fill: p.textSecondary, anchor: "middle" })}
      ${button({ x: 72, y: 568, width: 216, height: 46, label: "Create account", fill: "transparent", color: p.accent, stroke: p.border })}
    `,
  });
})();

const dashboardScreenLegacy = (() => {
  const p = ui.light;
  return phoneShell({
    x: 930,
    y: 130,
    title: "Dashboard",
    subtitle: "Primary monitoring view",
    palette: p,
    content: `
      ${text({ x: 34, y: 88, value: "Welcome back", size: 14, fill: p.textSecondary })}
      ${text({ x: 34, y: 112, value: "MindPulse Dashboard", size: 22, weight: 700, fill: p.textPrimary })}
      ${badge({ x: 220, y: 84, label: "Watch Connected", fill: ui.board.mint, color: p.textPrimary })}
      ${card({
        x: 24,
        y: 138,
        width: 312,
        height: 132,
        palette: p,
        fill: p.calmCard,
        inner: `
          ${text({ x: 48, y: 174, value: "CURRENT STATE", size: 11, weight: 700, fill: p.calmText, letterSpacing: 1.2 })}
          ${text({ x: 48, y: 218, value: "Relaxed", size: 34, weight: 700, fill: p.accent })}
          ${text({ x: 48, y: 246, value: "Confidence 85%", size: 14, weight: 600, fill: p.calmText })}
        `,
      })}
      ${card({
        x: 24,
        y: 286,
        width: 146,
        height: 96,
        palette: p,
        inner: `
          ${text({ x: 42, y: 322, value: "HEART RATE", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 42, y: 358, value: "72 BPM", size: 24, weight: 700, fill: p.textPrimary })}
        `,
      })}
      ${card({
        x: 190,
        y: 286,
        width: 146,
        height: 96,
        palette: p,
        inner: `
          ${text({ x: 208, y: 322, value: "SKIN TEMP", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 208, y: 358, value: "33.5 C", size: 24, weight: 700, fill: p.textPrimary })}
        `,
      })}
      ${text({ x: 34, y: 410, value: "Last updated 9:41 PM", size: 12, fill: p.textSubtle })}
      ${line({ x1: 24, y1: 430, x2: 336, y2: 430, stroke: p.border })}
      ${card({
        x: 24,
        y: 450,
        width: 312,
        height: 208,
        palette: p,
        inner: `
          ${text({ x: 48, y: 486, value: "Coach", size: 18, weight: 700, fill: p.textPrimary })}
          ${text({ x: 48, y: 510, value: "Generates a short insight using your current state", size: 12, fill: p.textSecondary })}
          ${text({ x: 48, y: 526, value: "and environment data.", size: 12, fill: p.textSecondary })}
          ${circle({ cx: 84, cy: 582, r: 34, fill: "#191919" })}
          ${circle({ cx: 84, cy: 582, r: 24, fill: "#2A2A2A", opacity: 0.9 })}
          ${rect({ x: 134, y: 548, width: 174, height: 76, rx: 22, fill: p.surfaceAlt, stroke: p.border })}
          ${text({ x: 150, y: 578, value: "Tap Generate Insight to get a short,", size: 12, fill: p.textPrimary })}
          ${text({ x: 150, y: 596, value: "tailored suggestion.", size: 12, fill: p.textPrimary })}
          ${button({ x: 48, y: 634, width: 182, height: 42, label: "Generate Insight", fill: p.accent, color: p.accentText, size: 13 })}
          ${button({ x: 242, y: 634, width: 66, height: 42, label: "Clear", fill: "transparent", color: p.accent, stroke: p.border, size: 13 })}
        `,
      })}
      ${button({ x: 24, y: 674, width: 312, label: "Start Box Breathing", fill: p.accent, color: p.accentText })}
      ${tabBar({ x: 24, y: 676, width: 312, active: "Dashboard", palette: p })}
    `.replace(
      tabBar({ x: 24, y: 676, width: 312, active: "Dashboard", palette: p }),
      tabBar({ x: 24, y: 676, width: 312, active: "Dashboard", palette: p })
    ),
  });
})();

const dashboardScreen = (() => {
  const p = ui.light;
  return phoneShell({
    x: 930,
    y: 130,
    title: "Dashboard",
    subtitle: "Primary monitoring view",
    palette: p,
    content: `
      ${text({ x: 34, y: 88, value: "Welcome back", size: 14, fill: p.textSecondary })}
      ${text({ x: 34, y: 114, value: "MindPulse", size: 22, weight: 700, fill: p.textPrimary })}
      ${text({ x: 34, y: 140, value: "Dashboard", size: 22, weight: 700, fill: p.textPrimary })}
      ${badge({ x: 222, y: 108, label: "Watch Connected", fill: ui.board.mint, color: p.textPrimary })}
      ${card({
        x: 24,
        y: 160,
        width: 312,
        height: 114,
        palette: p,
        fill: p.calmCard,
        inner: `
          ${text({ x: 48, y: 194, value: "CURRENT STATE", size: 11, weight: 700, fill: p.calmText, letterSpacing: 1.2 })}
          ${text({ x: 48, y: 232, value: "Relaxed", size: 32, weight: 700, fill: p.accent })}
          ${text({ x: 48, y: 258, value: "Confidence 85%  |  Stable signal quality", size: 13, weight: 600, fill: p.calmText })}
        `,
      })}
      ${card({
        x: 24,
        y: 292,
        width: 146,
        height: 90,
        palette: p,
        inner: `
          ${text({ x: 42, y: 326, value: "HEART RATE", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 42, y: 360, value: "72 BPM", size: 24, weight: 700, fill: p.textPrimary })}
        `,
      })}
      ${card({
        x: 190,
        y: 292,
        width: 146,
        height: 90,
        palette: p,
        inner: `
          ${text({ x: 208, y: 326, value: "SKIN TEMP", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 208, y: 360, value: "33.5 C", size: 24, weight: 700, fill: p.textPrimary })}
        `,
      })}
      ${text({ x: 34, y: 402, value: "Last updated 9:41 PM", size: 12, fill: p.textSubtle })}
      ${line({ x1: 24, y1: 418, x2: 336, y2: 418, stroke: p.border })}
      ${card({
        x: 24,
        y: 428,
        width: 312,
        height: 194,
        palette: p,
        inner: `
          ${text({ x: 48, y: 462, value: "Coach", size: 18, weight: 700, fill: p.textPrimary })}
          ${text({ x: 48, y: 486, value: "Uses physiological state and environment", size: 12, fill: p.textSecondary })}
          ${text({ x: 48, y: 504, value: "signals to suggest one short next step.", size: 12, fill: p.textSecondary })}
          ${circle({ cx: 82, cy: 544, r: 28, fill: "#191919" })}
          ${circle({ cx: 82, cy: 544, r: 18, fill: "#2A2A2A", opacity: 0.92 })}
          ${rect({ x: 122, y: 512, width: 184, height: 64, rx: 20, fill: p.surfaceAlt, stroke: p.border })}
          ${text({ x: 138, y: 540, value: "AQI is moderate today. Take a short", size: 12, fill: p.textPrimary })}
          ${text({ x: 138, y: 558, value: "indoor reset before the next check-in.", size: 12, fill: p.textPrimary })}
          ${button({ x: 48, y: 578, width: 258, height: 38, label: "Generate Insight", fill: p.accent, color: p.accentText, size: 13 })}
        `,
      })}
      ${button({ x: 24, y: 628, width: 312, height: 44, label: "Start Box Breathing", fill: p.accent, color: p.accentText })}
      ${tabBar({ x: 24, y: 680, width: 312, active: "Dashboard", palette: p })}
    `,
  });
})();

const insightsScreenLegacy = (() => {
  const p = ui.light;
  return phoneShell({
    x: 1340,
    y: 130,
    title: "Insights",
    subtitle: "History and context",
    palette: p,
    content: `
      ${text({ x: 34, y: 92, value: "Weekly Stress", size: 22, weight: 700, fill: p.textPrimary })}
      ${card({
        x: 24,
        y: 118,
        width: 312,
        height: 164,
        palette: p,
        inner: `
          ${line({ x1: 54, y1: 238, x2: 304, y2: 238, stroke: p.border })}
          ${line({ x1: 54, y1: 204, x2: 304, y2: 204, stroke: p.border, opacity: 0.6 })}
          ${line({ x1: 54, y1: 170, x2: 304, y2: 170, stroke: p.border, opacity: 0.4 })}
          <polyline points="54,224 92,206 130,214 168,178 206,196 244,154 282,164" fill="none" stroke="${p.accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            .map((label, index) =>
              text({
                x: 54 + index * 38,
                y: 258,
                value: label,
                size: 10,
                fill: p.textSubtle,
              })
            )
            .join("")}
        `,
      })}
      ${text({ x: 34, y: 314, value: "Recent Stress Events", size: 16, weight: 700, fill: p.textPrimary })}
      ${card({
        x: 24,
        y: 330,
        width: 312,
        height: 72,
        palette: p,
        inner: `
          ${text({ x: 46, y: 360, value: "Mon, 7:20 PM", size: 14, weight: 600, fill: p.textPrimary })}
          ${text({ x: 46, y: 382, value: "Result: Stressed", size: 12, fill: p.textPrimary })}
          ${text({ x: 46, y: 398, value: "Fused 85%  RF 82%  LSTM 88%", size: 11, fill: p.textSecondary })}
        `,
      })}
      ${card({
        x: 24,
        y: 414,
        width: 312,
        height: 224,
        palette: p,
        inner: `
          ${text({ x: 46, y: 444, value: "Environmental Context", size: 16, weight: 700, fill: p.textPrimary })}
          ${rect({ x: 46, y: 462, width: 268, height: 92, rx: 18, fill: "#E6E2D8", stroke: p.border })}
          ${line({ x1: 56, y1: 540, x2: 180, y2: 486, stroke: p.textSubtle, strokeWidth: 2, opacity: 0.6 })}
          ${line({ x1: 162, y1: 470, x2: 286, y2: 534, stroke: p.textSubtle, strokeWidth: 2, opacity: 0.6 })}
          ${circle({ cx: 184, cy: 508, r: 8, fill: p.accent })}
          ${text({ x: 46, y: 580, value: "Bangkok, Thailand", size: 14, weight: 600, fill: p.textPrimary })}
          ${text({ x: 46, y: 600, value: "Partly cloudy", size: 12, fill: p.textSecondary })}
          ${text({ x: 46, y: 626, value: "Temp", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 46, y: 648, value: "31.2 C", size: 18, weight: 700, fill: p.textPrimary })}
          ${text({ x: 148, y: 626, value: "Humidity", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 148, y: 648, value: "68%", size: 18, weight: 700, fill: p.textPrimary })}
          ${text({ x: 248, y: 626, value: "US AQI", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 248, y: 648, value: "74", size: 18, weight: 700, fill: p.textPrimary })}
        `,
      })}
      ${tabBar({ x: 24, y: 676, width: 312, active: "Insights", palette: p })}
    `,
  });
})();

const insightsScreen = (() => {
  const p = ui.light;
  return phoneShell({
    x: 1340,
    y: 130,
    title: "Insights",
    subtitle: "History and context",
    palette: p,
    content: `
      ${text({ x: 34, y: 90, value: "Weekly Stress", size: 22, weight: 700, fill: p.textPrimary })}
      ${text({ x: 34, y: 114, value: "Trend, recent events, and environmental context", size: 13, fill: p.textSecondary })}
      ${badge({ x: 254, y: 84, label: "7 days", fill: ui.board.mint, color: p.textPrimary })}
      ${card({
        x: 24,
        y: 132,
        width: 312,
        height: 156,
        palette: p,
        inner: `
          ${line({ x1: 54, y1: 244, x2: 304, y2: 244, stroke: p.border })}
          ${line({ x1: 54, y1: 210, x2: 304, y2: 210, stroke: p.border, opacity: 0.6 })}
          ${line({ x1: 54, y1: 176, x2: 304, y2: 176, stroke: p.border, opacity: 0.4 })}
          <polyline points="54,230 92,212 130,220 168,184 206,202 244,160 282,170" fill="none" stroke="${p.accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            .map((label, index) =>
              text({
                x: 54 + index * 38,
                y: 264,
                value: label,
                size: 10,
                fill: p.textSubtle,
              })
            )
            .join("")}
        `,
      })}
      ${text({ x: 34, y: 314, value: "Recent Stress Events", size: 16, weight: 700, fill: p.textPrimary })}
      ${card({
        x: 24,
        y: 330,
        width: 312,
        height: 80,
        palette: p,
        inner: `
          ${text({ x: 46, y: 360, value: "Mon, 7:20 PM", size: 14, weight: 600, fill: p.textPrimary })}
          ${badge({ x: 232, y: 344, label: "Stressed", fill: ui.board.blush, color: ui.light.warning })}
          ${text({ x: 46, y: 384, value: "Fused confidence 85%  |  RF 82%  |  LSTM 88%", size: 11, fill: p.textSecondary })}
          ${text({ x: 46, y: 404, value: "Indoor recommendation triggered after AQI increase.", size: 12, fill: p.textPrimary })}
        `,
      })}
      ${card({
        x: 24,
        y: 426,
        width: 312,
        height: 228,
        palette: p,
        inner: `
          ${text({ x: 46, y: 458, value: "Environmental Snapshot", size: 16, weight: 700, fill: p.textPrimary })}
          ${rect({ x: 46, y: 476, width: 268, height: 86, rx: 18, fill: "#E6E2D8", stroke: p.border })}
          ${line({ x1: 56, y1: 548, x2: 180, y2: 494, stroke: p.textSubtle, strokeWidth: 2, opacity: 0.6 })}
          ${line({ x1: 162, y1: 478, x2: 286, y2: 542, stroke: p.textSubtle, strokeWidth: 2, opacity: 0.6 })}
          ${circle({ cx: 184, cy: 516, r: 8, fill: p.accent })}
          ${text({ x: 46, y: 590, value: "Bangkok, Thailand", size: 14, weight: 600, fill: p.textPrimary })}
          ${text({ x: 46, y: 610, value: "Partly cloudy  |  Moderate air quality", size: 12, fill: p.textSecondary })}
          ${text({ x: 46, y: 632, value: "Temp", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 46, y: 654, value: "31.2 C", size: 18, weight: 700, fill: p.textPrimary })}
          ${text({ x: 148, y: 632, value: "Humidity", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 148, y: 654, value: "68%", size: 18, weight: 700, fill: p.textPrimary })}
          ${text({ x: 248, y: 632, value: "US AQI", size: 11, weight: 700, fill: p.textSecondary, letterSpacing: 1 })}
          ${text({ x: 248, y: 654, value: "74", size: 18, weight: 700, fill: p.textPrimary })}
        `,
      })}
      ${tabBar({ x: 24, y: 680, width: 312, active: "Insights", palette: p })}
    `,
  });
})();

const interventionScreenLegacy = (() => {
  const p = ui.dark;
  return phoneShell({
    x: 724,
    y: 972,
    title: "Intervention",
    subtitle: "Focused breathing modal",
    palette: p,
    content: `
      ${rect({ x: 24, y: 94, width: 312, height: 612, rx: 28, fill: "rgba(21,21,21,0.72)", stroke: p.border })}
      ${card({
        x: 42,
        y: 154,
        width: 276,
        height: 444,
        palette: p,
        fill: p.surface,
        inner: `
          ${text({ x: 180, y: 202, value: "Box Breathing", size: 24, weight: 700, fill: p.textPrimary, anchor: "middle" })}
          ${text({ x: 180, y: 228, value: "Follow the circle and breathe", size: 13, fill: p.textSecondary, anchor: "middle" })}
          ${circle({ cx: 180, cy: 334, r: 82, fill: "rgba(242,242,242,0.08)", stroke: p.accent, strokeWidth: 2 })}
          ${circle({ cx: 180, cy: 334, r: 58, fill: "rgba(242,242,242,0.04)" })}
          ${text({ x: 180, y: 454, value: "Inhale", size: 24, weight: 700, fill: p.textPrimary, anchor: "middle" })}
          ${text({ x: 90, y: 492, value: "4s inhale", size: 12, fill: p.textMuted, anchor: "middle" })}
          ${text({ x: 180, y: 492, value: "4s hold", size: 12, fill: p.textMuted, anchor: "middle" })}
          ${text({ x: 270, y: 492, value: "4s exhale", size: 12, fill: p.textMuted, anchor: "middle" })}
          ${button({ x: 72, y: 532, width: 216, label: "I feel better", fill: p.accent, color: p.accentText })}
        `,
      })}
    `,
  });
})();

const interventionScreen = (() => {
  const p = ui.dark;
  return phoneShell({
    x: 724,
    y: 928,
    title: "Intervention",
    subtitle: "Focused breathing modal",
    palette: p,
    content: `
      ${rect({ x: 24, y: 96, width: 312, height: 606, rx: 28, fill: "rgba(21,21,21,0.72)", stroke: p.border })}
      ${card({
        x: 42,
        y: 154,
        width: 276,
        height: 438,
        palette: p,
        fill: p.surface,
        inner: `
          ${badge({ x: 110, y: 184, label: "Round 2 of 4", fill: "rgba(242,242,242,0.08)", color: p.textSecondary })}
          ${text({ x: 180, y: 226, value: "Box Breathing", size: 24, weight: 700, fill: p.textPrimary, anchor: "middle" })}
          ${text({ x: 180, y: 252, value: "Follow the circle and reset your pace", size: 13, fill: p.textSecondary, anchor: "middle" })}
          ${circle({ cx: 180, cy: 344, r: 88, fill: "rgba(242,242,242,0.08)", stroke: p.accent, strokeWidth: 2 })}
          ${circle({ cx: 180, cy: 344, r: 62, fill: "rgba(242,242,242,0.04)" })}
          ${text({ x: 180, y: 458, value: "Inhale", size: 24, weight: 700, fill: p.textPrimary, anchor: "middle" })}
          ${text({ x: 180, y: 486, value: "4s inhale  |  4s hold  |  4s exhale", size: 12, fill: p.textMuted, anchor: "middle" })}
          ${button({ x: 72, y: 528, width: 216, height: 46, label: "I feel better", fill: p.accent, color: p.accentText })}
          ${text({ x: 180, y: 590, value: "Swipe down to dismiss", size: 12, fill: p.textSubtle, anchor: "middle" })}
        `,
      })}
    `,
  });
})();

const settingsScreenLegacy = (() => {
  const p = ui.light;
  return phoneShell({
    x: 1134,
    y: 972,
    title: "Settings",
    subtitle: "Profile and preferences",
    palette: p,
    content: `
      ${text({ x: 34, y: 90, value: "Profile", size: 22, weight: 700, fill: p.textPrimary })}
      ${card({
        x: 24,
        y: 116,
        width: 312,
        height: 220,
        palette: p,
        inner: `
          ${text({ x: 46, y: 150, value: "Account", size: 16, weight: 700, fill: p.textPrimary })}
          ${field({ x: 46, y: 174, width: 268, label: "FULL NAME", value: "Alex Morgan", palette: p })}
          ${field({ x: 46, y: 258, width: 268, label: "EMAIL", value: "user@mindpulse.app", palette: p })}
          ${badge({ x: 210, y: 302, label: "Connected", fill: ui.board.mint, color: p.textPrimary })}
        `,
      })}
      ${card({
        x: 24,
        y: 352,
        width: 312,
        height: 124,
        palette: p,
        inner: `
          ${text({ x: 46, y: 386, value: "Appearance", size: 16, weight: 700, fill: p.textPrimary })}
          ${button({ x: 46, y: 412, width: 72, height: 40, label: "System", fill: p.accent, color: p.accentText, size: 12 })}
          ${button({ x: 126, y: 412, width: 72, height: 40, label: "Light", fill: "transparent", color: p.accent, stroke: p.border, size: 12 })}
          ${button({ x: 206, y: 412, width: 72, height: 40, label: "Dark", fill: "transparent", color: p.accent, stroke: p.border, size: 12 })}
        `,
      })}
      ${card({
        x: 24,
        y: 492,
        width: 312,
        height: 84,
        palette: p,
        inner: `
          ${text({ x: 46, y: 526, value: "Push Notifications", size: 15, weight: 700, fill: p.textPrimary })}
          ${text({ x: 46, y: 546, value: "Stress alerts and reminders", size: 12, fill: p.textSecondary })}
          ${rect({ x: 254, y: 516, width: 60, height: 30, rx: 15, fill: p.accent })}
          ${circle({ cx: 294, cy: 531, r: 11, fill: p.accentText })}
        `,
      })}
      ${button({ x: 24, y: 594, width: 312, label: "Disconnect Wearable", fill: ui.light.warning, color: ui.light.accentText })}
      ${button({ x: 24, y: 652, width: 312, label: "Log out", fill: "transparent", color: p.accent, stroke: p.border })}
      ${button({ x: 24, y: 710, width: 312, label: "Delete profile data", fill: ui.board.blush, color: ui.light.warning })}
      ${tabBar({ x: 24, y: 676, width: 312, active: "Settings", palette: p })}
    `.replace(
      tabBar({ x: 24, y: 676, width: 312, active: "Settings", palette: p }),
      tabBar({ x: 24, y: 676, width: 312, active: "Settings", palette: p })
    ),
  });
})();

const settingsScreen = (() => {
  const p = ui.light;
  return phoneShell({
    x: 1134,
    y: 928,
    title: "Settings",
    subtitle: "Profile and preferences",
    palette: p,
    content: `
      ${text({ x: 34, y: 90, value: "Profile", size: 22, weight: 700, fill: p.textPrimary })}
      ${text({ x: 34, y: 114, value: "Preferences and wearable connection", size: 13, fill: p.textSecondary })}
      ${card({
        x: 24,
        y: 130,
        width: 312,
        height: 156,
        palette: p,
        inner: `
          ${text({ x: 46, y: 164, value: "Account", size: 16, weight: 700, fill: p.textPrimary })}
          ${circle({ cx: 74, cy: 212, r: 24, fill: ui.board.mint })}
          ${text({ x: 110, y: 208, value: "Alex Morgan", size: 16, weight: 700, fill: p.textPrimary })}
          ${text({ x: 110, y: 230, value: "user@mindpulse.app", size: 13, fill: p.textSecondary })}
          ${line({ x1: 46, y1: 250, x2: 314, y2: 250, stroke: p.border })}
          ${text({ x: 46, y: 278, value: "Wearable", size: 13, weight: 600, fill: p.textSecondary })}
          ${badge({ x: 220, y: 260, label: "Connected", fill: ui.board.mint, color: p.textPrimary })}
        `,
      })}
      ${card({
        x: 24,
        y: 304,
        width: 312,
        height: 104,
        palette: p,
        inner: `
          ${text({ x: 46, y: 338, value: "Appearance", size: 16, weight: 700, fill: p.textPrimary })}
          ${button({ x: 46, y: 358, width: 72, height: 36, label: "System", fill: p.accent, color: p.accentText, size: 12 })}
          ${button({ x: 126, y: 358, width: 72, height: 36, label: "Light", fill: "transparent", color: p.accent, stroke: p.border, size: 12 })}
          ${button({ x: 206, y: 358, width: 72, height: 36, label: "Dark", fill: "transparent", color: p.accent, stroke: p.border, size: 12 })}
        `,
      })}
      ${card({
        x: 24,
        y: 424,
        width: 312,
        height: 86,
        palette: p,
        inner: `
          ${text({ x: 46, y: 458, value: "Push Notifications", size: 15, weight: 700, fill: p.textPrimary })}
          ${text({ x: 46, y: 478, value: "Stress alerts and breathing reminders", size: 12, fill: p.textSecondary })}
          ${rect({ x: 254, y: 448, width: 60, height: 30, rx: 15, fill: p.accent })}
          ${circle({ cx: 294, cy: 463, r: 11, fill: p.accentText })}
        `,
      })}
      ${card({
        x: 24,
        y: 526,
        width: 312,
        height: 58,
        palette: p,
        inner: `
          ${text({ x: 46, y: 552, value: "Connected wearable", size: 13, weight: 600, fill: p.textSecondary })}
          ${button({ x: 198, y: 538, width: 116, height: 34, label: "Disconnect", fill: ui.board.blush, color: ui.light.warning, size: 12 })}
        `,
      })}
      ${button({ x: 24, y: 602, width: 312, height: 42, label: "Log out", fill: "transparent", color: p.accent, stroke: p.border })}
      ${text({ x: 180, y: 666, value: "Delete profile data", size: 13, weight: 600, fill: ui.light.warning, anchor: "middle" })}
      ${tabBar({ x: 24, y: 684, width: 312, active: "Settings", palette: p })}
    `,
  });
})();

const sidebar = (() => {
  const p = ui.light;
  const swatch = (x, y, label, fill, value) =>
    `
      ${rect({ x, y, width: 164, height: 70, rx: 18, fill, stroke: p.border })}
      ${text({ x: x + 16, y: y + 28, value: label, size: 12, weight: 700, fill: fill === p.accent ? p.accentText : p.textSecondary, letterSpacing: 1 })}
      ${text({ x: x + 16, y: y + 50, value, size: 14, weight: 600, fill: fill === p.accent ? p.accentText : p.textPrimary })}
    `;

  return `
    <g transform="translate(56,132)">
      ${text({ x: 0, y: 0, value: "MindPulse UI/UX Showcase", size: 42, weight: 700, fill: ui.board.outline })}
      ${text({ x: 0, y: 32, value: "Calm monitoring, low-noise wellness UI, and contextual coaching surfaces.", size: 16, fill: p.textSecondary })}
      ${card({
        x: 0,
        y: 72,
        width: 394,
        height: 286,
        palette: p,
        inner: `
          ${text({ x: 28, y: 112, value: "Visual System", size: 18, weight: 700, fill: p.textPrimary })}
          ${text({ x: 28, y: 138, value: "Monochrome surfaces with warm warning tones and large", size: 13, fill: p.textSecondary })}
          ${text({ x: 28, y: 156, value: "state typography keep the interface calm and legible.", size: 13, fill: p.textSecondary })}
          ${swatch(28, 182, "Background", p.background, "#F4F3EF")}
          ${swatch(202, 182, "Surface", p.surface, "#FFFFFF")}
          ${swatch(28, 260, "Accent", p.accent, "#1A1A1A")}
          ${swatch(202, 260, "Warning", p.warning, "#B84A3A")}
        `,
      })}
      ${card({
        x: 0,
        y: 378,
        width: 394,
        height: 214,
        palette: p,
        inner: `
          ${text({ x: 28, y: 418, value: "Type Scale", size: 18, weight: 700, fill: p.textPrimary })}
          ${text({ x: 28, y: 452, value: "Display 32 / 700", size: 26, weight: 700, fill: p.textPrimary })}
          ${text({ x: 28, y: 486, value: "Title 22 / 600", size: 22, weight: 600, fill: p.textPrimary })}
          ${text({ x: 28, y: 516, value: "Subtitle 16 / 600", size: 16, weight: 600, fill: p.textPrimary })}
          ${text({ x: 28, y: 544, value: "Body 14 / 400", size: 14, fill: p.textSecondary })}
          ${text({ x: 28, y: 566, value: "Caption 12 / 400", size: 12, fill: p.textMuted })}
        `,
      })}
      ${card({
        x: 0,
        y: 612,
        width: 394,
        height: 252,
        palette: p,
        inner: `
          ${text({ x: 28, y: 652, value: "UX Priorities", size: 18, weight: 700, fill: p.textPrimary })}
          ${text({ x: 28, y: 686, value: "1. Fast reading of current state", size: 14, fill: p.textPrimary })}
          ${text({ x: 28, y: 714, value: "2. Low-friction authentication and recovery", size: 14, fill: p.textPrimary })}
          ${text({ x: 28, y: 742, value: "3. Context-rich insights without overload", size: 14, fill: p.textPrimary })}
          ${text({ x: 28, y: 770, value: "4. Focused breathing intervention flow", size: 14, fill: p.textPrimary })}
          ${text({ x: 28, y: 798, value: "5. Clear profile, theme, and device controls", size: 14, fill: p.textPrimary })}
          ${text({ x: 28, y: 826, value: "6. Comfortable spacing above persistent navigation", size: 14, fill: p.textPrimary })}
        `,
      })}
    </g>
  `;
})();

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1820" height="1740" viewBox="0 0 1820 1740" fill="none">
  <defs>
    <linearGradient id="boardGradient" x1="0" y1="0" x2="1820" y2="1740" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${ui.board.backdrop}" />
      <stop offset="1" stop-color="#F6F4EE" />
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="34" height="34" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="${ui.light.textSubtle}" opacity="0.22" />
    </pattern>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="${ui.board.cardShadow}" />
    </filter>
    <filter id="phoneShadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="rgba(0,0,0,0.18)" />
    </filter>
  </defs>

  ${rect({ x: 0, y: 0, width: 1820, height: 1740, rx: 0, fill: "url(#boardGradient)" })}
  ${rect({ x: 0, y: 0, width: 1820, height: 1740, rx: 0, fill: "url(#dots)", opacity: 0.7 })}
  ${sidebar}
  ${loginScreen}
  ${dashboardScreen}
  ${insightsScreen}
  ${interventionScreen}
  ${settingsScreen}
</svg>
`;

writeFileSync(svgPath, svg, "utf8");

execSync(`npx -y svgexport "${svgPath}" "${pngPath}" png 100%`, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
});

console.log(`UI/UX showcase exported to ${svgPath}`);
