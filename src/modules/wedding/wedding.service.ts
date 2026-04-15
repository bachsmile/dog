import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeddingOrder } from './entities/wedding-order.entity';
import { User } from '../user/entities/user.entity';

interface CreateOrderDto {
  planId: string;
  templateId?: string;
  quantity: number;
  unitPrice: number;
  serviceFee: number;
  totalAmount: number;
  deliveryType: string;
  weddingData?: any;
  guestList?: any[];
  paymentReceipt?: string;
}

interface GuestRow {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

@Injectable()
export class WeddingService {
  constructor(
    @InjectRepository(WeddingOrder)
    private readonly orderRepository: Repository<WeddingOrder>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createOrder(userId: string, orderData: CreateOrderDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newOrder = this.orderRepository.create({
      userId: userId,
      parentAdminId: user.createdBy,
      planId: orderData.planId,
      templateId: orderData.templateId,
      quantity: orderData.quantity,
      unitPrice: orderData.unitPrice,
      serviceFee: orderData.serviceFee,
      totalAmount: orderData.totalAmount,
      deliveryType: orderData.deliveryType,
      weddingData: orderData.weddingData,
      guestList: orderData.guestList,
      paymentReceipt: orderData.paymentReceipt,
      status: 'pending',
    });

    return await this.orderRepository.save(newOrder);
  }

  async getMyOrders(userId: string) {
    return await this.orderRepository.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAdminOrders(adminId: string) {
    return await this.orderRepository.find({
      where: { parentAdminId: adminId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOrderById(orderId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrderStatus(orderId: string, status: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    order.status = status;
    return await this.orderRepository.save(order);
  }

  // Generate invitation links for each guest in a completed order
  async getOrderInvitations(userId: string, orderId: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'completed' && order.status !== 'confirmed') {
      throw new BadRequestException('Đơn hàng chưa được duyệt hoặc hoàn thành');
    }
    if (!order.guestList || order.guestList.length === 0) {
      return { invitations: [], total: 0 };
    }

    const invitations = order.guestList.map((guest: any, index: number) => {
      // Encode: orderId|guestIndex → base64url
      const payload = `${orderId}|${index}`;
      const code = Buffer.from(payload, 'utf-8').toString('base64url');
      return {
        index,
        name: guest.name || '',
        phone: guest.phone || '',
        email: guest.email || '',
        code,
        link: `/invitation/${code}`,
      };
    });

    return { invitations, total: invitations.length, orderId: order.id };
  }

  // Public: decode invitation code and return wedding data + personalized guest info
  async getPublicInvitation(code: string) {
    let decoded: string;
    try {
      decoded = Buffer.from(code, 'base64url').toString('utf-8');
    } catch {
      throw new BadRequestException('Mã thiệp không hợp lệ');
    }

    const parts = decoded.split('|');
    if (parts.length !== 2) throw new BadRequestException('Mã thiệp không hợp lệ');

    const [orderId, guestIndexStr] = parts;
    const guestIndex = parseInt(guestIndexStr, 10);
    if (isNaN(guestIndex)) throw new BadRequestException('Mã thiệp không hợp lệ');

    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Thiệp mời không tồn tại');
    if (order.status !== 'completed' && order.status !== 'confirmed') {
      throw new BadRequestException('Thiệp mời chưa sẵn sàng');
    }

    const guest = order.guestList?.[guestIndex];
    if (!guest) throw new NotFoundException('Khách mời không tồn tại');

    return {
      templateId: order.templateId || 'elegant',
      weddingData: order.weddingData,
      guest: {
        name: guest.name || '',
        phone: guest.phone || '',
        email: guest.email || '',
      },
    };
  }

  validateGuestList(guests: GuestRow[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!guests || !Array.isArray(guests) || guests.length === 0) {
      return { valid: false, errors: ['Danh sách khách mời trống'] };
    }

    guests.forEach((guest, idx) => {
      const row = idx + 1;
      if (!guest.name || guest.name.trim() === '') {
        errors.push(`Dòng ${row}: Thiếu tên khách mời`);
      }
      if (!guest.phone && !guest.email) {
        errors.push(`Dòng ${row}: Cần ít nhất SĐT hoặc Email`);
      }
      if (guest.phone && !/^[0-9+\s()-]{8,15}$/.test(guest.phone.trim())) {
        errors.push(`Dòng ${row}: SĐT không hợp lệ`);
      }
      if (guest.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim())) {
        errors.push(`Dòng ${row}: Email không hợp lệ`);
      }
    });

    return { valid: errors.length === 0, errors };
  }
}
