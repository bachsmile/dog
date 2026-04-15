import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../../decorators/roles.decorator';
import { User } from '../user/entities/user.entity';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  exp?: number;
  iat?: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email or username (case-insensitive)
    const normalizedIdentity = email.toLowerCase();
    const user = await this.userRepository.createQueryBuilder('user')
      .where('LOWER(user.email) = :identity', { identity: normalizedIdentity })
      .orWhere('LOWER(user.username) = :identity', { identity: normalizedIdentity })
      .addSelect('user.password')
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password if provided (for mock/test some users might not have it)
    if (password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    if (user.status === 'suspended') {
      throw new UnauthorizedException('Your account has been suspended');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Increment login count
    user.loginCount = (user.loginCount || 0) + 1;
    await this.userRepository.save(user);

    const secret = this.configService.get<string>('JWT_SECRET');

    return {
      access_token: await this.jwtService.signAsync(payload, {
        expiresIn: '1h',
        secret,
      }),
      refresh_token: await this.jwtService.signAsync(payload, {
        expiresIn: '7d',
        secret,
      }),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        username: user.username,
        modules: user.modules || [],
        loginCount: user.loginCount,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      const cleanPayload = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      return {
        access_token: await this.jwtService.signAsync(cleanPayload, {
          expiresIn: '1h',
          secret,
        }),
        refresh_token: await this.jwtService.signAsync(cleanPayload, {
          expiresIn: '7d',
          secret,
        }),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async trial() {
    const payload = {
      sub: 'guest-' + Math.random().toString(36).substring(7),
      email: 'guest@trial.com',
      role: Role.GUEST,
    };

    const secret = this.configService.get<string>('JWT_SECRET');
    return {
      access_token: await this.jwtService.signAsync(payload, { secret }),
      user: {
        email: 'guest@trial.com',
        role: Role.GUEST,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const { email, password, role, username } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password || '123456', 10);

    // Determine role based on adminCode
    let finalRole = role || Role.USER;
    if (registerDto.adminCode === '753951') {
      finalRole = Role.SUPER_ADMIN;
    }

    const newUser = this.userRepository.create({
      email,
      password: hashedPassword,
      role: finalRole,
      username,
      status: registerDto.status || 'active',
      modules: registerDto.modules || [],
      loginCount: 0,
    });

    const savedUser = await this.userRepository.save(newUser);

    return {
      message: 'User registered successfully',
      user: {
        email: savedUser.email,
        role: savedUser.role,
        username: savedUser.username,
        modules: savedUser.modules || [],
        loginCount: savedUser.loginCount,
      },
    };
  }

  async verifyAdminCode(code: string) {
    if (code === '753951') {
      return Promise.resolve({ verified: true });
    }
    return Promise.resolve({ verified: false });
  }

  async cleanDatabase() {
    const queryRunner = this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    try {
      const tables: Array<{ tablename: string }> = await queryRunner.query(`
        SELECT tablename FROM pg_catalog.pg_tables 
        WHERE schemaname = 'public'
      `);
      for (const table of tables) {
        await queryRunner.query(`TRUNCATE TABLE "${table.tablename}" CASCADE;`);
      }
      return { success: true, message: 'All tables truncated successfully' };
    } finally {
      await queryRunner.release();
    }
  }
}
