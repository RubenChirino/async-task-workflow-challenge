import { In, LessThan } from 'typeorm';
import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { AppDataSource } from '../data-source';
import { TaskStatus } from '../workers/taskRunner';
import { Job } from './Job';

interface TaskReportEntry {
    taskId: string;
    type: string;
    status: TaskStatus;
    output?: unknown;
    error?: string;
}

interface WorkflowReport {
    workflowId: string;
    tasks: TaskReportEntry[];
    finalReport: string;
}

export class ReportGenerationJob implements Job {
    async run(task: Task): Promise<WorkflowReport> {
        console.log(`Running report generation for task ${task.taskId}...`);

        const taskRepository = AppDataSource.getRepository(Task);
        const resultRepository = AppDataSource.getRepository(Result);

        const precedingTasks = await taskRepository.find({
            where: {
                workflow: { workflowId: task.workflow.workflowId },
                stepNumber: LessThan(task.stepNumber),
            },
            order: { stepNumber: 'ASC' },
        });

        const taskIds = precedingTasks.map((precedingTask) => precedingTask.taskId);
        const results = taskIds.length
            ? await resultRepository.find({ where: { taskId: In(taskIds) } })
            : [];
        const resultByTaskId = new Map(results.map((result): [string, Result] => [result.taskId, result]));

        const tasks: TaskReportEntry[] = precedingTasks.map((t) => {
            if (t.status === TaskStatus.Failed) {
                return { taskId: t.taskId, type: t.taskType, status: t.status, error: 'Task failed during execution.' };
            }

            return {
                taskId: t.taskId,
                type: t.taskType,
                status: t.status,
                output: this.parseResultData(resultByTaskId.get(t.taskId)?.data),
            };
        });

        const failedCount = tasks.filter((t) => t.status === TaskStatus.Failed).length;
        const report: WorkflowReport = {
            workflowId: task.workflow.workflowId,
            tasks,
            finalReport: failedCount > 0
                ? `Workflow completed with ${failedCount} failed task(s).`
                : 'Aggregated data and results',
        };

        console.log(`Report generation for task ${task.taskId} completed successfully.`);
        return report;
    }

    private parseResultData(data?: string | null): unknown {
        if (!data) {
            return null;
        }

        try {
            return JSON.parse(data);
        } catch {
            return data;
        }
    }
}
