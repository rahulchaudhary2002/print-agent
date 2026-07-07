import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CapabilityDetectorService, PrinterConfigurationService, PrinterProfileService } from '../../printer/index.js';
import type { PrinterIdParams } from '../schemas/index.js';
import type {
  AssignPrinterProfileBody,
  CreatePrinterProfileBody,
  PrinterProfileIdParams,
  UpdatePrinterProfileBody,
} from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapter over PrinterProfileService (Step 8/15) plus the printer→profile assignment endpoint. */
export class PrinterProfileController {
  constructor(
    private readonly profileService: PrinterProfileService,
    private readonly configurationService: PrinterConfigurationService,
    private readonly capabilityDetector: CapabilityDetectorService,
  ) {}

  list = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.profileService.list()));
  };

  getById = (request: FastifyRequest<{ Params: PrinterProfileIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.profileService.getById(request.params.id)));
  };

  create = (request: FastifyRequest<{ Body: CreatePrinterProfileBody }>, reply: FastifyReply): void => {
    void reply.status(201).send(success(this.profileService.create(request.body), 'Printer profile created'));
  };

  update = (
    request: FastifyRequest<{ Params: PrinterProfileIdParams; Body: UpdatePrinterProfileBody }>,
    reply: FastifyReply,
  ): void => {
    void reply.send(success(this.profileService.update(request.params.id, request.body), 'Printer profile updated'));
  };

  delete = (request: FastifyRequest<{ Params: PrinterProfileIdParams }>, reply: FastifyReply): void => {
    this.profileService.delete(request.params.id);
    void reply.status(204).send();
  };

  /** POST /printers/:id/profile — links a profile to a printer and invalidates its cached capability snapshot. */
  assignToPrinter = (
    request: FastifyRequest<{ Params: PrinterIdParams; Body: AssignPrinterProfileBody }>,
    reply: FastifyReply,
  ): void => {
    this.profileService.getById(request.body.profileId); // 404s if the profile doesn't exist
    const configuration = this.configurationService.update(request.params.id, { profileId: request.body.profileId });
    this.capabilityDetector.invalidate(request.params.id);
    void reply.send(success(configuration, 'Profile assigned to printer'));
  };
}
