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
  private readonly CACHE_TTL = 3600000; // 1 hour

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
      USDT: 25000,
      BTC: 1600000000,
      ETH: 100000000,
      FZ: 50000, // Fixed price for Finzo Token
    };
    return fallbacks[asset] || 0;
  }

  async getAsset24hChange(asset: string): Promise<number> {
    if (asset === 'VND') return 0;
    try {
      const symbol = asset === 'USDT' ? 'USDTBIDR' : `${asset}USDT`; // Placeholder for 24h change, USDT needs a pair like USDT/VND or USDT/DAI. For simplicity let's use USDT as stable (0% change) or compare with a fiat pair if available.
      // Better: many stablecoins fluctuate ~0.1%. Let's assume 0% for USDT unless we have a USDT/VND historical price.
      if (asset === 'USDT') return 0;

      const response = await axios.get<{ priceChangePercent: string }>(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
      );
      return parseFloat(response.data.priceChangePercent);
    } catch {
      return 0;
    }
  }
}
