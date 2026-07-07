import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ServiceManager } from '../../service/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapter over ServiceManager (Step 15) — service lifecycle, not print job management. */
export class ServiceController {
  constructor(private readonly serviceManager: ServiceManager) {}

  getStatus = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.serviceManager.getStatus()));
  };

  restart = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const workers = await this.serviceManager.restart();
    void reply.send(success(workers, 'Service workers restarted'));
  };

  reload = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const config = await this.serviceManager.reload();
    void reply.send(success(config, 'Configuration reloaded'));
  };

  getWorkers = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.serviceManager.getWorkers()));
  };

  getStartup = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.serviceManager.getStartupReport()));
  };

  getUptime = (_request: FastifyRequest, reply: FastifyReply): void => {
    const status = this.serviceManager.getStatus();
    void reply.send(success({ appUptimeSeconds: status.appUptimeSeconds, serviceUptimeSeconds: status.serviceUptimeSeconds }));
  };
}
