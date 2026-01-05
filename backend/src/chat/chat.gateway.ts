import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private typingUsersByRoom: Map<number, Set<string>> = new Map();
  private generalRoomId: number | null = null;

  private async ensureGeneralRoom(): Promise<number> {
    if (this.generalRoomId) return this.generalRoomId;
    let room = await this.prisma.room.findFirst({ where: { name: 'general' } });
    if (!room) {
      console.log('Création de la room general...');
      room = await this.prisma.room.create({
        data: { name: 'general', isPrivate: false, historyEnabled: true },
      });
    }
    this.generalRoomId = room.id;
    return room.id;
  }

  private getToken(client: Socket): string | null {
    const header = client.handshake.headers['authorization'];
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.substring(7);
    const auth = (client.handshake as any).auth;
    if (auth && typeof auth.token === 'string') return auth.token;
    return null;
  }

  async handleConnection(client: Socket) {
    console.log(`Tentative de connexion: ${client.id}`);
    try {
      const token = this.getToken(client);
      if (!token) {
        console.log(`Pas de token pour ${client.id}`);
        return client.disconnect();
      }
      
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET || 'supersecret' });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      
      if (!user) {
        console.log(`Utilisateur introuvable pour le token`);
        return client.disconnect();
      }

      console.log(`Connexion réussie: ${user.username} (${client.id})`);

      (client.data as any).user = { id: user.id, username: user.username, customColor: user.customColor };
      
      const generalRoomId = await this.ensureGeneralRoom();
      const generalRoom = await this.prisma.room.findUnique({ where: { id: generalRoomId } });
      
      if (!generalRoom) {
        console.error(`General room not found: ${generalRoomId}`);
        return client.disconnect();
      }
      
      client.join(`room:${generalRoomId}`);

      client.emit('chat:joined', { 
        roomId: generalRoom.id, 
        name: generalRoom.name,
        isPrivate: generalRoom.isPrivate,
        historyEnabled: generalRoom.historyEnabled
      });

      if (generalRoom && generalRoom.historyEnabled) {
        const messages = await this.prisma.message.findMany({
          where: { roomId: generalRoomId },
          orderBy: { createdAt: 'asc' },
          take: 50,
          include: { 
            sender: true,
            reactions: {
              include: { user: true }
            }
          },
        });

        client.emit('chat:history', messages.map(m => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt,
          sender: { id: m.sender.id, username: m.sender.username, customColor: m.sender.customColor },
          reactions: m.reactions.map(r => ({
            id: r.id,
            emoji: r.emoji,
            user: { id: r.user.id, username: r.user.username }
          }))
        })));
      } else {
         client.emit('chat:history', []);
      }

      client.to(`room:${generalRoomId}`).emit('chat:user-joined', { username: user.username });
    } catch (e) {
      console.error(`Erreur de connexion pour ${client.id}:`, e);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const roomId = this.generalRoomId;
    const user = (client.data as any).user;
    if (roomId && user?.username) {
      console.log(`Déconnexion: ${user.username}`);
      client.to(`room:${roomId}`).emit('chat:user-left', { username: user.username });
      const set = this.typingUsersByRoom.get(roomId);
      if (set) {
        set.delete(user.username);
        this.server.to(`room:${roomId}`).emit('chat:typing', Array.from(set));
      }
    }
  }

  @SubscribeMessage('chat:send')
  async handleSend(client: Socket, payload: { content: string, roomId?: number }) {
    console.log('DEBUG: handleSend called', payload);
    try {
      let roomId = payload.roomId;
      
      if (!roomId) {
         const rooms = Array.from(client.rooms);
         const roomStr = rooms.find(r => r.startsWith('room:'));
         if (roomStr) {
             roomId = parseInt(roomStr.split(':')[1]);
         } else {
             roomId = await this.ensureGeneralRoom();
         }
      }
      
      const user = (client.data as any).user;
      if (!user) {
         console.error('DEBUG: User not found in socket data');
         client.emit('chat:error', 'User not authenticated');
         return;
      }
      
      if (!payload?.content?.trim()) {
         console.error('DEBUG: Content empty');
         return;
      }

      console.log(`DEBUG: Saving message from ${user.username}: ${payload.content} to room ${roomId}`);

      const saved = await this.prisma.message.create({
        data: { content: payload.content.trim(), senderId: user.id, roomId },
        include: { sender: true },
      });
      
      this.server.to(`room:${roomId}`).emit('chat:new-message', {
        id: saved.id,
        content: saved.content,
        createdAt: saved.createdAt,
        sender: { id: saved.sender.id, username: saved.sender.username, customColor: saved.sender.customColor },
        reactions: []
      });
    } catch (e) {
      console.error('DEBUG: Error in handleSend', e);
      client.emit('chat:error', 'Error sending message');
    }
  }

  @SubscribeMessage('chat:react')
  async handleReaction(client: Socket, payload: { messageId: number, emoji: string }) {
    const user = (client.data as any).user;
    if (!user) return;
    
    console.log(`Reaction de ${user.username} sur msg ${payload.messageId}: ${payload.emoji}`);

    try {
      const reaction = await this.prisma.reaction.create({
        data: {
          messageId: payload.messageId,
          userId: user.id,
          emoji: payload.emoji
        },
        include: { user: true }
      });
      
      const message = await this.prisma.message.findUnique({ where: { id: payload.messageId } });
      if (message && message.roomId) {
        this.server.to(`room:${message.roomId}`).emit('chat:reaction-added', {
          messageId: payload.messageId,
          reaction: {
            id: reaction.id,
            emoji: reaction.emoji,
            user: { id: reaction.user.id, username: reaction.user.username }
          }
        });
      }
    } catch (e) {
      console.log('Reaction failed (duplicate?)', e);
    }
  }

  @SubscribeMessage('chat:update-profile')
  async handleUpdateProfile(client: Socket) {
    const oldUser = (client.data as any).user;
    if (!oldUser) return;
    
    try {
      const user = await this.prisma.user.findUnique({ where: { id: oldUser.id } });
      if (user) {
        (client.data as any).user = { id: user.id, username: user.username, customColor: user.customColor };
        console.log(`Updated socket user data for ${user.username}`);
      }
    } catch (e) {
      console.error('Error updating profile on socket', e);
    }
  }

  @SubscribeMessage('chat:join')
  async handleJoinRoom(client: Socket, payload: { roomId: number }) {
    const user = (client.data as any).user;
    if (!user) return;

    console.log(`User ${user.username} joining room ${payload.roomId}`);
    
    const room = await this.prisma.room.findUnique({ 
        where: { id: payload.roomId },
        include: { participants: true }
    });
    
    if (!room) return client.emit('chat:error', 'Room not found');
    
    if (room.isPrivate && !room.participants.some(p => p.id === user.id)) {
        return client.emit('chat:error', 'Access denied');
    }

    client.rooms.forEach(r => {
        if (r.startsWith('room:')) client.leave(r);
    });

    client.join(`room:${room.id}`);
    
    if (room.historyEnabled) {
         const messages = await this.prisma.message.findMany({
            where: { roomId: room.id },
            orderBy: { createdAt: 'asc' },
            take: 50,
            include: { 
              sender: true,
              reactions: { include: { user: true } }
            },
          });
          
          client.emit('chat:history', messages.map(m => ({
            id: m.id,
            content: m.content,
            createdAt: m.createdAt,
            sender: { id: m.sender.id, username: m.sender.username, customColor: m.sender.customColor },
            reactions: m.reactions.map(r => ({
              id: r.id,
              emoji: r.emoji,
              user: { id: r.user.id, username: r.user.username }
            }))
          })));
    } else {
        client.emit('chat:history', []);
    }
    
    client.emit('chat:joined', { 
        roomId: room.id, 
        name: room.name,
        isPrivate: room.isPrivate,
        historyEnabled: room.historyEnabled
    });
  }

  @SubscribeMessage('chat:typing')
  async handleTyping(client: Socket) {
    const roomId = await this.ensureGeneralRoom();
    const user = (client.data as any).user;
    if (!user) return;
    let set = this.typingUsersByRoom.get(roomId);
    if (!set) {
      set = new Set<string>();
      this.typingUsersByRoom.set(roomId, set);
    }
    set.add(user.username);
    this.server.to(`room:${roomId}`).emit('chat:typing', Array.from(set));
  }

  @SubscribeMessage('chat:typing-stop')
  async handleTypingStop(client: Socket) {
    const roomId = await this.ensureGeneralRoom();
    const user = (client.data as any).user;
    if (!user) return;
    const set = this.typingUsersByRoom.get(roomId);
    if (set) {
      set.delete(user.username);
      this.server.to(`room:${roomId}`).emit('chat:typing', Array.from(set));
    }
  }
}
