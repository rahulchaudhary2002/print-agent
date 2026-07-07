import type { FastifyInstance } from 'fastify';
import type { PrinterProfileController } from '../controllers/index.js';
import {
  assignPrinterProfileSchema,
  createPrinterProfileSchema,
  printerIdParamsSchema,
  printerProfileIdParamsSchema,
  updatePrinterProfileSchema,
  validateBody,
  validateParams,
} from '../schemas/index.js';

export function registerPrinterProfileRoutes(app: FastifyInstance, controller: PrinterProfileController): void {
  app.get('/printers/profiles', { schema: { tags: ['Profiles'], summary: 'List built-in and custom printer profiles' } }, controller.list);
  app.get(
    '/printers/profiles/:id',
    { preHandler: validateParams(printerProfileIdParamsSchema), schema: { tags: ['Profiles'], summary: 'Get a printer profile by id' } },
    controller.getById,
  );
  app.post(
    '/printers/profiles',
    { preHandler: validateBody(createPrinterProfileSchema), schema: { tags: ['Profiles'], summary: 'Create a custom printer profile' } },
    controller.create,
  );
  app.put(
    '/printers/profiles/:id',
    {
      preHandler: [validateParams(printerProfileIdParamsSchema), validateBody(updatePrinterProfileSchema)],
      schema: { tags: ['Profiles'], summary: 'Update a custom printer profile' },
    },
    controller.update,
  );
  app.delete(
    '/printers/profiles/:id',
    { preHandler: validateParams(printerProfileIdParamsSchema), schema: { tags: ['Profiles'], summary: 'Delete a custom printer profile' } },
    controller.delete,
  );
  app.post(
    '/printers/:id/profile',
    {
      preHandler: [validateParams(printerIdParamsSchema), validateBody(assignPrinterProfileSchema)],
      schema: { tags: ['Profiles'], summary: 'Assign a profile to a printer' },
    },
    controller.assignToPrinter,
  );
}
