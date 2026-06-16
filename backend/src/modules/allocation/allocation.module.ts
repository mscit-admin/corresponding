import { Module } from '@nestjs/common';
import { AllocationService } from './allocation.service';
import { AllocationController } from './allocation.controller';
import { MinutesController } from './minutes.controller';

@Module({
  controllers: [AllocationController, MinutesController],
  providers: [AllocationService],
  exports: [AllocationService],
})
export class AllocationModule {}
