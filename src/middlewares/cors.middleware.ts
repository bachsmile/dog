import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly allowedOrigins: string[] = [
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:8080',
  ];

  use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;

    // Nếu origin nằm trong danh sách cho phép, set header tương ứng
    if (origin && this.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept',
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight 24h

    // Xử lý preflight request (OPTIONS)
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  }
}
