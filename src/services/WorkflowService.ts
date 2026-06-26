import { DataSource, Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Workflow, WorkflowStatus } from '../models/Workflow';
import { WorkflowNotFoundError, WorkflowNotCompletedError } from './errors';

export interface WorkflowResults {
    workflowId: string;
    status: WorkflowStatus;
    finalResult: unknown;
}

export class WorkflowService {
    private readonly workflowRepository: Repository<Workflow>;

    constructor(dataSource: DataSource = AppDataSource) {
        this.workflowRepository = dataSource.getRepository(Workflow);
    }

    async getWorkflowResults(workflowId: string): Promise<WorkflowResults> {
        const workflow = await this.workflowRepository.findOne({
            where: { workflowId },
        });

        if (!workflow) {
            throw new WorkflowNotFoundError(workflowId);
        }

        if (workflow.status !== WorkflowStatus.Completed) {
            throw new WorkflowNotCompletedError(workflowId);
        }

        return {
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult: workflow.finalResult ? JSON.parse(workflow.finalResult) : null,
        };
    }
}
