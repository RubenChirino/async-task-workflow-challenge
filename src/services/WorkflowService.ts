import { DataSource, Repository } from 'typeorm';
import { Workflow, WorkflowStatus } from '../models/Workflow';
import { Task, TaskStatus } from '../models/Task';
import { AppDataSource } from '../data-source';
import { WorkflowNotFoundError, WorkflowNotCompletedError } from './errors';

export interface WorkflowStatusResponse {
    workflowId: string;
    status: WorkflowStatus;
    completedTasks: number;
    totalTasks: number;
}

export interface WorkflowResultsResponse {
    workflowId: string;
    status: WorkflowStatus;
    finalResult: unknown;
}

export class WorkflowService {
    private readonly workflowRepository: Repository<Workflow>;
    private readonly taskRepository: Repository<Task>;

    constructor(dataSource: DataSource = AppDataSource) {
        this.workflowRepository = dataSource.getRepository(Workflow);
        this.taskRepository = dataSource.getRepository(Task);
    }

    async getWorkflowStatus(workflowId: string): Promise<WorkflowStatusResponse> {
        const workflow = await this.getWorkflowByIdOrThrow(workflowId);

        const [totalTasks, completedTasks] = await Promise.all([
            this.taskRepository.count({ where: { workflow: { workflowId } } }),
            this.taskRepository.count({ where: { workflow: { workflowId }, status: TaskStatus.Completed } }),
        ]);

        return {
            workflowId: workflow.workflowId,
            status: workflow.status,
            totalTasks: totalTasks,
            completedTasks: completedTasks
        };
    }

    async getWorkflowResults(workflowId: string): Promise<WorkflowResultsResponse> {
        const workflow = await this.getWorkflowByIdOrThrow(workflowId);

        if (workflow.status !== WorkflowStatus.Completed) {
            throw new WorkflowNotCompletedError(workflowId);
        }

        return {
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult: workflow.finalResult ? JSON.parse(workflow.finalResult) : null,
        };
    }

    private async getWorkflowByIdOrThrow(workflowId: string): Promise<Workflow> {
        const workflow = await this.workflowRepository.findOne({
            where: { workflowId },
        });

        if (!workflow) {
            throw new WorkflowNotFoundError(workflowId);
        }

        return workflow;
    }
}
