import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (this.genAI) return;

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY chưa được cấu hình. AI sẽ không hoạt động.',
      );
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('Gemini AI (@google/generative-ai) đã được khởi tạo.');
    } catch (error) {
      this.logger.error('Lỗi khi khởi tạo Gemini AI:', error);
    }
  }

  /**
   * Tạo văn bản phản hồi đơn giản
   */
  async generateText(
    prompt: string,
    modelName: string = 'gemini-1.5-flash',
  ): Promise<string> {
    this.ensureInitialized();
    if (!this.genAI) throw new Error('AI chưa được cấu hình.');

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      this.logger.error(`Lỗi khi tạo văn bản với model ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Khởi động một phiên chat
   */
  async chat(
    prompt: string,
    history: any[] = [],
    modelName: string = 'gemini-1.5-flash',
  ) {
    this.ensureInitialized();
    if (!this.genAI) throw new Error('AI chưa được cấu hình.');

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const chat = model.startChat({
        history: history.map((h) => ({
          role: h.role,
          parts: h.parts.map((p: any) => ({ text: p.text })),
        })),
      });

      const result = await chat.sendMessage(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      this.logger.error(`Lỗi khi chat với model ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Chat với AI theo dạng stream
   */
  async chatStream(
    prompt: string,
    history: any[] = [],
    modelName: string = 'gemini-1.5-flash',
  ) {
    this.ensureInitialized();
    if (!this.genAI) throw new Error('AI chưa được cấu hình.');

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const chat = model.startChat({
        history: history.map((h) => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: h.parts.map((p: any) => ({ text: p.text })),
        })),
      });

      const result = await chat.sendMessageStream(prompt);
      return result.stream;
    } catch (error) {
      this.logger.error(`Lỗi khi chat stream với model ${modelName}:`, error);
      throw error;
    }
  }
}
