import { Controller, Post, Body, Get, Patch, Param } from '@nestjs/common';
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

  @Patch(':id')
  async updateLicense(
    @Param('id') id: string,
    @Body('expiresAt') expiresAt?: Date,
    @Body('metadata') metadata?: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.licenseService.update(id, { expiresAt, metadata, isActive });
  }

  @Public()
  @Post('npm')

  async verifyLicense(
    @Body('licenseKey') licenseKey: string,
  ) {
    return this.licenseService.verify(licenseKey);
  }
}
