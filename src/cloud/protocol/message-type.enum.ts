/** Every message exchanged over the cloud WebSocket carries one of these as its envelope `type`. */
export enum MessageType {
  // Agent -> Server (connection lifecycle)
  Register = 'REGISTER',
  Auth = 'AUTH',
  Heartbeat = 'HEARTBEAT',
  Version = 'VERSION',
  Ping = 'PING',
  Pong = 'PONG',
  Ack = 'ACK',
  Error = 'ERROR',

  // Server -> Agent (commands)
  PrintJob = 'PRINT_JOB',
  JobCancel = 'JOB_CANCEL',
  JobRetry = 'JOB_RETRY',
  ConfigUpdate = 'CONFIG_UPDATE',

  // Agent -> Server (outgoing job lifecycle events — Step 10)
  JobAccepted = 'JOB_ACCEPTED',
  JobStarted = 'JOB_STARTED',
  RenderingStarted = 'RENDERING_STARTED',
  PrintingStarted = 'PRINTING_STARTED',
  JobCompleted = 'JOB_COMPLETED',
  JobFailed = 'JOB_FAILED',
  JobCancelled = 'JOB_CANCELLED',
  Warning = 'WARNING',
  Metrics = 'METRICS',
}
