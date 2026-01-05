import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RoomService } from './room.service';
import { CreateRoomDto } from './room.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('rooms')
export class RoomController {
  constructor(private roomService: RoomService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateRoomDto) {
    return this.roomService.createRoom(req.user.id, dto);
  }

  @Get()
  findAll(@Req() req) {
    return this.roomService.getMyRooms(req.user.id);
  }

  @Get('users')
  getUsers() {
    return this.roomService.getAllUsers();
  }
}
