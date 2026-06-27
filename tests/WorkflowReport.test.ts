import { describe, it, expect } from 'vitest';
import { buildWorkflowReport } from '../src/models/WorkflowReport';
import { Task, TaskStatus } from '../src/models/Task';
import { Result } from '../src/models/Result';

function makeTask(overrides: Partial<Task>): Task {
    return {
        taskId: 'task-id',
        clientId: 'client-1',
        geoJson: '',
        status: TaskStatus.Completed,
        taskType: 'analysis',
        stepNumber: 1,
        ...overrides,
    } as Task;
}

function makeResult(taskId: string, data: string | null): Result {
    return { resultId: `result-${taskId}`, taskId, data } as Result;
}

const WORKFLOW_ID = 'workflow-1';

describe('buildWorkflowReport', () => {
    it('aggregates completed tasks with their parsed outputs', () => {
        const tasks = [
            makeTask({ taskId: 't1', taskType: 'analysis', stepNumber: 1 }),
            makeTask({ taskId: 't2', taskType: 'polygonArea', stepNumber: 2 }),
        ];
        const results = [
            makeResult('t1', JSON.stringify('Brazil')),
            makeResult('t2', JSON.stringify(12345.6)),
        ];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, results);

        expect(report).toEqual({
            workflowId: WORKFLOW_ID,
            tasks: [
                { taskId: 't1', type: 'analysis', status: TaskStatus.Completed, output: 'Brazil' },
                {
                    taskId: 't2',
                    type: 'polygonArea',
                    status: TaskStatus.Completed,
                    output: 12345.6,
                },
            ],
            finalReport: 'Aggregated data and results',
        });
    });

    it('parses object outputs from result data', () => {
        const tasks = [makeTask({ taskId: 't1' })];
        const results = [makeResult('t1', JSON.stringify({ country: 'Brazil', area: 42 }))];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, results);

        expect(report.tasks[0].output).toEqual({ country: 'Brazil', area: 42 });
    });

    it('returns the raw string when result data is not valid JSON', () => {
        const tasks = [makeTask({ taskId: 't1' })];
        const results = [makeResult('t1', 'not-json{')];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, results);

        expect(report.tasks[0].output).toBe('not-json{');
    });

    it('returns a null output when a completed task has no matching result', () => {
        const tasks = [makeTask({ taskId: 't1' })];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, []);

        expect(report.tasks[0].output).toBeNull();
    });

    it('returns a null output when result data is null or empty', () => {
        const tasks = [makeTask({ taskId: 't1' }), makeTask({ taskId: 't2' })];
        const results = [makeResult('t1', null), makeResult('t2', '')];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, results);

        expect(report.tasks[0].output).toBeNull();
        expect(report.tasks[1].output).toBeNull();
    });

    it('marks failed tasks with an error and omits their output', () => {
        const tasks = [
            makeTask({ taskId: 't1', status: TaskStatus.Failed, taskType: 'polygonArea' }),
        ];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, []);

        expect(report.tasks[0]).toEqual({
            taskId: 't1',
            type: 'polygonArea',
            status: TaskStatus.Failed,
            error: 'Task failed during execution.',
        });
        expect(report.tasks[0]).not.toHaveProperty('output');
    });

    it('ignores any stored result for a failed task', () => {
        const tasks = [makeTask({ taskId: 't1', status: TaskStatus.Failed })];
        const results = [makeResult('t1', JSON.stringify('stale output'))];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, results);

        expect(report.tasks[0].error).toBe('Task failed during execution.');
        expect(report.tasks[0]).not.toHaveProperty('output');
    });

    it('summarizes a single failed task in the final report', () => {
        const tasks = [
            makeTask({ taskId: 't1', status: TaskStatus.Completed }),
            makeTask({ taskId: 't2', status: TaskStatus.Failed }),
        ];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, []);

        expect(report.finalReport).toBe('Workflow completed with 1 failed task(s).');
    });

    it('counts every failed task in the final report', () => {
        const tasks = [
            makeTask({ taskId: 't1', status: TaskStatus.Failed }),
            makeTask({ taskId: 't2', status: TaskStatus.Failed }),
            makeTask({ taskId: 't3', status: TaskStatus.Completed }),
        ];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, []);

        expect(report.finalReport).toBe('Workflow completed with 2 failed task(s).');
    });

    it('returns an empty report for a workflow with no tasks', () => {
        const report = buildWorkflowReport(WORKFLOW_ID, [], []);

        expect(report).toEqual({
            workflowId: WORKFLOW_ID,
            tasks: [],
            finalReport: 'Aggregated data and results',
        });
    });

    it('preserves the given task order', () => {
        const tasks = [
            makeTask({ taskId: 't3', stepNumber: 3 }),
            makeTask({ taskId: 't1', stepNumber: 1 }),
            makeTask({ taskId: 't2', stepNumber: 2 }),
        ];

        const report = buildWorkflowReport(WORKFLOW_ID, tasks, []);

        expect(report.tasks.map((t) => t.taskId)).toEqual(['t3', 't1', 't2']);
    });
});
