import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator đánh dấu route là public, không cần xác thực JWT.
 * Sử dụng: @Public() trước controller method hoặc class.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
