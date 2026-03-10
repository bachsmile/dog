import { Injectable } from '@nestjs/common';
import axios from 'axios';

export class P2pQueryDto {
  page?: number;
  rows?: number;
  payTypes?: string[];
  asset?: string;
  tradeType?: string;
  fiat?: string;
}

@Injectable()
export class P2pService {
  private readonly binanceUrl =
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

  private priceCache: Map<string, { price: number; timestamp: number }> =
    new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  async getP2pPrices(query: P2pQueryDto): Promise<any> {
    try {
      const response = await axios.post(this.binanceUrl, {
        page: query.page || 1,
        rows: query.rows || 10,
        payTypes: query.payTypes || ['BANK'],
        asset: query.asset || 'USDT',
        tradeType: query.tradeType || 'BUY',
        fiat: query.fiat || 'VND',
        publisherType: null,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching Binance P2P data:', error);
      throw error;
    }
  }

  async getAssetPriceInVnd(asset: string): Promise<number> {
    if (asset === 'VND') return 1;

    const cached = this.priceCache.get(asset);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    try {
      const data = (await this.getP2pPrices({
        asset,
        tradeType: 'BUY',
      })) as { data?: { adv: { price: string } }[] };

      if (data?.data && data.data.length > 0) {
        const price = parseFloat(data.data[0].adv.price);
        this.priceCache.set(asset, { price, timestamp: Date.now() });
        return price;
      }
    } catch (error) {
      console.error(`Error fetching price for ${asset}:`, error);
    }

    // Default fallbacks if API fails
    const fallbacks: Record<string, number> = {
      USDT: 0,
      BTC: 0,
      ETH: 0,
    };
    return fallbacks[asset] || 0;
  }
}
