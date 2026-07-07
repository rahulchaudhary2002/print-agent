import type { FastifyInstance } from 'fastify';
import type { PrinterHealthController } from '../controllers/index.js';
import { printerIdParamsSchema, validateParams } from '../schemas/index.js';

export function registerPrinterHealthRoutes(app: FastifyInstance, controller: PrinterHealthController): void {
  app.get('/printers/health', { schema: { tags: ['Printer Health'], summary: 'Health snapshot for every registered printer' } }, controller.getAll);
  app.get(
    '/printers/:id/health',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Printer Health'], summary: 'Health snapshot for one printer' } },
    controller.getById,
  );
}
