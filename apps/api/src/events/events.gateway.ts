import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { BracketData } from '@gsm/bracket-engine';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/brackets',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized (/brackets)');
  }

  handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ??
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      this.logger.warn(`Unauthenticated connection rejected: ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const secret =
        this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret-change-in-prod';
      const payload = this.jwtService.verify(token, { secret });
      (client as any).user = payload;
      this.logger.log(`Client connected: ${client.id} (user ${payload.sub})`);
    } catch {
      this.logger.warn(`Invalid token, connection rejected: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Client subscribes to a specific tournament room */
  @SubscribeMessage('join_tournament')
  handleJoin(@MessageBody() tournamentId: string, @ConnectedSocket() client: Socket) {
    client.join(`tournament:${tournamentId}`);
    this.logger.log(`Client ${client.id} joined room tournament:${tournamentId}`);
    return { event: 'joined', data: { tournamentId } };
  }

  @SubscribeMessage('leave_tournament')
  handleLeave(@MessageBody() tournamentId: string, @ConnectedSocket() client: Socket) {
    client.leave(`tournament:${tournamentId}`);
    return { event: 'left', data: { tournamentId } };
  }

  /**
   * Called by BracketsService after recording a result.
   * Broadcasts updated bracket data to all clients in the tournament room.
   */
  emitBracketUpdate(tournamentId: string, bracketId: string, bracketData: BracketData) {
    this.server.to(`tournament:${tournamentId}`).emit('bracket_updated', {
      bracketId,
      bracketData,
    });
    this.logger.log(`Emitted bracket_updated to room tournament:${tournamentId}`);
  }
}
