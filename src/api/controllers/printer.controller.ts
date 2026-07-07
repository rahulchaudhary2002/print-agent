import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrinterManager, PrinterService } from '../../printer/index.js';
import type { CreatePrinterBody, PrinterIdParams, UpdatePrinterBody } from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapters over PrinterService/PrinterManager — no business logic lives here. */
export class PrinterController {
  constructor(
    private readonly printerService: PrinterService,
    private readonly printerManager: PrinterManager,
  ) {}

  list = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.printerService.list()));
  };

  getById = (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.printerService.getById(request.params.id)));
  };

  create = (request: FastifyRequest<{ Body: CreatePrinterBody }>, reply: FastifyReply): void => {
    void reply.status(201).send(success(this.printerService.create(request.body), 'Printer created'));
  };

  update = (
    request: FastifyRequest<{ Params: PrinterIdParams; Body: UpdatePrinterBody }>,
    reply: FastifyReply,
  ): void => {
    void reply.send(success(this.printerService.update(request.params.id, request.body), 'Printer updated'));
  };

  delete = (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): void => {
    this.printerService.delete(request.params.id);
    void reply.status(204).send();
  };

  setDefault = (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.printerService.setDefault(request.params.id), 'Default printer updated'));
  };

  enable = (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.printerService.enable(request.params.id), 'Printer enabled'));
  };

  disable = (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.printerService.disable(request.params.id), 'Printer disabled'));
  };

  getStatus = async (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): Promise<void> => {
    const diagnostics = await this.printerManager.getDiagnostics(request.params.id);
    void reply.send(success(diagnostics));
  };

  testPrint = async (request: FastifyRequest<{ Params: PrinterIdParams }>, reply: FastifyReply): Promise<void> => {
    const result = await this.printerManager.testPrint(request.params.id);
    void reply.send(success(result));
  };
}
