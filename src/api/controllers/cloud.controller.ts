import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CloudConnector } from '../../cloud/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapters over CloudConnector — local administration only, never reachable from the internet. */
export class CloudController {
  constructor(private readonly cloudConnector: CloudConnector) {}

  getStatus = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.cloudConnector.getStatus()));
  };

  connect = (_request: FastifyRequest, reply: FastifyReply): void => {
    this.cloudConnector.connect();
    void reply.send(success(this.cloudConnector.getStatus()));
  };

  disconnect = (_request: FastifyRequest, reply: FastifyReply): void => {
    this.cloudConnector.disconnect();
    void reply.send(success(this.cloudConnector.getStatus()));
  };

  register = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.cloudConnector.register();
    void reply.send(success(this.cloudConnector.getStatus()));
  };

  reconnect = (_request: FastifyRequest, reply: FastifyReply): void => {
    this.cloudConnector.reconnect();
    void reply.send(success(this.cloudConnector.getStatus()));
  };

  getDiagnostics = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.cloudConnector.getDiagnostics()));
  };

  getConfig = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.cloudConnector.getConfig()));
  };
}
