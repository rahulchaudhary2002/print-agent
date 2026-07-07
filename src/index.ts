import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { buildApp } from './app.js';
import { ApplicationService } from './applications/index.js';
import {
  AuthStore,
  CloudConnector,
  CloudEventBus,
  HeartbeatService,
  HttpRegistrationTransport,
  MachineIdentityService,
  NullRegistrationTransport,
  OfflineSyncService,
  ReconnectPolicy,
  RegistrationService,
  WebSocketClient,
  type RegistrationTransport,
} from './cloud/index.js';
import { ConfigService, type AppConfig } from './config/index.js';
import {
  ApplicationRepository,
  DatabaseService,
  PrinterConfigurationRepository,
  PrinterHealthRepository,
  PrinterProfileRepository,
  PrinterRepository,
  PrintJobEventRepository,
  PrintJobRepository,
} from './database/index.js';
import { CodePage, EscPosRenderer, RendererRegistry, type PaperWidthPreset } from './document/index.js';
import { DriverFactory, DriverRegistry, registerBuiltInDrivers } from './drivers/index.js';
import { readNumber, readString } from './drivers/base/index.js';
import { PipelineEventEmitter } from './events/index.js';
import { HealthService, MetricsService, PrintPipelineService, resolvePipelineConfig } from './pipeline/index.js';
import {
  CapabilityDetectorService,
  DiscoveryManager,
  DiscoveryScheduler,
  DiscoveryService,
  PrinterCacheService,
  PrinterConfigurationService,
  PrinterEventBus,
  PrinterHealthMonitor,
  PrinterManager,
  PrinterProfileService,
  PrinterRecoveryManager,
  PrinterService,
  PrinterValidationService,
} from './printer/index.js';
import { JobService, QueueService, QueueWorker } from './queue/index.js';
import {
  ProcessInfo,
  ProcessWatchdog,
  ServiceEventBus,
  ServiceManager,
  ShutdownSequence,
  SignalHandler,
  StartupSequence,
  StartupValidator,
  DEFAULT_RECOVERY_POLICIES,
  type ShutdownSignal,
} from './service/index.js';
import { LoggerService, LogQueryService } from './services/index.js';
import {
  CLOUD_CONFIG_FILE_PATH,
  CLOUD_CREDENTIALS_FILE_PATH,
  CONFIG_FILE_PATH,
  CRASH_MARKER_FILE_PATH,
  DATABASE_FILE_PATH,
  LOGS_DIR,
  MACHINE_IDENTITY_FILE_PATH,
  PID_FILE_PATH,
  STORAGE_DIR,
  TEMP_DIR,
} from './utils/index.js';

function resolveCodePage(value: string | undefined): CodePage {
  if (value === CodePage.Utf8 || value === CodePage.Cp437 || value === CodePage.Wpc1252) {
    return value;
  }
  return CodePage.Cp437;
}

