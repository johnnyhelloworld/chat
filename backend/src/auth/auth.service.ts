import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, UpdateProfileDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const hash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          password: hash,
        },
      });
      return this.signToken(user.id, user.email, user.username);
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ForbiddenException('Credentials taken');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });
    if (!user) throw new ForbiddenException('Credentials incorrect');

    const pwMatches = await bcrypt.compare(dto.password, user.password);
    if (!pwMatches) throw new ForbiddenException('Credentials incorrect');

    return this.signToken(user.id, user.email, user.username);
  }

  async signToken(userId: number, email: string, username: string): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email,
      username
    };
    const secret = process.env.JWT_SECRET || 'supersecret';

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '1d',
      secret: secret,
    });

    return {
      access_token: token,
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    // Check if username is taken if it's being updated
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing && existing.id !== userId) {
        throw new ForbiddenException('Username already taken');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
      },
    });

    delete (user as any).password;
    return user;
  }
}
