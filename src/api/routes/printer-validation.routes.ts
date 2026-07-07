import type { FastifyInstance } from 'fastify';
import type { PrinterValidationController } from '../controllers/index.js';
import { printerIdParamsSchema, validateBody, validatePrinterBodySchema, validateParams } from '../schemas/index.js';

export function registerPrinterValidationRoutes(app: FastifyInstance, controller: PrinterValidationController): void {
  app.post(
    '/printers/:id/validate',
    {
      preHandler: [validateParams(printerIdParamsSchema), validateBody(validatePrinterBodySchema)],
      schema: { tags: ['Validation'], summary: 'Validate a printer\'s current or proposed configuration' },
    },
    controller.validate,
  );
}