function resolvePaperWidth(value: string | number | undefined): PaperWidthPreset | number {
  if (value === '58mm' || value === '72mm' || value === '80mm') {
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  return '80mm';
}

/** Step 5 — a leftover PID file or crash marker from a previous run means it didn't shut down cleanly. */
function detectPreviousCrash(processInfo: ProcessInfo): { crashed: boolean; details: string | null } {
  if (existsSync(CRASH_MARKER_FILE_PATH)) {
    const details = readFileSync(CRASH_MARKER_FILE_PATH, 'utf-8');
    rmSync(CRASH_MARKER_FILE_PATH, { force: true });
    return { crashed: true, details };
  }
  if (processInfo.readStalePid() !== null) {
    return { crashed: true, details: 'Stale PID file found at startup — previous process did not exit cleanly' };
  }
  return { crashed: false, details: null };
}

async function main(): Promise<void> {
  // ---- Stage: Load Configuration (no logger yet — timed manually, recorded once one exists) ----
  const configLoadStartedAt = process.hrtime.bigint();
  const configService = new ConfigService(CONFIG_FILE_PATH);
  await configService.load();
  const configLoadDurationMs = Math.round(Number(process.hrtime.bigint() - configLoadStartedAt) / 1_000_000);

  // ---- Stage: Initialize Logger ----
  const logger = new LoggerService(LOGS_DIR);
  logger.setLevel(configService.get('loggingLevel'));
  const startupSequence = new StartupSequence(logger);
  startupSequence.recordExternal('Load Configuration', configLoadDurationMs, true);

  const processInfo = new ProcessInfo(PID_FILE_PATH);
  const { crashed: recoveredFromCrash, details: crashDetails } = detectPreviousCrash(processInfo);
  if (recoveredFromCrash) {
    logger.warn('Recovered from an unexpected previous shutdown', { crashDetails });
  }
  processInfo.writePidFile();

  // ---- Stage: Startup Validation (Step 12) — before anything expensive is initialized ----
  const startupValidator = new StartupValidator(logger);
  const environmentReport = await startupSequence.run('Startup Validation', () =>
    startupValidator.validateEnvironment({
      directories: [STORAGE_DIR, LOGS_DIR, TEMP_DIR],
      port: configService.get('port'),
    }),
  );
  if (!environmentReport.ok) {
    logger.error('Startup validation failed, aborting boot', { issues: environmentReport.issues });
    processInfo.removePidFile();
    await logger.flush();
    // Setting exitCode (rather than calling process.exit()) lets the event loop drain naturally —
    // calling process.exit() here races pino's own internal flush-on-exit hook and can throw
    // "sonic boom is not ready yet" if the log destination hasn't finished opening.
    process.exitCode = 1;
    return;
  }

  // ---- Stage: Initialize Database ----
  const databaseService = await startupSequence.run('Initialize Database', () => {
    const service = new DatabaseService(DATABASE_FILE_PATH);
    service.open();
    return service;
  });

  // ---- Stage: Run Migrations ----
  await startupSequence.run('Run Migrations', () => databaseService.migrate());

  const printerRepository = new PrinterRepository(databaseService);
  const printJobRepository = new PrintJobRepository(databaseService);
  const printJobEventRepository = new PrintJobEventRepository(databaseService);
  const applicationRepository = new ApplicationRepository(databaseService);
  const printerProfileRepository = new PrinterProfileRepository(databaseService);
  const printerConfigurationRepository = new PrinterConfigurationRepository(databaseService);
  const printerHealthRepository = new PrinterHealthRepository(databaseService);

  const applicationService = new ApplicationService(applicationRepository);
  const logQueryService = new LogQueryService(logger.logFilePath);

  const events = new PipelineEventEmitter();
  const metricsService = new MetricsService(events);

  const queueService = new QueueService();
  const printerService = new PrinterService(printerRepository);
  const jobService = new JobService(printJobRepository, printerRepository, queueService, events);
  jobService.setMaxQueueSize(configService.get('queueSize'));

  // ---- Stage: Initialize Drivers ----
  const driverRegistry = new DriverRegistry();
  const driverFactory = await startupSequence.run('Initialize Drivers', () => {
    registerBuiltInDrivers(driverRegistry, logger);
    return new DriverFactory(driverRegistry, logger);
  });

  const printerManager = new PrinterManager(printerRepository, driverFactory, logger);

  // ---- Stage: Load Printers ----
  await startupSequence.run('Load Printers', () => printerManager.loadPrinters());
  startupValidator.validatePrinters(printerRepository.findAll(), driverRegistry);

  const rendererRegistry = new RendererRegistry();
  rendererRegistry.register('escpos', (connection = {}) => {
    const paperWidth = resolvePaperWidth(readString(connection, 'paperWidth') ?? readNumber(connection, 'paperWidth'));
    const codePage = resolveCodePage(readString(connection, 'codePage'));
    return new EscPosRenderer({ paperWidth, codePage }, logger);
  });

  const pipelineConfig = resolvePipelineConfig({ retryCount: configService.get('retryCount') });
  const pipelineService = new PrintPipelineService(
    printerRepository,
    printerManager,
    rendererRegistry,
    printJobEventRepository,
    events,
    logger,
    pipelineConfig,
  );

  // ---- Stage: Initialize Queue ----
  const queueWorker = await startupSequence.run('Initialize Queue', () => {
    const worker = new QueueWorker(queueService, printJobRepository, pipelineService, events, metricsService, logger, {
      pollIntervalMs: pipelineConfig.queuePollIntervalMs,
      maxRetries: pipelineConfig.retryCount,
    });
    // Crash recovery (Step 5): reload anything left mid-flight or waiting before this process existed.
    jobService.recoverPendingJobs();
    return worker;
  });

  // ---- Stage: Start Queue Worker ----
  await startupSequence.run('Start Queue Worker', () => queueWorker.start());

  const discoveryService = new DiscoveryService(logger);
  const healthService = new HealthService(
    queueService,
    printJobRepository,
    printerRepository,
    rendererRegistry,
    driverRegistry,
    databaseService,
    configService.get('version'),
  );

  // ---- Printer Discovery & Configuration System ------------------------------------------
  const printerCacheService = new PrinterCacheService();
  const printerEventBus = new PrinterEventBus();

  const printerProfileService = new PrinterProfileService(printerProfileRepository);
  const printerConfigurationService = new PrinterConfigurationService(
    printerRepository,
    printerConfigurationRepository,
    configService,
    printerCacheService,
    printerEventBus,
  );
  const capabilityDetector = new CapabilityDetectorService(printerManager, printerConfigurationService, printerProfileService, printerCacheService);
  const printerValidationService = new PrinterValidationService(driverRegistry, printerRepository, printerProfileService);

  const discoveryManager = new DiscoveryManager(logger, printerRepository, printerCacheService, printerEventBus);
  const discoveryScheduler = new DiscoveryScheduler(discoveryManager, logger, {
    runOnStartup: true,
    intervalMs: configService.get('discoveryIntervalMs'),
  });
  const printerHealthMonitor = new PrinterHealthMonitor(printerRepository, printerManager, printerHealthRepository, printerCacheService, printerEventBus, logger);
  const printerRecoveryManager = new PrinterRecoveryManager(
    printerManager,
    printerRepository,
    printerHealthMonitor,
    discoveryScheduler,
    printerEventBus,
    logger,
  );

  // ---- Stage: Start Discovery Scheduler ----
  await startupSequence.run('Start Discovery Scheduler', () => discoveryScheduler.start());

  // ---- Stage: Start Health Monitor ----
  await startupSequence.run('Start Health Monitor', () => printerHealthMonitor.start());

  const cacheSweepTimer = setInterval(() => printerCacheService.sweep(), 60_000);
  cacheSweepTimer.unref();

  // ---- Cloud connector (optional; unaffected by CLOUD_SERVER_URL being unset) -------------
  const cloudEvents = new CloudEventBus();
  const machineIdentityService = new MachineIdentityService(MACHINE_IDENTITY_FILE_PATH, configService.get('version'));
  const authStore = new AuthStore(CLOUD_CREDENTIALS_FILE_PATH);

  const cloudServerUrl = process.env['CLOUD_SERVER_URL'] ?? '';
  const cloudAllowInsecure = process.env['CLOUD_ALLOW_INSECURE'] === 'true';
  const registrationTransport: RegistrationTransport = cloudServerUrl
    ? new HttpRegistrationTransport(cloudServerUrl)
    : new NullRegistrationTransport();
  const registrationService = new RegistrationService(machineIdentityService, registrationTransport, authStore, cloudEvents, logger);

  const cloudWebSocketUrl = process.env['CLOUD_WEBSOCKET_URL'] ?? 'wss://cloud.invalid';
  const reconnectPolicy = new ReconnectPolicy();
  const webSocketClient = new WebSocketClient(
    { url: cloudWebSocketUrl, allowInsecure: cloudAllowInsecure, getToken: () => authStore.current?.agentToken ?? null },
    reconnectPolicy,
    cloudEvents,
    logger,
  );
  const heartbeatService = new HeartbeatService(
    machineIdentityService,
    queueService,
    printerRepository,
    printerManager,
    webSocketClient,
    configService.get('version'),
    cloudEvents,
    logger,
  );
  const offlineSyncService = new OfflineSyncService(webSocketClient, cloudEvents, logger);

  const cloudConnector = new CloudConnector(
    { serverUrl: cloudServerUrl, allowInsecure: cloudAllowInsecure },
    machineIdentityService,
    registrationService,
    authStore,
    webSocketClient,
    reconnectPolicy,
    heartbeatService,
    offlineSyncService,
    jobService,
    metricsService,
    events,
    cloudEvents,
    logger,
    CLOUD_CONFIG_FILE_PATH,
  );
  await cloudConnector.initialize();
  if (cloudServerUrl && authStore.current) {
    cloudConnector.connect();
  }

  // ---- Service management (this phase) ----------------------------------------------------
  const serviceEventBus = new ServiceEventBus();
  const port = configService.get('port');

  let app: Awaited<ReturnType<typeof buildApp>> | null = null;

  // Tracks what was last actually *applied* to the live workers — not what's currently sitting
  // in ConfigService, since `PUT /config` already mutates that in-memory copy directly before
  // this ever runs (and before the debounced file-watch callback below even fires). Diffing
  // against ConfigService's own current value would compare it to itself and never see a change.
  let lastAppliedConfig: AppConfig = configService.getAll();

  async function reloadConfiguration(): Promise<AppConfig> {
    await configService.load();
    const next = configService.getAll();
    const previous = lastAppliedConfig;

    if (previous.loggingLevel !== next.loggingLevel) {
      logger.setLevel(next.loggingLevel);
    }
    if (previous.retryCount !== next.retryCount) {
      queueWorker.setMaxRetries(next.retryCount);
    }
    if (previous.queueSize !== next.queueSize) {
      jobService.setMaxQueueSize(next.queueSize);
    }
    if (previous.discoveryIntervalMs !== next.discoveryIntervalMs) {
      discoveryScheduler.setIntervalMs(next.discoveryIntervalMs);
    }

    lastAppliedConfig = next;
    logger.info('Configuration reloaded from disk', {
      loggingLevel: next.loggingLevel,
      retryCount: next.retryCount,
      queueSize: next.queueSize,
      discoveryIntervalMs: next.discoveryIntervalMs,
    });
    return next;
  }

  async function performShutdown(signal: string): Promise<number> {
    const sequence = new ShutdownSequence(logger);

    await sequence.run('Stop accepting new jobs', () => jobService.setAcceptingJobs(false));
    await sequence.run('Finish active print', () => queueWorker.drain());
    await sequence.run('Persist queue state', () => {
      logger.info('Queue state at shutdown', { queuedJobs: queueService.size() });
    });
    await sequence.run('Close driver connections', () => printerManager.disconnectAll());
    await sequence.run('Stop schedulers', () => {
      discoveryScheduler.stop();
      printerHealthMonitor.stop();
      clearInterval(cacheSweepTimer);
      cloudConnector.disconnect();
    });
    await sequence.run('Close REST API', async () => {
      if (app) {
        await app.close();
      }
    });
    await sequence.run('Close database', () => databaseService.close());
    await sequence.run('Flush logs', () => logger.flush());

    processInfo.removePidFile();
    const report = sequence.report(signal);
    logger.info('Shutdown sequence finished', { signal, totalDurationMs: report.totalDurationMs });
    return report.stages.every((stage) => stage.success) ? 0 : 1;
  }

  const watchdog = new ProcessWatchdog(logger, serviceEventBus, (kind, error) => {
    const message = error instanceof Error ? error.message : String(error);
    try {
      mkdirSync(STORAGE_DIR, { recursive: true });
      writeFileSync(CRASH_MARKER_FILE_PATH, JSON.stringify({ kind, message, timestamp: new Date().toISOString() }, null, 2));
    } catch {
      // best-effort — proceed to shut down even if the marker itself couldn't be written
    }
    logger.error('Fatal in-process error detected, shutting down for a clean restart', { kind, message });
    const forceExitTimer = setTimeout(() => process.exit(1), pipelineConfig.shutdownTimeoutMs);
    performShutdown(`FATAL:${kind}`)
      .catch(() => 1)
      .finally(() => {
        clearTimeout(forceExitTimer);
        process.exit(1);
      });
  });

  const serviceManager = new ServiceManager(
    logger,
    serviceEventBus,
    processInfo,
    watchdog,
    configService.get('version'),
    { reload: reloadConfiguration, shutdown: async (signal) => void (await performShutdown(signal)) },
    DEFAULT_RECOVERY_POLICIES,
  );
  if (recoveredFromCrash) {
    serviceManager.markRecoveredFromCrash();
  }

  serviceManager.registerWorker({ name: 'queue-worker', start: () => queueWorker.start(), stop: () => queueWorker.drain(), isRunning: () => queueWorker.isRunning });
  serviceManager.registerWorker({
    name: 'discovery-scheduler',
    start: () => discoveryScheduler.start(),
    stop: () => discoveryScheduler.stop(),
    isRunning: () => discoveryScheduler.isRunning,
  });
  serviceManager.registerWorker({
    name: 'health-monitor',
    start: () => printerHealthMonitor.start(),
    stop: () => printerHealthMonitor.stop(),
    isRunning: () => printerHealthMonitor.isRunning,
  });
  serviceManager.registerWorker({
    name: 'rest-api',
    start: () => {
      logger.warn('REST API worker restart requested — full API restart requires a process restart; verifying it is still listening instead');
    },
    stop: () => {
      /* closed as part of the graceful shutdown sequence, not independently */
    },
    isRunning: () => Boolean(app?.server.listening),
  });

  watchdog.start();

  // ---- Stage: Start REST API ----
  app = await startupSequence.run('Start REST API', () =>
    buildApp({
      configService,
      logger,
      logQueryService,
      printerRepository,
      printerService,
      jobService,
      printerManager,
      discoveryService,
      metricsService,
      healthService,
      queueWorker,
      printJobEventRepository,
      applicationService,
      cloudConnector,
      discoveryManager,
      discoveryScheduler,
      printerProfileService,
      printerConfigurationService,
      capabilityDetector,
      printerHealthMonitor,
      printerRecoveryManager,
      printerValidationService,
      serviceManager,
    }),
  );

  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    logger.error('Failed to start Print Agent server', { error });
    // Everything before this point is already running (queue worker, schedulers) — stop them
    // explicitly so no unref-free timer (the queue worker's poll loop) keeps the process alive.
    await queueWorker.drain();
    discoveryScheduler.stop();
    printerHealthMonitor.stop();
    watchdog.stop();
    databaseService.close();
    processInfo.removePidFile();
    await logger.flush();
    process.exitCode = 1;
    return;
  }

  // ---- Stage: Ready ----
  serviceManager.setStartupReport(startupSequence.report());
  serviceManager.markRunning();
  logger.info('Print Agent ready', { port, totalStartupMs: startupSequence.report().totalDurationMs });

  // Config hot-reload (Step 7) — detect external edits to the config file, not just POST /service/reload.
  let reloadDebounceTimer: NodeJS.Timeout | null = null;
  try {
    const { watch } = await import('node:fs');
    watch(CONFIG_FILE_PATH, () => {
      if (reloadDebounceTimer) {
        clearTimeout(reloadDebounceTimer);
      }
      reloadDebounceTimer = setTimeout(() => {
        serviceManager.reload().catch((error: unknown) => logger.error('Automatic config reload failed', { error }));
      }, 300);
      reloadDebounceTimer.unref();
    });
  } catch (error) {
    logger.warn('Could not watch configuration file for changes', { error });
  }

  const signalHandler = new SignalHandler(logger, (signal: ShutdownSignal) => {
    const shutdownTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit', { timeoutMs: pipelineConfig.shutdownTimeoutMs });
      process.exit(1);
    }, pipelineConfig.shutdownTimeoutMs);
    shutdownTimer.unref();

    serviceManager
      .gracefulShutdown(signal)
      .then(() => {
        clearTimeout(shutdownTimer);
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error('Error during graceful shutdown', { error });
        clearTimeout(shutdownTimer);
        process.exit(1);
      });
  });
  signalHandler.register();
}

main().catch((error: unknown) => {
  console.error('Fatal error during startup', error);
  process.exit(1);
});
