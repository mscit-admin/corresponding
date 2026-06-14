import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: bigint;
  username: string;
  email: string;
  roleId: bigint;
  departmentId: bigint;
  role?: { name: string };
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user?.[data] : user;
  },
);
