import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ahmed.mohamed', description: 'اسم المستخدم' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'StrongP@ss123', description: 'كلمة المرور' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class RequestDeviceApprovalDto {
  @ApiProperty({ example: 'ahmed.mohamed', description: 'اسم المستخدم' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'StrongP@ss123', description: 'كلمة المرور' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'أعمل من المنزل اليوم', description: 'سبب الدخول من جهاز جديد' })
  @IsString()
  @MinLength(5)
  reason: string;
}

export class RequestExternalCodeDto {
  @ApiProperty({ description: 'اسم المستخدم' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'كلمة المرور' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class SubmitExternalRequestDto {
  @ApiProperty({ description: 'اسم المستخدم / الرقم الوظيفي' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'كلمة المرور' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'الاسم الثلاثي كما هو مسجّل' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ description: 'رمز التحقّق المُرسَل على البريد' })
  @IsString()
  @IsNotEmpty()
  otpCode: string;
}

export class ExternalLockDto {
  @ApiProperty({ description: 'معرّف المستخدم' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'قفل (true) أو فتح (false) الدخول الخارجي' })
  locked: boolean;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    role: string;
    roleName: string;
    department: string;
  };
}
