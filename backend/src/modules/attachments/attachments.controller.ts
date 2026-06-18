import {
  Controller, Post, Get, Delete, Param, UploadedFile, UseInterceptors,
  UseGuards, Req, Res, BadRequestException, NotFoundException, ForbiddenException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AttachmentsService } from './attachments.service';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Response } from 'express';

// Ensure uploads directory exists
const UPLOADS_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

@ApiTags('Attachments')
@Controller({ path: 'attachments', version: '1' })
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Post('upload/:correspondenceType/:correspondenceId')
  @ApiOperation({ summary: 'رفع مرفق لمراسلة' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname);
          cb(null, `${unique}${ext}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/pdf',
          'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif',
          'application/msword', // .doc
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/vnd.ms-excel', // .xls
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('نوع الملف غير مدعوم. المسموح: PDF, Word, Excel, JPG, PNG, WEBP'), false);
        }
      },
    }),
  )
  async upload(
    @Param('correspondenceType') type: string,
    @Param('correspondenceId') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('لم يتم تحديد ملف');
    if (!['incoming', 'outgoing'].includes(type)) {
      throw new BadRequestException('نوع المراسلة يجب أن يكون incoming أو outgoing');
    }
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '0.0.0.0';
    return this.service.save({
      correspondenceType: type,
      correspondenceId: id,
      file,
      userId: req.user.id || req.user.sub || req.user.userId,
      ip,
    });
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'تحميل/عرض مرفق (يسجّل المشاهدة)' })
  async download(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const attachment = await this.service.findById(id);
    if (!attachment) throw new NotFoundException('المرفق غير موجود');

    const filePath = join(UPLOADS_DIR, attachment.fileName);
    if (!existsSync(filePath)) throw new NotFoundException('الملف غير موجود على الخادم');

    // سجّل فتح المستند لكل من يفتحه (بما فيهم المُدخِل)
    const userId = req.user?.id || req.user?.sub || req.user?.userId;
    await this.service.recordView(id, userId);

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    return res.sendFile(filePath);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'معاينة مرفق داخل النظام (يحوّل Word/Excel إلى PDF)' })
  async preview(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    let file: { path: string; mimeType: string; originalName: string } | null;
    try {
      file = await this.service.getPreviewFile(id);
    } catch (e: any) {
      throw new BadRequestException('تعذّر تجهيز معاينة لهذا الملف');
    }
    if (!file) throw new NotFoundException('لا يمكن معاينة هذا الملف');

    const userId = req.user?.id || req.user?.sub || req.user?.userId;
    await this.service.recordView(id, userId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    return res.sendFile(file.path);
  }

  @Get(':id/views')
  @ApiOperation({ summary: 'سجلّ من فتح المستند ومتى (للأدمن الرئيسي فقط)' })
  async views(@Param('id') id: string, @Req() req: any) {
    const roleName = req.user?.role?.name;
    if (roleName !== 'super_admin') {
      throw new ForbiddenException('سجلّ مشاهدة المستندات متاح للأدمن الرئيسي فقط');
    }
    return this.service.getViews(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'حذف مرفق (يتطلب صلاحية التعديل)' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const roleName = req.user?.role?.name;
    if (!['super_admin', 'archive_mgr'].includes(roleName)) {
      throw new ForbiddenException('ليس لديك صلاحية حذف المرفقات');
    }
    const userId = req.user?.id || req.user?.sub || req.user?.userId;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || '0.0.0.0';
    const deleted = await this.service.remove(id, userId, ip);
    if (!deleted) throw new NotFoundException('المرفق غير موجود');
    return { success: true };
  }
}
