import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrinterRepository } from '../../database/repositories/index.js';
import type { PrinterValidationService } from '../../printer/index.js';
import { AppError } from '../../utils/index.js';
import type { PrinterIdParams, ValidatePrinterBody } from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapter over PrinterValidationService (Step 14/15) — validates a printer's current or proposed configuration. */
export class PrinterValidationController {
  constructor(
    private readonly validationService: PrinterValidationService,
    private readonly printerRepository: PrinterRepository,
  ) {}

  validate = (request: FastifyRequest<{ Params: PrinterIdParams; Body: ValidatePrinterBody }>, reply: FastifyReply): void => {
    const printer = this.printerRepository.findById(request.params.id);
    if (!printer) {
      throw new AppError(`Printer ${request.params.id} not found`, 404);
    }
    const body = request.body ?? {};
    const result = this.validationService.validate({
      id: printer.id,
      driver: body.driver ?? printer.driver,
      connection: body.connection ?? printer.connection,
      paperWidth: body.paperWidth,
      profileId: body.profileId,
    });
    void reply.send(success(result, result.valid ? 'Configuration is valid' : 'Configuration is invalid'));
  };
}
