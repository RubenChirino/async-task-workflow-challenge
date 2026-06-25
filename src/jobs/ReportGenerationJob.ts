import { In, LessThan } from 'typeorm';
import { Task } from '../models/Task';
import { Result } from '../models/Result';
import { AppDataSource } from '../data-source';
import { Job } from './Job';
import { buildWorkflowReport, WorkflowReport } from '../models/WorkflowReport';

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

        const report = buildWorkflowReport(task.workflow.workflowId, precedingTasks, results);

        console.log(`Report generation for task ${task.taskId} completed successfully.`);
        return report;
    }
}
