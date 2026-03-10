import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as express from 'express';

@Injectable()
export class JsonBodyParserMiddleware implements NestMiddleware {
  private readonly parser = express.json({ limit: '10mb' });

  use(req: Request, res: Response, next: NextFunction) {
    this.parser(req, res, next);
  }
}

@Injectable()
export class UrlencodedBodyParserMiddleware implements NestMiddleware {
  private readonly parser = express.urlencoded({
    extended: true,
    limit: '10mb',
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.parser(req, res, next);
  }
}
