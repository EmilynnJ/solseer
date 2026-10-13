// Straight-line (least squares) projection of monthly values. Only months from
// the first non-zero value onward are used, and at least three are required.
export function linearForecast(values: number[], ahead = 3): number[] {
  const firstActive = values.findIndex((value) => value > 0);
  if (firstActive < 0) return [];
  const series = values.slice(firstActive);
  if (series.length < 3) return [];
  const n = series.length;
  const meanX = (n - 1) / 2;
  const meanY = series.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  series.forEach((value, x) => {
    numerator += (x - meanX) * (value - meanY);
    denominator += (x - meanX) ** 2;
  });
  const slope = denominator ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  return Array.from({ length: ahead }, (_, step) =>
    Math.max(0, Math.round(intercept + slope * (n + step))),
  );
}
