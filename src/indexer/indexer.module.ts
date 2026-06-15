import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenTransaction } from './entities/token-transaction.entity';
import { IndexerService } from './indexer.service';

@Module({
  imports: [TypeOrmModule.forFeature([TokenTransaction])],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
