import { session, type Session } from 'electron';

export const partitionForServer = (serverId: string): string => `persist:server-${serverId}`;

export const sessionForServer = (serverId: string): Session =>
  session.fromPartition(partitionForServer(serverId));
