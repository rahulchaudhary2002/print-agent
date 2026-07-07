import type { FastifyInstance } from 'fastify';
import type { PrinterRecoveryController } from '../controllers/index.js';
import { printerIdParamsSchema, validateParams } from '../schemas/index.js';

export function registerPrinterRecoveryRoutes(app: FastifyInstance, controller: PrinterRecoveryController): void {
  app.post(
    '/printers/:id/recover',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Recovery'], summary: 'Attempt to recover an offline/errored printer' } },
    controller.recover,
  );
}
