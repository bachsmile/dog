import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { LawService } from './law.service';
import { CreateLawyerDto, UpdateLawyerDto } from './dto/lawyer.dto';
import { CreateAppointmentDto, QuickBookingDto } from './dto/appointment.dto';
import { Roles, Role } from '../../decorators/roles.decorator';
import { ReqUser } from '../../decorators/req-user.decorator';

@Controller('law')
export class LawController {
  constructor(private readonly lawService: LawService) {}

  @Get('lawyers')
  findAll() {
    return this.lawService.findAll();
  }

  @Get('lawyers/:id')
  findOne(@Param('id') id: string) {
    return this.lawService.findOne(id);
  }

  @Post('lawyers')
  @Roles(Role.ADMIN)
  create(@Body() createLawyerDto: CreateLawyerDto) {
    return this.lawService.create(createLawyerDto);
  }

  @Patch('lawyers/:id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() updateLawyerDto: UpdateLawyerDto) {
    return this.lawService.update(id, updateLawyerDto);
  }

  @Delete('lawyers/:id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.lawService.remove(id);
  }

  @Get('specialties')
  getSpecialties() {
    return this.lawService.getSpecialties();
  }

  @Post('appointments')
  createAppointment(
    @ReqUser('sub') userId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.lawService.createAppointment(userId, dto);
  }

  @Post('appointments/quick')
  quickBooking(@ReqUser('sub') userId: string, @Body() dto: QuickBookingDto) {
    return this.lawService.quickBooking(userId, dto);
  }

  @Get('appointments/my')
  getMyAppointments(@ReqUser('sub') userId: string) {
    return this.lawService.getCustomerAppointments(userId);
  }

  @Get('appointments/lawyer/:id/:date')
  getLawyerAppointments(@Param('id') id: string, @Param('date') date: string) {
    return this.lawService.getLawyerAppointments(id, date);
  }

  @Patch('appointments/:id/confirm')
  @Roles(Role.ADMIN, Role.LAWYER)
  confirmAppointment(@Param('id') id: string) {
    return this.lawService.confirmAppointment(id);
  }

  @Patch('appointments/:id/cancel')
  @Roles(Role.ADMIN, Role.LAWYER)
  cancelAppointment(@Param('id') id: string) {
    return this.lawService.cancelAppointment(id);
  }

  @Get('appointments')
  @Roles(Role.ADMIN, Role.LAWYER)
  getAllAppointments() {
    return this.lawService.getAllAppointments();
  }
}
