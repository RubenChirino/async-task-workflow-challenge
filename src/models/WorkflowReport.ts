import { Task } from './Task';
import { Result } from './Result';
import { TaskStatus } from '../workers/taskRunner';

export interface TaskReportEntry {
    taskId: string;
    type: string;
    status: TaskStatus;
    output?: unknown;
    error?: string;
}

export interface WorkflowReport {
    workflowId: string;
    tasks: TaskReportEntry[];
    finalReport: string;
}

export function buildWorkflowReport(
    workflowId: string,
    tasks: Task[],
    results: Result[],
): WorkflowReport {
    const resultByTaskId = new Map(results.map((result): [string, Result] => [result.taskId, result]));

    const taskEntries: TaskReportEntry[] = tasks.map((task) => {
        if (task.status === TaskStatus.Failed) {
            return {
                taskId: task.taskId,
                type: task.taskType,
                status: task.status,
                error: 'Task failed during execution.',
            };
        }

        return {
            taskId: task.taskId,
            type: task.taskType,
            status: task.status,
            output: parseResultData(resultByTaskId.get(task.taskId)?.data),
        };
    });

    const failedCount = taskEntries.filter((entry) => entry.status === TaskStatus.Failed).length;

    return {
        workflowId,
        tasks: taskEntries,
        finalReport: failedCount > 0
            ? `Workflow completed with ${failedCount} failed task(s).`
            : 'Aggregated data and results',
    };
}

function parseResultData(data?: string | null): unknown {
    if (!data) {
        return null;
    }

    try {
        return JSON.parse(data);
    } catch {
        return data;
    }
}
