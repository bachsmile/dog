import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatGateway } from '../chat/chat.gateway';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LawChatRoom } from './entities/law-chat-room.entity';
import { IsNull } from 'typeorm';

interface RequestLawyerPayload {
  category: string;
  preferredLawyerId?: string;
  customerInfo?: {
    name: string;
    avatar: string;
  };
}

interface LawyerJoinPayload {
  roomId: string;
  lawyerId: string; // Add permanent ID
  lawyerInfo: {
    name: string;
    avatar: string;
  };
}

interface SendMessagePayload {
  roomId: string;
  message: string;
  senderInfo: {
    role: string;
    name: string;
  };
}

interface CloseRoomPayload {
  roomId: string;
}

@WebSocketGateway({
  namespace: 'law',
  cors: {
    origin: '*',
  },
})
export class LawChatGateway extends ChatGateway {
  @WebSocketServer()
  declare server: Server;

  private lawLogger: Logger = new Logger('LawChatGateway');

  constructor(
    @InjectRepository(LawChatRoom)
    private roomRepository: Repository<LawChatRoom>,
  ) {
    super();
  }

  @SubscribeMessage('request_lawyer')
  async handleRequestLawyer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RequestLawyerPayload,
  ) {
    this.lawLogger.log('--------------------------------------------------');
    this.lawLogger.log(`📩 RECEIVED request_lawyer from Client: ${client.id}`);
    this.lawLogger.log(`📦 Payload: ${JSON.stringify(payload)}`);

    const randomKey = Math.random().toString(36).substring(2, 10).toUpperCase();
    const roomId = `law_room_${randomKey}_${Date.now()}`;

    try {
      await client.join(roomId);
      this.lawLogger.log(`✅ Client joined room: ${roomId}`);

      // Save to database
      const room = this.roomRepository.create({
        roomId,
        customerId: client.id,
        customerInfo: payload.customerInfo,
        status: 'waiting',
        lawyerId: payload.preferredLawyerId,
      });
      const savedRoom = await this.roomRepository.save(room);
      this.lawLogger.log(`💾 Room persisted to DB: ${savedRoom.id}`);

      this.lawLogger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.lawLogger.log(`🚀 NEW ROOM READY: [${roomId}]`);
      this.lawLogger.log(
        `👤 Customer: ${payload.customerInfo?.name || client.id}`,
      );
      this.lawLogger.log(
        `⚖️ Preferred Lawyer: ${payload.preferredLawyerId || 'None'}`,
      );
      this.lawLogger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const data = {
        roomId,
        customerId: client.id,
        customerInfo: payload.customerInfo,
        category: payload.category,
        preferredLawyerId: payload.preferredLawyerId,
      };

      // Broadcast to all (especially for lawyer dashboards)
      this.server.emit('lawyer_needed', data);
      this.lawLogger.log(`📢 Broadcasted 'lawyer_needed' to all clients`);

      return { status: 'success', data: { roomId } };
    } catch (error: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.lawLogger.error(`❌ ERROR creating room: ${error.message}`);
      return { event: 'error', message: 'Could not create room' };
    }
  }

  @SubscribeMessage('lawyer_join')
  async handleLawyerJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LawyerJoinPayload,
  ) {
    const room = await this.roomRepository.findOne({
      where: { roomId: payload.roomId },
    });

    // Security check: If room is already assigned to a specific lawyer, only that lawyer can join
    if (room && room.lawyerId && room.lawyerId !== payload.lawyerId) {
      this.lawLogger.warn(
        `🚨 Unauthorized join attempt: Lawyer ${payload.lawyerId} tried to join room ${payload.roomId} assigned to ${room.lawyerId}`,
      );
      return {
        event: 'error',
        message: 'Phòng chat này đã được chỉ định cho luật sư khác.',
      };
    }

    await client.join(payload.roomId);

    // Update room status in database
    await this.roomRepository.update(
      { roomId: payload.roomId },
      { status: 'active', lawyerId: payload.lawyerId },
    );

    this.lawLogger.log(
      `⚖️ Lawyer ${payload.lawyerId} (Socket: ${client.id}) joined room ${payload.roomId}`,
    );

    const data = {
      lawyerId: payload.lawyerId,
      socketId: client.id,
      lawyerInfo: payload.lawyerInfo,
    };

    this.server.to(payload.roomId).emit('lawyer_joined', data);
  }

  @SubscribeMessage('close_room')
  async handleCloseRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CloseRoomPayload,
  ) {
    const { roomId } = payload;
    this.lawLogger.log(`🔒 Closing and deleting room: ${roomId}`);

    try {
      // 1. Notify participants
      this.server.to(roomId).emit('room_closed', { roomId });

      // 2. Delete from database
      await this.roomRepository.delete({ roomId });

      this.lawLogger.log(`✅ Room ${roomId} deleted successfully.`);
      return { status: 'success' };
    } catch (e: unknown) {
      const error = e as Error;
      this.lawLogger.error(`❌ Error closing room ${roomId}: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('send_message')
  override handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const { roomId, message, senderInfo } = payload;
    this.lawLogger.log(`Message in ${roomId} from ${client.id}: ${message}`);

    const data = {
      roomId,
      senderId: client.id,
      message,
      senderInfo,
      time: new Date().toISOString(),
    };

    this.server.to(roomId).emit('new_message', data);
  }

  @SubscribeMessage('get_active_rooms')
  async handleGetActiveRooms(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { lawyerId?: string },
  ) {
    // Return rooms that are:
    // 1. Waiting and NO preferred lawyer (public for everyone)
    // 2. Waiting and assigned specifically to THIS lawyer (preferredLawyerId matches)
    // 3. Active and assigned to THIS lawyer
    const lawyerIdStr = payload.lawyerId ? String(payload.lawyerId) : null;

    const rooms = await this.roomRepository.find({
      where: [
        { status: 'waiting', lawyerId: IsNull() },
        ...(lawyerIdStr
          ? [
              { status: 'waiting', lawyerId: lawyerIdStr },
              { status: 'active', lawyerId: lawyerIdStr },
            ]
          : []),
      ],
      order: { createdAt: 'DESC' },
    });

    this.lawLogger.log(
      `🔍 Returning ${rooms.length} active/waiting rooms for lawyer: ${payload.lawyerId || 'Unknown'}`,
    );
    client.emit('active_rooms_list', rooms);
  }

  override handleDisconnect(client: Socket) {
    super.handleDisconnect(client);
    this.lawLogger.log(
      `Cleaning up law chat artifacts for client ${client.id}`,
    );
  }
}
