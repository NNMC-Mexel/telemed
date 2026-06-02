const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_WORKING_INTERVALS = [
  { start: "09:00", end: "12:00" },
  { start: "14:00", end: "18:00" },
];

export const isValidTime = (time) =>
  typeof time === "string" && TIME_RE.test(time);

export const timeToMinutes = (time) => {
  if (!isValidTime(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (minutes) => {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const parseIntervals = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const normalizeWorkingIntervals = (value) =>
  parseIntervals(value)
    .map((interval) => ({
      start: interval?.start || interval?.startTime,
      end: interval?.end || interval?.endTime,
    }))
    .filter((interval) => {
      const start = timeToMinutes(interval.start);
      const end = timeToMinutes(interval.end);
      return start !== null && end !== null && start < end;
    })
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

export const legacyWorkingHoursToIntervals = ({
  workStartTime = "09:00",
  workEndTime = "18:00",
  breakStart = "12:00",
  breakEnd = "14:00",
} = {}) => {
  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const pauseStart = timeToMinutes(breakStart);
  const pauseEnd = timeToMinutes(breakEnd);

  if (workStart === null || workEnd === null || workStart >= workEnd) {
    return DEFAULT_WORKING_INTERVALS;
  }

  if (
    pauseStart === null ||
    pauseEnd === null ||
    pauseStart >= pauseEnd ||
    pauseStart <= workStart ||
    pauseEnd >= workEnd
  ) {
    return [{ start: workStartTime, end: workEndTime }];
  }

  return [
    { start: workStartTime, end: breakStart },
    { start: breakEnd, end: workEndTime },
  ].filter((interval) => timeToMinutes(interval.start) < timeToMinutes(interval.end));
};

export const getDoctorWorkingIntervals = (doctor = {}) => {
  const intervals = normalizeWorkingIntervals(doctor.workingIntervals);
  if (intervals.length > 0) return intervals;

  return legacyWorkingHoursToIntervals({
    workStartTime: doctor.workStartTime ?? "09:00",
    workEndTime: doctor.workEndTime ?? "18:00",
    breakStart: doctor.breakStart ?? "12:00",
    breakEnd: doctor.breakEnd ?? "14:00",
  });
};

export const validateWorkingIntervals = (value) => {
  const rawIntervals = parseIntervals(value);
  const normalized = normalizeWorkingIntervals(rawIntervals);

  if (rawIntervals.length === 0) {
    return { intervals: [], error: "empty" };
  }

  if (normalized.length !== rawIntervals.length) {
    return { intervals: normalized, error: "invalid" };
  }

  for (let i = 1; i < normalized.length; i += 1) {
    const prevEnd = timeToMinutes(normalized[i - 1].end);
    const nextStart = timeToMinutes(normalized[i].start);
    if (nextStart < prevEnd) {
      return { intervals: normalized, error: "overlap" };
    }
  }

  return { intervals: normalized, error: null };
};

export const generateSlotsFromIntervals = (intervals, slotDuration = 30) => {
  const duration = Number(slotDuration) || 30;
  const normalized = normalizeWorkingIntervals(intervals);
  const slots = [];

  normalized.forEach((interval) => {
    const start = timeToMinutes(interval.start);
    const end = timeToMinutes(interval.end);
    for (let current = start; current + duration <= end; current += duration) {
      slots.push(minutesToTime(current));
    }
  });

  return slots;
};
