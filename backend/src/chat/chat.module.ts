import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [RoomController],
  providers: [ChatGateway, RoomService],
})
export class ChatModule {}
