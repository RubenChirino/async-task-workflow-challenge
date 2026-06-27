import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/data-source', () => ({ AppDataSource: {} }));

import { getJobForTaskType, isValidTaskType, taskTypes } from '../src/jobs/JobFactory';
import { DataAnalysisJob } from '../src/jobs/DataAnalysisJob';
import { EmailNotificationJob } from '../src/jobs/EmailNotificationJob';
import { PolygonAreaJob } from '../src/jobs/PolygonAreaJob';
import { ReportGenerationJob } from '../src/jobs/ReportGenerationJob';

describe('isValidTaskType', () => {
    it.each(taskTypes)('recognizes the registered task type "%s"', (taskType) => {
        expect(isValidTaskType(taskType)).toBe(true);
    });

    it.each(['', 'unknown', 'Analysis', 'polygon_area'])(
        'rejects the unknown task type "%s"',
        (taskType) => {
            expect(isValidTaskType(taskType)).toBe(false);
        },
    );
});

describe('getJobForTaskType', () => {
    it('returns the matching job instance for each registered type', () => {
        expect(getJobForTaskType('analysis')).toBeInstanceOf(DataAnalysisJob);
        expect(getJobForTaskType('notification')).toBeInstanceOf(EmailNotificationJob);
        expect(getJobForTaskType('polygonArea')).toBeInstanceOf(PolygonAreaJob);
        expect(getJobForTaskType('reportGeneration')).toBeInstanceOf(ReportGenerationJob);
    });

    it('returns a fresh instance on each call', () => {
        expect(getJobForTaskType('analysis')).not.toBe(getJobForTaskType('analysis'));
    });

    it('throws for an unknown task type', () => {
        expect(() => getJobForTaskType('does-not-exist')).toThrow(
            'No job found for task type: does-not-exist',
        );
    });
});
