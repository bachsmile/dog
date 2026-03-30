import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GeminiService } from './gemini.service';

@Controller('ai')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('generate')
  async generate(
    @Body('prompt') prompt: string,
    @Body('model') model?: string,
  ) {
    const text = await this.geminiService.generateText(prompt, model);
    return { text };
  }

  @Post('chat')
  async chat(
    @Body('prompt') prompt: string,
    @Body('history') history: any[] = [],
    @Body('model') model?: string,
  ) {
    try {
      const text = await this.geminiService.chat(prompt, history, model);
      return { text };
    } catch (error) {
      const err = error as Error;
      console.error('Gemini Chat Error:', err);
      return {
        text:
          '⚠️ Không thể nhận phản hồi từ AI. Lỗi: ' +
          (err.message || 'Unknown error'),
        error: true,
      };
    }
  }

  @Post('chat-stream')
  async chatStream(
    @Res() res: Response,
    @Body('prompt') prompt: string,
    @Body('history') history: any[] = [],
    @Body('model') model?: string,
  ) {
    try {
      const stream = await this.geminiService.chatStream(
        prompt,
        history,
        model,
      );

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of stream) {
        const chunkText = chunk.text();
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      const err = error as Error;
      console.error('Gemini Stream Error:', err);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}
