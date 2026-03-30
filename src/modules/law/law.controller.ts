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
import { LawSchedulerService } from './law-scheduler.service';
import { CreateLawyerDto, UpdateLawyerDto } from './dto/lawyer.dto';
import { CreateAppointmentDto, QuickBookingDto } from './dto/appointment.dto';
import { CreateLawScheduleDto } from './dto/law-schedule.dto';
import { Roles, Role } from '../../decorators/roles.decorator';
import { ReqUser } from '../../decorators/req-user.decorator';
import {
  CreateLawApplicationDto,
  UpdateLawApplicationDto,
} from './dto/law-application.dto';
import {
  CreateLawSubmissionDto,
  UpdateLawSubmissionStatusDto,
} from './dto/law-submission.dto';
import { CreateLawArticleDto } from './dto/create-law-article.dto';
import { UpdateLawArticleDto } from './dto/update-law-article.dto';
import {
  CreateLawQuestionDto,
  AnswerLawQuestionDto,
} from './dto/law-question.dto';

@Controller('law')
export class LawController {
  constructor(
    private readonly lawService: LawService,
    private readonly lawSchedulerService: LawSchedulerService,
  ) {}

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

  // Application Templates
  @Get('applications')
  findAllApplications() {
    return this.lawService.findAllApplications();
  }

  @Get('applications/:id')
  findOneApplication(@Param('id') id: string) {
    return this.lawService.findOneApplication(id);
  }

  @Post('applications')
  @Roles(Role.ADMIN, Role.LAWYER)
  createApplication(@Body() dto: CreateLawApplicationDto) {
    return this.lawService.createApplication(dto);
  }

  @Patch('applications/:id')
  @Roles(Role.ADMIN, Role.LAWYER)
  updateApplication(
    @Param('id') id: string,
    @Body() dto: UpdateLawApplicationDto,
  ) {
    return this.lawService.updateApplication(id, dto);
  }

  @Delete('applications/:id')
  @Roles(Role.ADMIN, Role.LAWYER)
  removeApplication(@Param('id') id: string) {
    return this.lawService.removeApplication(id);
  }

  // Submissions (Submitted Applications)
  @Get('submissions')
  @Roles(Role.ADMIN, Role.LAWYER)
  findAllSubmissions() {
    return this.lawService.findAllSubmissions();
  }

  @Get('submissions/my')
  findMySubmissions(@ReqUser('sub') userId: string) {
    return this.lawService.findMySubmissions(userId);
  }

  @Post('submissions')
  createSubmission(
    @ReqUser('sub') userId: string,
    @Body() dto: CreateLawSubmissionDto,
  ) {
    return this.lawService.createSubmission(userId, dto);
  }

  @Patch('submissions/:id/status')
  @Roles(Role.ADMIN, Role.LAWYER)
  updateSubmissionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLawSubmissionStatusDto,
  ) {
    return this.lawService.updateSubmissionStatus(id, dto);
  }

  @Delete('submissions/:id')
  @Roles(Role.ADMIN, Role.LAWYER)
  removeSubmission(@Param('id') id: string) {
    return this.lawService.removeSubmission(id);
  }

  // Auto Scheduling
  @Post('schedule/generate')
  @Roles(Role.ADMIN)
  generateSchedule(@Body() dto: CreateLawScheduleDto) {
    return this.lawSchedulerService.generateSchedule(dto);
  }

  // Articles
  @Get('articles')
  findAllArticles() {
    return this.lawService.findAllArticles();
  }

  @Get('articles/:id')
  findOneArticle(@Param('id') id: string) {
    return this.lawService.findOneArticle(id);
  }

  @Post('articles')
  @Roles(Role.ADMIN, Role.LAWYER)
  createArticle(
    @Body() dto: CreateLawArticleDto,
    @ReqUser('sub') userId: string,
  ) {
    return this.lawService.createArticle(dto, userId);
  }

  @Patch('articles/:id')
  @Roles(Role.ADMIN, Role.LAWYER)
  updateArticle(@Param('id') id: string, @Body() dto: UpdateLawArticleDto) {
    return this.lawService.updateArticle(id, dto);
  }

  @Delete('articles/:id')
  @Roles(Role.ADMIN, Role.LAWYER)
  removeArticle(@Param('id') id: string) {
    return this.lawService.removeArticle(id);
  }

  @Post('articles/:id/view')
  incrementArticleViews(@Param('id') id: string) {
    return this.lawService.incrementArticleViews(id);
  }

  // Questions (Q&A)
  @Post('questions')
  createQuestion(
    @ReqUser('sub') userId: string,
    @Body() dto: CreateLawQuestionDto,
  ) {
    return this.lawService.createQuestion(userId, dto);
  }

  @Get('questions/my')
  findMyQuestions(@ReqUser('sub') userId: string) {
    return this.lawService.findMyQuestions(userId);
  }

  @Get('questions')
  @Roles(Role.ADMIN, Role.LAWYER)
  findAllQuestions() {
    return this.lawService.findAllQuestions();
  }

  @Patch('questions/:id/answer')
  @Roles(Role.ADMIN, Role.LAWYER)
  answerQuestion(
    @Param('id') id: string,
    @ReqUser('sub') userId: string,
    @Body() dto: AnswerLawQuestionDto,
  ) {
    return this.lawService.answerQuestion(id, userId, dto);
  }

  @Delete('questions/:id')
  @Roles(Role.ADMIN, Role.LAWYER)
  removeQuestion(@Param('id') id: string) {
    return this.lawService.removeQuestion(id);
  }
}
