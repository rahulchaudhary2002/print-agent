import type { FastifyInstance } from 'fastify';
import type {
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
} from '../controllers/index.js';
import { registerApplicationRoutes } from './application.routes.js';
import { registerCloudRoutes } from './cloud.routes.js';
import { registerConfigRoutes } from './config.routes.js';
import { registerDiscoveryRoutes } from './discovery.routes.js';
import { registerDiscoveryManagerRoutes } from './discovery-manager.routes.js';
import { registerHealthRoutes } from './health.routes.js';
import { registerJobRoutes } from './job.routes.js';
import { registerLogRoutes } from './log.routes.js';
import { registerMetricsRoutes } from './metrics.routes.js';
import { registerPrinterRoutes } from './printer.routes.js';
import { registerPrinterCapabilityRoutes } from './printer-capability.routes.js';
import { registerPrinterHealthRoutes } from './printer-health.routes.js';
import { registerPrinterProfileRoutes } from './printer-profile.routes.js';
import { registerPrinterRecoveryRoutes } from './printer-recovery.routes.js';
import { registerPrinterValidationRoutes } from './printer-validation.routes.js';
import { registerQueueRoutes } from './queue.routes.js';
import { registerServiceRoutes } from './service.routes.js';

export interface RouteControllers {
  healthController: HealthController;
  metricsController: MetricsController;
  queueController: QueueController;
  printerController: PrinterController;
  jobController: JobController;
  configController: ConfigController;
  logController: LogController;
  applicationController: ApplicationController;
  discoveryController: DiscoveryController;
  cloudController: CloudController;
  discoveryManagerController: DiscoveryManagerController;
  printerProfileController: PrinterProfileController;
  printerCapabilityController: PrinterCapabilityController;
  printerHealthController: PrinterHealthController;
  printerRecoveryController: PrinterRecoveryController;
  printerValidationController: PrinterValidationController;
  serviceController: ServiceController;
}

/** Aggregates all route registration in one place, keeping app.ts free of routing detail. */
export function registerRoutes(app: FastifyInstance, controllers: RouteControllers): void {
  registerHealthRoutes(app, controllers.healthController);
  registerMetricsRoutes(app, controllers.metricsController);
  registerQueueRoutes(app, controllers.queueController);
  registerPrinterRoutes(app, controllers.printerController);
  registerJobRoutes(app, controllers.jobController);
  registerConfigRoutes(app, controllers.configController);
  registerLogRoutes(app, controllers.logController);
  registerApplicationRoutes(app, controllers.applicationController);
  registerDiscoveryRoutes(app, controllers.discoveryController);
  registerCloudRoutes(app, controllers.cloudController);
  registerDiscoveryManagerRoutes(app, controllers.discoveryManagerController);
  registerPrinterProfileRoutes(app, controllers.printerProfileController);
  registerPrinterCapabilityRoutes(app, controllers.printerCapabilityController);
  registerPrinterHealthRoutes(app, controllers.printerHealthController);
  registerPrinterRecoveryRoutes(app, controllers.printerRecoveryController);
  registerPrinterValidationRoutes(app, controllers.printerValidationController);
  registerServiceRoutes(app, controllers.serviceController);
}

export * from './application.routes.js';
export * from './cloud.routes.js';
export * from './config.routes.js';
export * from './discovery.routes.js';
export * from './discovery-manager.routes.js';
export * from './health.routes.js';
export * from './job.routes.js';
export * from './log.routes.js';
export * from './metrics.routes.js';
export * from './printer.routes.js';
export * from './printer-capability.routes.js';
export * from './printer-health.routes.js';
export * from './printer-profile.routes.js';
export * from './printer-recovery.routes.js';
export * from './printer-validation.routes.js';
export * from './queue.routes.js';
export * from './service.routes.js';
