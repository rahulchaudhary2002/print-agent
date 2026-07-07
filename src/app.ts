import type { IncomingMessage, ServerResponse } from 'node:http';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyBaseLogger, type RawServerDefault } from 'fastify';
import type { ApplicationService } from './applications/index.js';
import {
  ApplicationController,
  CloudController,
  ConfigController,
  DiscoveryController,
  DiscoveryManagerController,
  HealthController,
  JobController,
  LogController,
  MetricsController,
  PrinterCapabilityController,
  PrinterController,
  PrinterHealthController,
  PrinterProfileController,
  PrinterRecoveryController,
  PrinterValidationController,
  QueueController,
  ServiceController,
} from './api/controllers/index.js';
import { createNotFoundHandler, createErrorHandler } from './api/errors/index.js';
import { createApiKeyAuthHook, createLocalOnlyHook, registerRequestLogging } from './api/middleware/index.js';
import { registerRoutes } from './api/routes/index.js';
import type { CloudConnector } from './cloud/index.js';
import type { ConfigService } from './config/index.js';
import type { PrinterRepository, PrintJobEventRepository } from './database/repositories/index.js';
import type { HealthService, MetricsService } from './pipeline/index.js';
import type {
  CapabilityDetectorService,
  DiscoveryManager,
  DiscoveryScheduler,
  DiscoveryService,
  PrinterConfigurationService,
  PrinterHealthMonitor,
  PrinterManager,
  PrinterProfileService,
  PrinterRecoveryManager,
  PrinterService,
  PrinterValidationService,
} from './printer/index.js';
import type { JobService, QueueWorker } from './queue/index.js';
import type { ServiceManager } from './service/index.js';
import type { LoggerService, LogQueryService } from './services/index.js';

export interface AppDependencies {
  configService: ConfigService;
  logger: LoggerService;
  logQueryService: LogQueryService;
  printerRepository: PrinterRepository;
  printerService: PrinterService;
  jobService: JobService;
  printerManager: PrinterManager;
  discoveryService: DiscoveryService;
  metricsService: MetricsService;
  healthService: HealthService;
  queueWorker: QueueWorker;
  printJobEventRepository: PrintJobEventRepository;
  applicationService: ApplicationService;
  cloudConnector: CloudConnector;
  discoveryManager: DiscoveryManager;
  discoveryScheduler: DiscoveryScheduler;
  printerProfileService: PrinterProfileService;
  printerConfigurationService: PrinterConfigurationService;
  capabilityDetector: CapabilityDetectorService;
  printerHealthMonitor: PrinterHealthMonitor;
  printerRecoveryManager: PrinterRecoveryManager;
  printerValidationService: PrinterValidationService;
  serviceManager: ServiceManager;
}

const API_PREFIX = '/api/v1';

/** Builds and wires a Fastify instance: plugins, security hooks, error handling, and routes. Does not start listening. */
export async function buildApp(deps: AppDependencies) {
  const app = Fastify<RawServerDefault, IncomingMessage, ServerResponse, FastifyBaseLogger>({
    loggerInstance: deps.logger.raw,
  });

  // Route-level `schema` blocks below exist purely to feed Swagger — actual request validation
  // happens through the Zod preHandlers (Step 10), so Fastify's own AJV validator is disabled.
  app.setValidatorCompiler(() => () => true);

  await app.register(cors, {
    origin: deps.configService.get('corsOrigins'),
  });

  await app.register(rateLimit, {
    max: deps.configService.get('rateLimitMax'),
    timeWindow: deps.configService.get('rateLimitWindowMs'),
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Print Agent — Local Management API',
        description:
          'Local-only HTTP API for managing printers, print jobs, configuration, logs, and the print queue on this machine. Not reachable over the internet by default.',
        version: deps.configService.get('version'),
      },
      servers: [{ url: `http://127.0.0.1:${deps.configService.get('port')}${API_PREFIX}` }],
      tags: [
        { name: 'Health' },
        { name: 'Metrics' },
        { name: 'Queue' },
        { name: 'Printers' },
        { name: 'Jobs' },
        { name: 'Config' },
        { name: 'Logs' },
        { name: 'Applications' },
        { name: 'Cloud' },
        { name: 'Discovery' },
        { name: 'Profiles' },
        { name: 'Capabilities' },
        { name: 'Printer Health' },
        { name: 'Recovery' },
        { name: 'Validation' },
        { name: 'Service' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.setErrorHandler(createErrorHandler(deps.logger));
  app.setNotFoundHandler(createNotFoundHandler(deps.logger));

  registerRequestLogging(app, deps.logger);
  app.addHook('onRequest', createLocalOnlyHook(deps.configService));
  app.addHook('onRequest', createApiKeyAuthHook(deps.configService, deps.applicationService));

  const healthController = new HealthController(deps.configService, deps.healthService);
  const metricsController = new MetricsController(deps.metricsService);
  const queueController = new QueueController(deps.jobService, deps.healthService, deps.queueWorker);
  const printerController = new PrinterController(deps.printerService, deps.printerManager);
  const jobController = new JobController(deps.jobService, deps.printJobEventRepository);
  const configController = new ConfigController(deps.configService);
  const logController = new LogController(deps.logQueryService);
  const applicationController = new ApplicationController(deps.applicationService);
  const discoveryController = new DiscoveryController(deps.discoveryService);
  const cloudController = new CloudController(deps.cloudConnector);
  const discoveryManagerController = new DiscoveryManagerController(deps.discoveryManager, deps.discoveryScheduler);
  const printerProfileController = new PrinterProfileController(
    deps.printerProfileService,
    deps.printerConfigurationService,
    deps.capabilityDetector,
  );
  const printerCapabilityController = new PrinterCapabilityController(deps.printerRepository, deps.capabilityDetector);
  const printerHealthController = new PrinterHealthController(deps.printerHealthMonitor);
  const printerRecoveryController = new PrinterRecoveryController(deps.printerRecoveryManager);
  const printerValidationController = new PrinterValidationController(deps.printerValidationService, deps.printerRepository);
  const serviceController = new ServiceController(deps.serviceManager);

  await app.register(
    async (versioned) => {
      registerRoutes(versioned, {
        healthController,
        metricsController,
        queueController,
        printerController,
        jobController,
        configController,
        logController,
        applicationController,
        discoveryController,
        cloudController,
        discoveryManagerController,
        printerProfileController,
        printerCapabilityController,
        printerHealthController,
        printerRecoveryController,
        printerValidationController,
        serviceController,
      });
    },
    { prefix: API_PREFIX },
  );

  return app;
}
