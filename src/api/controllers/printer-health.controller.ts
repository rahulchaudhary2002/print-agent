import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrinterHealthMonitor } from '../../printer/index.js';
import type { PrinterIdParams } from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapter over PrinterHealthMonitor (Step 11/15). */
export class PrinterHealthController {
  constructor(private readonly healthMonitor: PrinterHealthMonitor) {}

  getAll = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.healthMonitor.getAllSnapshots()));
  };

  getById = (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.healthMonitor.getSnapshot(request.params.id)));
  };
}
