import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lawyer } from './entities/lawyer.entity';
import { User } from '../user/entities/user.entity';
import { Role } from '../../decorators/roles.decorator';
import { CreateLawyerDto, UpdateLawyerDto } from './dto/lawyer.dto';
import { LawAppointment } from './entities/law-appointment.entity';
import { LawApplication } from './entities/law-application.entity';
import { CreateAppointmentDto, QuickBookingDto } from './dto/appointment.dto';
import {
  CreateLawApplicationDto,
  UpdateLawApplicationDto,
} from './dto/law-application.dto';

@Injectable()
export class LawService {
  constructor(
    @InjectRepository(Lawyer)
    private lawyerRepository: Repository<Lawyer>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LawAppointment)
    private appointmentRepository: Repository<LawAppointment>,
    @InjectRepository(LawApplication)
    private applicationRepository: Repository<LawApplication>,
  ) {}

  async findAll() {
    return this.lawyerRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const lawyer = await this.lawyerRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!lawyer) throw new NotFoundException('Lawyer not found');
    return lawyer;
  }

  async create(createLawyerDto: CreateLawyerDto) {
    const { userId, specialty, bio } = createLawyerDto;

    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Check if already a lawyer
    const existingLawyer = await this.lawyerRepository.findOne({
      where: { userId },
    });
    if (existingLawyer) throw new ConflictException('User is already a lawyer');

    // Create lawyer record
    const lawyer = this.lawyerRepository.create({
      userId,
      specialty,
      bio,
    });

    // Update user role
    user.role = Role.LAWYER;
    await this.userRepository.save(user);

    return this.lawyerRepository.save(lawyer);
  }

  async update(id: string, updateLawyerDto: UpdateLawyerDto) {
    const lawyer = await this.findOne(id);
    Object.assign(lawyer, updateLawyerDto);
    return this.lawyerRepository.save(lawyer);
  }

  async remove(id: string) {
    const lawyer = await this.findOne(id);

    // Optional: Revert user role back to USER
    const user = await this.userRepository.findOne({
      where: { id: lawyer.userId },
    });
    if (user) {
      user.role = Role.USER;
      await this.userRepository.save(user);
    }

    return this.lawyerRepository.remove(lawyer);
  }

  getSpecialties() {
    return [
      'Luật Dân sự',
      'Luật Hình sự',
      'Luật Kinh tế & Doanh nghiệp',
      'Luật Đất đai',
      'Hôn nhân & Gia đình',
      'Sở hữu trí tuệ',
      'Lao động',
      'Thuế & Tài chính',
      'Bảo hiểm & Y tế',
    ];
  }

  async createAppointment(customerId: string, dto: CreateAppointmentDto) {
    const { lawyerId, date, hours } = dto;

    // 1. Check busy factor for each hour
    const lawyer = await this.findOne(lawyerId);
    for (const h of hours) {
      if (this.isBusy(lawyer.busySchedule, date, h)) {
        throw new ConflictException(`Luật sư bận vào khung giờ ${h}:00.`);
      }
    }

    // 2. Check existing confirmed or pending appointments for overlaps
    const existingDayAppointments = await this.appointmentRepository.find({
      where: [
        { lawyerId, date, status: 'confirmed' },
        { lawyerId, date, status: 'pending' },
      ],
    });

    const bookedHours = existingDayAppointments.flatMap((a) =>
      (a.hours || []).map((h) => Number(h)),
    );
    for (const h of hours) {
      if (bookedHours.includes(h)) {
        throw new ConflictException(`Khung giờ ${h}:00 đã có người đặt.`);
      }
    }

    const ap = this.appointmentRepository.create({
      ...dto,
      customerId,
      status: 'pending', // Initial status is pending
    });
    const savedAp = await this.appointmentRepository.save(ap);

    // Note: We don't sync busySchedule here anymore.
    // It will be synced when the lawyer confirms the appointment.

    return savedAp;
  }

  async confirmAppointment(id: string) {
    const ap = await this.appointmentRepository.findOne({
      where: { id },
    });

    if (!ap) throw new NotFoundException('Không tìm thấy lịch hẹn.');
    if (ap.status === 'confirmed') return ap;

    ap.status = 'confirmed';
    const savedAp = await this.appointmentRepository.save(ap);

    // Sync with lawyer's busySchedule only on confirmation
    const lawyer = await this.findOne(ap.lawyerId);
    const schedule = lawyer.busySchedule || [];
    const { date, hours } = ap;
    const dateIndex = schedule.findIndex((s) => s.startsWith(date));

    if (dateIndex > -1) {
      try {
        const parts = schedule[dateIndex].split('[');
        const existingHoursContent = parts[1].split(']')[0];
        const existingHours = existingHoursContent
          ? existingHoursContent.split(',').map((h) => parseInt(h.trim()))
          : [];

        const mergedHours = Array.from(
          new Set([...existingHours, ...(hours || [])]),
        ).sort((a, b) => a - b);
        schedule[dateIndex] = `${date}-[${mergedHours.join(',')}]`;
      } catch {
        schedule[dateIndex] = `${date}-[${(hours || []).join(',')}]`;
      }
    } else {
      const sortedHours = (hours || []).sort((a, b) => a - b);
      schedule.push(`${date}-[${sortedHours.join(',')}]`);
    }

    lawyer.busySchedule = schedule;
    await this.lawyerRepository.save(lawyer);

    return savedAp;
  }

  async quickBooking(customerId: string, dto: QuickBookingDto) {
    const { date, hours, specialty } = dto;

    // Find all lawyers with this specialty
    const lawyers = await this.lawyerRepository.find({
      where: { specialty },
    });

    for (const lawyer of lawyers) {
      let isLawyerAvailable = true;

      // Check all requested hours
      for (const h of hours) {
        if (this.isBusy(lawyer.busySchedule, date, h)) {
          isLawyerAvailable = false;
          break;
        }
      }

      if (isLawyerAvailable) {
        // Check existing appointments for this lawyer on this day
        const existingDayAppointments = await this.appointmentRepository.find({
          where: [
            { lawyerId: lawyer.id, date, status: 'confirmed' },
            { lawyerId: lawyer.id, date, status: 'pending' },
          ],
        });

        const bookedHours = existingDayAppointments.flatMap((a) =>
          (a.hours || []).map((h) => Number(h)),
        );
        for (const h of hours) {
          if (bookedHours.includes(h)) {
            isLawyerAvailable = false;
            break;
          }
        }
      }

      if (isLawyerAvailable) {
        // Match found!
        return this.createAppointment(customerId, {
          lawyerId: lawyer.id,
          date,
          hours,
          specialty,
        });
      }
    }

    throw new NotFoundException(
      'Hiện không có luật sư nào rảnh vào các khung giờ này cho chuyên môn ' +
        specialty,
    );
  }

  async getLawyerAppointments(lawyerId: string, date: string) {
    const appointments = await this.appointmentRepository.find({
      where: [
        { lawyerId, date, status: 'confirmed' },
        { lawyerId, date, status: 'pending' },
      ],
    });

    const lawyer = await this.lawyerRepository.findOne({
      where: { id: lawyerId },
    });

    return {
      appointments,
      busySchedule: lawyer?.busySchedule || [],
    };
  }

  async getCustomerAppointments(customerId: string) {
    return this.appointmentRepository.find({
      where: { customerId },
      relations: ['lawyer', 'lawyer.user'],
      order: { date: 'ASC' },
    });
  }

  async getAllAppointments() {
    return this.appointmentRepository.find({
      relations: ['lawyer', 'lawyer.user', 'customer'],
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async cancelAppointment(id: string) {
    const ap = await this.appointmentRepository.findOne({
      where: { id },
    });

    if (!ap) throw new NotFoundException('Không tìm thấy lịch hẹn.');
    if (ap.status === 'cancelled') return ap;

    // If it was confirmed, we might want to remove it from busySchedule
    // but the current implementation doesn't support easy removal from the string format.
    // For now, just mark as cancelled.

    ap.status = 'cancelled';
    return this.appointmentRepository.save(ap);
  }

  private isBusy(busySchedule: string[], date: string, hour: number): boolean {
    if (!busySchedule || !Array.isArray(busySchedule)) return false;
    const dayStr = busySchedule.find((s) => s.startsWith(date));
    if (dayStr) {
      try {
        const hoursPart = dayStr.split('[')[1].split(']')[0];
        const hours = hoursPart.split(',').map((h) => parseInt(h.trim()));
        return hours.includes(hour);
      } catch {
        return false;
      }
    }
    return false;
  }

  // Applications
  async findAllApplications() {
    return this.applicationRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOneApplication(id: string) {
    const app = await this.applicationRepository.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application template not found');
    return app;
  }

  async createApplication(dto: CreateLawApplicationDto) {
    const app = this.applicationRepository.create(dto);
    return this.applicationRepository.save(app);
  }

  async updateApplication(id: string, dto: UpdateLawApplicationDto) {
    const app = await this.findOneApplication(id);
    Object.assign(app, dto);
    return this.applicationRepository.save(app);
  }

  async removeApplication(id: string) {
    const app = await this.findOneApplication(id);
    return this.applicationRepository.remove(app);
  }
}
