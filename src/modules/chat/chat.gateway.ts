import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('ChatGateway');

  // Map to track users and their rooms
  private roomParticipants = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Cleanup room info if necessary
    this.roomParticipants.forEach((participants, roomId) => {
      if (participants.has(client.id)) {
        participants.delete(client.id);
        if (participants.size === 0) {
          this.logger.log(`Room ${roomId} is empty and will be cleared.`);
          this.roomParticipants.delete(roomId);
        }
      }
    });
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    await client.join(roomId);

    if (!this.roomParticipants.has(roomId)) {
      this.roomParticipants.set(roomId, new Set());
    }
    this.roomParticipants.get(roomId)?.add(client.id);

    this.logger.log(`Client ${client.id} joined room ${roomId}`);
    return { event: 'joined_room', data: roomId };
  }

  @SubscribeMessage('send_message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    const { roomId, message, senderInfo } = payload;
    this.server.to(roomId).emit('new_message', {
      senderId: client.id,
      message,
      senderInfo,
      time: new Date().toISOString(),
    });
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    await client.leave(roomId);
    if (this.roomParticipants.has(roomId)) {
      this.roomParticipants.get(roomId)?.delete(client.id);
    }
    this.logger.log(`Client ${client.id} left room ${roomId}`);
  }
}
