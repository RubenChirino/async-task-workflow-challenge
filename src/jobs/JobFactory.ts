import { Job } from './Job';
import { DataAnalysisJob } from './DataAnalysisJob';
import { EmailNotificationJob } from './EmailNotificationJob';
import { PolygonAreaJob } from './PolygonAreaJob';
import { ReportGenerationJob } from './ReportGenerationJob';

const jobMap = {
    'analysis': () => new DataAnalysisJob(),
    'notification': () => new EmailNotificationJob(),
    'polygonArea': () => new PolygonAreaJob(),
    'reportGeneration': () => new ReportGenerationJob(),
} satisfies Record<string, () => Job>;

export type TaskType = keyof typeof jobMap;

export function isValidTaskType(taskType: string): taskType is TaskType {
    return taskType in jobMap;
}

export function getJobForTaskType(taskType: string): Job {
    if (!isValidTaskType(taskType)) {
        throw new Error(`No job found for task type: ${taskType}`);
    }
    return jobMap[taskType]();
}