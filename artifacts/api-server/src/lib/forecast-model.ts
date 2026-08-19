export interface ForecastObservation {
  year: number;
  bucket: number;
  value: number;
}

/**
 * ISO-8601 week number (1–53) for a UTC date. Snowflake's DATE_TRUNC('week', …)
 * defaults to Monday-start weeks, so aligning historical observations and
 * generated future periods on the ISO week keeps the same calendar week in the
 * same seasonal bucket across years — a plain Jan-1-relative day offset drifts
 * by up to six days each year and misaligns the buckets.
 */
export function isoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday of the current ISO week determines the ISO year/week.
  const dayNumber = (target.getUTCDay() + 6) % 7; // 0 = Monday
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** Monday (UTC) that starts the given ISO week within an ISO year. */
export function isoWeekStart(isoYear: number, week: number): Date {
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayDay = (firstThursday.getUTCDay() + 6) % 7;
  const firstMonday = new Date(firstThursday.getTime() - firstThursdayDay * 86_400_000);
  return new Date(firstMonday.getTime() + (week - 1) * 7 * 86_400_000);
}

export interface ForecastModelPoint {
  value: number | null;
  lower: number | null;
  upper: number | null;
}

export interface SeasonalTrendModel {
  points: Map<number, ForecastModelPoint>;
  modeledBuckets: number[];
  missingBuckets: number[];
}

function mean(values: number[]): number {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function linearPrediction(values: ForecastObservation[], targetYear: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0]!.value;

  const averageYear = mean(values.map(value => value.year));
  const averageValue = mean(values.map(value => value.value));
  const denominator = values.reduce((sum, value) => sum + (value.year - averageYear) ** 2, 0);
  if (denominator === 0) return averageValue;

  const slope = values.reduce(
    (sum, value) => sum + (value.year - averageYear) * (value.value - averageValue),
    0,
  ) / denominator;
  return Math.max(0, averageValue + slope * (targetYear - averageYear));
}

function leaveOneOutResiduals(values: ForecastObservation[]): number[] {
  if (values.length < 3) return [];
  return values.map((value, index) => {
    const trainingValues = values.filter((_, trainingIndex) => trainingIndex !== index);
    return value.value - linearPrediction(trainingValues, value.year);
  });
}

/**
 * Fit a separate linear trend for each calendar bucket (month or week-of-year).
 * Seasonal shape comes from the bucket observations; no synthetic multipliers are used.
 */
export function buildSeasonalTrendModel(
  observations: ForecastObservation[],
  targetYear: number,
  buckets: number[],
): SeasonalTrendModel {
  const byBucket = new Map<number, ForecastObservation[]>();
  for (const observation of observations) {
    if (!Number.isFinite(observation.value) || observation.value < 0) continue;
    const bucketValues = byBucket.get(observation.bucket) ?? [];
    bucketValues.push(observation);
    byBucket.set(observation.bucket, bucketValues);
  }

  const allValues = observations
    .filter(observation => Number.isFinite(observation.value) && observation.value >= 0)
    .map(observation => observation.value);
  const globalSpread = standardDeviation(
    [...byBucket.values()].flatMap(bucketValues => leaveOneOutResiduals(bucketValues)),
  );
  const points = new Map<number, ForecastModelPoint>();
  const modeledBuckets: number[] = [];
  const missingBuckets: number[] = [];

  for (const bucket of buckets) {
    const bucketValues = byBucket.get(bucket) ?? [];
    // A single historical occurrence cannot establish a seasonal trend or
    // uncertainty. Return an explicit gap instead of repeating it as a forecast.
    if (bucketValues.length < 2) {
      points.set(bucket, { value: null, lower: null, upper: null });
      missingBuckets.push(bucket);
      continue;
    }

    const value = linearPrediction(bucketValues, targetYear);
    // Forecast bounds reflect out-of-sample residuals from the fitted seasonal
    // trend. This keeps a rising but perfectly consistent series narrow, while
    // widening bounds only when the actual history is noisy.
    const residuals = leaveOneOutResiduals(bucketValues);
    const spread = standardDeviation(residuals) || standardDeviation(
      leaveOneOutResiduals(observations.filter(observation => observation.bucket === bucket)),
    ) || globalSpread;
    const margin = 1.96 * spread;
    points.set(bucket, {
      value: Math.round(value),
      lower: Math.max(0, Math.round(value - margin)),
      upper: Math.round(value + margin),
    });
    modeledBuckets.push(bucket);
  }

  return { points, modeledBuckets, missingBuckets };
}