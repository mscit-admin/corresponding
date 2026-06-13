import { 
  Controller, Post, Get, Param, UploadedFile, UseInterceptors, 
  UseGuards, Req, Res, BadRequestException, NotFoundException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('نوع الملف غير مدعوم. المسموح: PDF, JPG, PNG, WEBP'), false);
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
    return this.service.save({
      correspondenceType: type,
      correspondenceId: id,
      file,
      userId: req.user.id || req.user.sub || req.user.userId,
    });
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'تحميل مرفق' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const attachment = await this.service.findById(id);
    if (!attachment) throw new NotFoundException('المرفق غير موجود');
    
    const filePath = join(UPLOADS_DIR, attachment.fileName);
    if (!existsSync(filePath)) throw new NotFoundException('الملف غير موجود على الخادم');
    
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    return res.sendFile(filePath);
  }
}
