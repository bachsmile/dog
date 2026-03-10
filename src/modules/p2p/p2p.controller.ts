import { Body, Controller, Post } from '@nestjs/common';
import { P2pService, P2pQueryDto } from './p2p.service';
import { Public } from '../../decorators/public.decorator';

@Controller('p2p')
export class P2pController {
  constructor(private readonly p2pService: P2pService) {}

  @Public()
  @Post('search')
  async searchP2p(@Body() body: P2pQueryDto): Promise<any> {
    return this.p2pService.getP2pPrices(body);
  }
}
