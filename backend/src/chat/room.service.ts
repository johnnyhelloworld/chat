import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './room.dto';

@Injectable()
export class RoomService {
  constructor(private prisma: PrismaService) {}

  async createRoom(userId: number, dto: CreateRoomDto) {
    const participants = dto.participantIds ? [...new Set([...dto.participantIds, userId])] : [userId];

    const room = await this.prisma.room.create({
      data: {
        name: dto.name,
        isPrivate: dto.isPrivate ?? false,
        historyEnabled: dto.historyEnabled ?? true,
        ownerId: userId,
        participants: {
          connect: participants.map(id => ({ id })),
        },
      },
      include: { participants: true }
    });
    return room;
  }

  async getMyRooms(userId: number) {
    return this.prisma.room.findMany({
      where: {
        OR: [
          { isPrivate: false },
          { participants: { some: { id: userId } } }
        ]
      },
      include: { participants: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAllUsers() {
      return this.prisma.user.findMany({
          select: { id: true, username: true, customColor: true }
      });
  }
}
