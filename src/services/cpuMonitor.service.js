import os from 'node:os';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let monitorTimer = null;
let previousCpuTimes = null;
let highUsageStreak = 0;
let restartRequested = false;
let onThresholdExceeded = null;

function readCpuTimes() {
  let idle = 0;
  let total = 0;

  for (const { times } of os.cpus()) {
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.irq + times.idle;
  }

  return { idle, total };
}

function getSystemCpuPercent() {
  const current = readCpuTimes();

  if (!previousCpuTimes) {
    previousCpuTimes = current;
    return 0;
  }

  const idleDelta = current.idle - previousCpuTimes.idle;
  const totalDelta = current.total - previousCpuTimes.total;
  previousCpuTimes = current;

  if (totalDelta <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Number(((1 - idleDelta / totalDelta) * 100).toFixed(2))));
}

function requestRestart(cpuPercent) {
  if (restartRequested) {
    return;
  }

  restartRequested = true;

  logger.fatal(
    {
      cpuPercent,
      threshold: env.CPU_THRESHOLD_PERCENT,
      sustainedSeconds: env.CPU_SUSTAINED_SECONDS,
    },
    'System CPU threshold exceeded — restarting process'
  );

  if (typeof onThresholdExceeded === 'function') {
    onThresholdExceeded();
    return;
  }

  // Intentional restart fallback (exit 0) when no lifecycle hook is provided.
  setTimeout(() => process.exit(0), 250);
}

function onMonitorTick(requiredStreak) {
  const cpuPercent = getSystemCpuPercent();
  const aboveThreshold = cpuPercent >= env.CPU_THRESHOLD_PERCENT;

  if (!aboveThreshold) {
    if (highUsageStreak > 0) {
      logger.info({ cpuPercent }, 'CPU usage recovered below threshold');
      highUsageStreak = 0;
    }
    return;
  }

  highUsageStreak += 1;

  logger.warn(
    {
      cpuPercent,
      streak: highUsageStreak,
      requiredStreak,
      threshold: env.CPU_THRESHOLD_PERCENT,
    },
    'Elevated system CPU usage detected'
  );

  if (highUsageStreak >= requiredStreak) {
    requestRestart(cpuPercent);
  }
}

export function startCpuMonitor({ onThresholdExceeded: onExceeded } = {}) {
  if (monitorTimer) {
    return;
  }

  onThresholdExceeded = onExceeded ?? null;
  previousCpuTimes = readCpuTimes();

  const requiredStreak = Math.max(1, Math.ceil((env.CPU_SUSTAINED_SECONDS * 1000) / env.CPU_CHECK_INTERVAL_MS));

  monitorTimer = setInterval(() => onMonitorTick(requiredStreak), env.CPU_CHECK_INTERVAL_MS);
  monitorTimer.unref?.();

  logger.info(
    {
      threshold: env.CPU_THRESHOLD_PERCENT,
      sustainedSeconds: env.CPU_SUSTAINED_SECONDS,
      intervalMs: env.CPU_CHECK_INTERVAL_MS,
    },
    'CPU monitor started (system average)'
  );
}

export function stopCpuMonitor() {
  if (!monitorTimer) {
    return;
  }

  clearInterval(monitorTimer);
  monitorTimer = null;
  previousCpuTimes = null;
  highUsageStreak = 0;
  restartRequested = false;
  onThresholdExceeded = null;

  logger.info('CPU monitor stopped');
}
