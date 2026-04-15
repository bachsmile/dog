import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Patch,
  Param,
} from '@nestjs/common';
import { WeddingService } from './wedding.service';
import { AuthGuard } from '../../guards/auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../decorators/roles.decorator';

@Controller('wedding')
export class WeddingController {
  constructor(private readonly weddingService: WeddingService) {}

  @UseGuards(AuthGuard)
  @Post('orders')
  async createOrder(@Request() req, @Body() orderData: any) {
    return this.weddingService.createOrder(req.user.sub, orderData);
  }

  @UseGuards(AuthGuard)
  @Get('my-orders')
  async getMyOrders(@Request() req) {
    return this.weddingService.getMyOrders(req.user.sub);
  }

  // Get invitation links for a completed order (user's own order)
  @UseGuards(AuthGuard)
  @Get('orders/:id/invitations')
  async getOrderInvitations(@Request() req, @Param('id') id: string) {
    return this.weddingService.getOrderInvitations(req.user.sub, id);
  }

  // PUBLIC: View a personalized invitation — no auth required
  @Get('invitation/:code')
  async getPublicInvitation(@Param('code') code: string) {
    return this.weddingService.getPublicInvitation(code);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('admin/orders')
  async getAdminOrders(@Request() req) {
    return this.weddingService.getAdminOrders(req.user.sub);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('admin/orders/:id')
  async getOrderDetail(@Param('id') id: string) {
    return this.weddingService.getOrderById(id);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('orders/:id/status')
  async updateOrderStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.weddingService.updateOrderStatus(id, status);
  }

  @UseGuards(AuthGuard)
  @Post('validate-guests')
  async validateGuests(@Body('guests') guests: any[]) {
    return this.weddingService.validateGuestList(guests);
  }
}
