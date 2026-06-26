import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity({ name: 'results' })
export class Result {
    @PrimaryGeneratedColumn('uuid')
    resultId!: string;

    @Index()
    @Column()
    taskId!: string;

    @Column('text')
    data!: string | null; // Could be JSON or any serialized format
}
