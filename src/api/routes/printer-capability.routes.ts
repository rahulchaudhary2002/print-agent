import type { FastifyInstance } from 'fastify';
import type { PrinterCapabilityController } from '../controllers/index.js';
import { printerIdParamsSchema, validateParams } from '../schemas/index.js';

export function registerPrinterCapabilityRoutes(app: FastifyInstance, controller: PrinterCapabilityController): void {
  app.get('/printers/capabilities', { schema: { tags: ['Capabilities'], summary: 'Capability snapshot for every registered printer' } }, controller.getAll);
  app.get(
    '/printers/:id/capabilities',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Capabilities'], summary: 'Capability snapshot for one printer' } },
    controller.getById,
  );
}
