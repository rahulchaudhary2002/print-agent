import type { FastifyInstance } from 'fastify';
import type { PrinterController } from '../controllers/index.js';
import {
  createPrinterSchema,
  printerIdParamsSchema,
  toOpenApiSchema,
  updatePrinterSchema,
  validateBody,
  validateParams,
} from '../schemas/index.js';

export function registerPrinterRoutes(app: FastifyInstance, controller: PrinterController): void {
  app.get('/printers', { schema: { tags: ['Printers'], summary: 'List all printers' } }, controller.list);
  app.get(
    '/printers/:id',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Printers'], summary: 'Get a printer by id' } },
    controller.getById,
  );
  app.post(
    '/printers',
    {
      preHandler: validateBody(createPrinterSchema),
      schema: { tags: ['Printers'], summary: 'Register a new printer', body: toOpenApiSchema(createPrinterSchema) },
    },
    controller.create,
  );
  app.put(
    '/printers/:id',
    {
      preHandler: [validateParams(printerIdParamsSchema), validateBody(updatePrinterSchema)],
      schema: { tags: ['Printers'], summary: 'Update a printer', body: toOpenApiSchema(updatePrinterSchema) },
    },
    controller.update,
  );
  app.delete(
    '/printers/:id',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Printers'], summary: 'Delete a printer' } },
    controller.delete,
  );
  app.put(
    '/printers/:id/default',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Printers'], summary: 'Set as the default printer' } },
    controller.setDefault,
  );
  app.put(
    '/printers/:id/enable',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Printers'], summary: 'Enable a printer' } },
    controller.enable,
  );
  app.put(
    '/printers/:id/disable',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Printers'], summary: 'Disable a printer (blocks new print jobs)' } },
    controller.disable,
  );
  app.get(
    '/printers/:id/status',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Printers'], summary: 'Live printer diagnostics' } },
    controller.getStatus,
  );
  app.post(
    '/printers/:id/test',
    { preHandler: validateParams(printerIdParamsSchema), schema: { tags: ['Printers'], summary: 'Print a test page' } },
    controller.testPrint,
  );
}
