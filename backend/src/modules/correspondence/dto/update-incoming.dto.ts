import { PartialType } from '@nestjs/swagger';
import { CreateIncomingDto } from './create-incoming.dto';

// All fields optional for partial updates
export class UpdateIncomingDto extends PartialType(CreateIncomingDto) {}
