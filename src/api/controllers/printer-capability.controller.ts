import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrinterRepository } from '../../database/repositories/index.js';
import type { CapabilityDetectorService } from '../../printer/index.js';
import type { PrinterIdParams } from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapter over CapabilityDetectorService (Step 9/15). */
export class PrinterCapabilityController {
  constructor(
    private readonly printerRepository: PrinterRepository,
    private readonly capabilityDetector: CapabilityDetectorService,
  ) {}

  getAll = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const printers = this.printerRepository.findAll();
    const snapshots = await Promise.all(printers.map((printer) => this.capabilityDetector.detect(printer.id)));
    void reply.send(success(snapshots));
  };

  getById = async (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): Promise<void> => {
    const snapshot = await this.capabilityDetector.detect(request.params.id);
    void reply.send(success(snapshot));
  };
}
