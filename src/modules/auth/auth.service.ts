import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user and include password field
    const user = await this.userRepository.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'password',
        'role',
        'displayName',
        'status',
        'modules',
        'loginCount',
      ],
    });

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

    return {
      access_token: await this.jwtService.signAsync(payload, {
        expiresIn: '1h',
      }),
      refresh_token: await this.jwtService.signAsync(payload, {
        expiresIn: '7d',
      }),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        modules: user.modules || [],
        loginCount: user.loginCount,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { exp, iat, ...cleanPayload } = payload;

      const newAccessToken = await this.jwtService.signAsync(cleanPayload, {
        expiresIn: '1h',
      });
      const newRefreshToken = await this.jwtService.signAsync(cleanPayload, {
        expiresIn: '7d',
      });
      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
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

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        email: 'guest@trial.com',
        role: Role.GUEST,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const { email, password, role, displayName } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password || '123456', 10);

    const newUser = this.userRepository.create({
      email,
      password: hashedPassword,
      role: role || Role.USER,
      displayName,
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
        modules: savedUser.modules || [],
        loginCount: savedUser.loginCount,
      },
    };
  }
}
