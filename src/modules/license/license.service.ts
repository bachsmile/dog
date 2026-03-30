import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License } from './entities/license.entity';
import * as crypto from 'crypto';

@Injectable()
export class LicenseService {
  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
  ) {}

  async findAll(): Promise<License[]> {
    return await this.licenseRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async generate(expiresAt: Date, metadata?: string): Promise<License> {
    const bytes = crypto.randomBytes(24).toString('hex').toUpperCase();
    const matches = bytes.match(/.{1,4}/g);
    const licenseKey = matches ? matches.join('-') : bytes;

    
    const newLicense = this.licenseRepository.create({
      licenseKey,
      expiresAt: new Date(expiresAt),
      isActive: true,
      metadata,
    });

    return await this.licenseRepository.save(newLicense);
  }

  async verify(licenseKey: string): Promise<{
    isValid: boolean;
    license?: License;
    message?: string;
  }> {
    const license = await this.licenseRepository.findOne({
      where: { licenseKey },
    });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    const now = new Date();
    const isExpired = license.expiresAt < now;

    if (!license.isActive) {
      return { isValid: false, license, message: 'License is deactivated' };
    }

    if (isExpired) {
      return { isValid: false, license, message: 'License has expired' };
    }

    return { isValid: true, license, message: 'License is valid' };
  }
}
