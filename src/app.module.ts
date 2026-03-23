import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  JsonBodyParserMiddleware,
  UrlencodedBodyParserMiddleware,
} from './middlewares/body-parser.middleware';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { User } from './modules/user/entities/user.entity';
import { P2pModule } from './modules/p2p/p2p.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { WalletConfig } from './modules/wallet/entities/wallet-config.entity';
import { WalletTransaction } from './modules/wallet/entities/wallet-transaction.entity';
import { WalletSavings } from './modules/wallet/entities/wallet-savings.entity';
import { LawModule } from './modules/law/law.module';
import { Lawyer } from './modules/law/entities/lawyer.entity';
import { ChatModule } from './modules/chat/chat.module';
import { LawChatModule } from './modules/law-chat/law-chat.module';
import { LawChatRoom } from './modules/law-chat/entities/law-chat-room.entity';
import { LawAppointment } from './modules/law/entities/law-appointment.entity';
import { LawApplication } from './modules/law/entities/law-application.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          User,
          WalletConfig,
          WalletTransaction,
          WalletSavings,
          Lawyer,
          LawChatRoom,
          LawAppointment,
          LawApplication,
        ],
        autoLoadEntities: true,
        synchronize: true, // Auto create/update table - use false in production
      }),
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    P2pModule,
    WalletModule,
    LawModule,
    ChatModule,
    LawChatModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        // CorsMiddleware,
        JsonBodyParserMiddleware,
        UrlencodedBodyParserMiddleware,
      )
      .forRoutes('*');
  }
}
