import { Controller, Post, Body, Get } from '@nestjs/common';
import { Public } from '../../decorators/public.decorator';


import { LicenseService } from './license.service';

@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get()
  async findAll() {
    return this.licenseService.findAll();
  }

  @Post()

  async createLicense(
    @Body('expiresAt') expiresAt: Date,
    @Body('metadata') metadata?: string,
  ) {
    return this.licenseService.generate(expiresAt, metadata);
  }

  @Public()
  @Post('npm')

  async verifyLicense(
    @Body('licenseKey') licenseKey: string,
  ) {
    return this.licenseService.verify(licenseKey);
  }
}
