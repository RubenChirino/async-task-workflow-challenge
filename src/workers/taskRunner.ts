import { In, Repository } from 'typeorm';
import { Task, TaskStatus } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import { Workflow, WorkflowStatus } from '../models/Workflow';
import { Result } from '../models/Result';
import { buildWorkflowReport } from '../models/WorkflowReport';

export class TaskRunner {
    constructor(private taskRepository: Repository<Task>) {}

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);

        const resultRepository = this.taskRepository.manager.getRepository(Result);

        try {
            console.log(`Starting job ${task.taskType} for task ${task.taskId}...`);

            const job = getJobForTaskType(task.taskType);

            let dependencyResult: Result | null = null;
            if (task.dependency) {
                dependencyResult = await resultRepository.findOne({
                    where: { taskId: task.dependency.taskId },
                });
            }

            const taskOutput = await job.run(task, dependencyResult);
            console.log(`Job ${task.taskType} for task ${task.taskId} completed successfully.`);

            const result = new Result();
            result.taskId = task.taskId!;
            result.data = JSON.stringify(taskOutput ?? {});
            await resultRepository.save(result);

            task.resultId = result.resultId!;
            task.status = TaskStatus.Completed;
            task.progress = null;
            await this.taskRepository.save(task);
        } catch (error: any) {
            console.error(`Error running job ${task.taskType} for task ${task.taskId}:`, error);

            task.status = TaskStatus.Failed;
            task.progress = null;
            await this.taskRepository.save(task);
            await this.failDependentTasks(task);

            throw error;
        } finally {
            await this.updateWorkflowStatus(task.workflow.workflowId);
        }
    }

    private async failDependentTasks(failedTask: Task): Promise<void> {
        const dependentTasks = await this.taskRepository.find({
            where: { dependency: { taskId: failedTask.taskId } },
        });

        for (const dependentTask of dependentTasks) {
            if (
                dependentTask.status === TaskStatus.Queued ||
                dependentTask.status === TaskStatus.InProgress
            ) {
                dependentTask.status = TaskStatus.Failed;
                dependentTask.progress = null;
                await this.taskRepository.save(dependentTask);
                await this.failDependentTasks(dependentTask);
            }
        }
    }

    private async updateWorkflowStatus(workflowId: string): Promise<void> {
        const workflowRepository = this.taskRepository.manager.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId },
            relations: ['tasks'],
        });

        if (!workflow) {
            return;
        }

        const hasPendingTasks = workflow.tasks.some(
            (t) => t.status === TaskStatus.Queued || t.status === TaskStatus.InProgress,
        );
        const anyFailed = workflow.tasks.some((t) => t.status === TaskStatus.Failed);

        if (anyFailed) {
            workflow.status = WorkflowStatus.Failed;
        } else if (!hasPendingTasks) {
            workflow.status = WorkflowStatus.Completed;
        } else {
            workflow.status = WorkflowStatus.InProgress;
        }

        if (!hasPendingTasks) {
            workflow.finalResult = await this.buildFinalResult(workflow);
        }

        await workflowRepository.save(workflow);
    }

    private async buildFinalResult(workflow: Workflow): Promise<string> {
        const resultRepository = this.taskRepository.manager.getRepository(Result);
        const tasks = [...workflow.tasks].sort((a, b) => a.stepNumber - b.stepNumber);
        const taskIds = tasks.map((task) => task.taskId);
        const results = taskIds.length
            ? await resultRepository.find({ where: { taskId: In(taskIds) } })
            : [];

        const report = buildWorkflowReport(workflow.workflowId, tasks, results);
        return JSON.stringify(report);
    }
}
