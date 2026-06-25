import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { AppDataSource } from '../data-source';
import { TaskStatus } from '../workers/taskRunner';
import { Job } from './Job';

export class ReportGenerationJob implements Job {
    async run(task: Task): Promise<Record<string, any>> {
        console.log(`Running report generation for task ${task.taskId}...`);

        const taskRepository = AppDataSource.getRepository(Task);
        const completedTasks = await taskRepository.find({
            where: { workflow: { workflowId: task.workflow.workflowId }, status: TaskStatus.Completed }
        })

        const outputReportByTask: Record<string, any> = {};
        const resultRepository = AppDataSource.getRepository(Result);

        if (completedTasks.length === 0) {
            console.log(`No completed tasks found for workflow ${task.workflow.workflowId}.`);
            return outputReportByTask;
        }

        await Promise.all(
            completedTasks.map(async (t) => {
                const taskResult = await resultRepository.findOne({ where: { taskId: t.taskId } });
                outputReportByTask[t.taskId] = taskResult?.data;
            })
        );

        console.log(`The report generation was successfully completed`);

        return outputReportByTask;
    }
}
