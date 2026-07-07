import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrinterRecoveryManager } from '../../printer/index.js';
import type { PrinterIdParams } from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapter over PrinterRecoveryManager (Step 12/15). */
export class PrinterRecoveryController {
  constructor(private readonly recoveryManager: PrinterRecoveryManager) {}

  recover = async (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): Promise<void> => {
    const result = await this.recoveryManager.recover(request.params.id);
    void reply.send(success(result, result.message));
  };
}
