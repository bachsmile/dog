import { Controller, Post, Body, Get, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../../decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() refreshTokenDto: { refresh_token: string }) {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  @Public()
  @Get('trial')
  trial() {
    console.log('trial');
    return this.authService.trial();
  }

  @Public()
  @HttpCode(200)
  @Post('verify-admin-code')
  verifyAdminCode(@Body() body: { code: string }) {
    return this.authService.verifyAdminCode(body.code);
  }
  @Public()
  @Post('clean-database')
  cleanDatabase() {
    return this.authService.cleanDatabase();
  }
}
