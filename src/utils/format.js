export const formatTime = (isoString) => {
  if (!isoString) return "--";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString();
};

export const formatRatioAsPercent = (value, digits = 0) => {
  if (!Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
};

export const formatNumber = (value, digits = 0) => {
  if (!Number.isFinite(value)) return "--";
  const fixed = Number(value).toFixed(digits);
  return fixed.replace(/\.0+$/, "");
};

export const formatNumberWithUnit = (value, unit, digits = 0) => {
  const formatted = formatNumber(value, digits);
  return formatted === "--" ? "--" : `${formatted}${unit}`;
};
