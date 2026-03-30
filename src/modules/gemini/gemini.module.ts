import { Module, Global } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { GeminiController } from './gemini.controller';

/**
 * Đánh dấu @Global() để có thể sử dụng Gemini cho tất cả các module
 * như LawChat, System Metrics, v.v. mà không cần import n lần.
 */
@Global()
@Module({
  controllers: [GeminiController],
  providers: [GeminiService],
  exports: [GeminiService],
})

export class GeminiModule {}
