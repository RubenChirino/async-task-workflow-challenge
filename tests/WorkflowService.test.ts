import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/data-source', () => ({ AppDataSource: {} }));

import { WorkflowService } from '../src/services/WorkflowService';
import { Workflow, WorkflowStatus } from '../src/models/Workflow';
import { TaskStatus } from '../src/models/Task';
import { WorkflowNotFoundError, WorkflowNotCompletedError } from '../src/services/errors';

function createService() {
    const workflowRepository = { findOne: vi.fn() };
    const taskRepository = { count: vi.fn() };
    const dataSource = {
        getRepository: vi.fn((entity: unknown) =>
            entity === Workflow ? workflowRepository : taskRepository,
        ),
    };
    const service = new WorkflowService(dataSource as never);
    return { service, workflowRepository, taskRepository };
}

describe('WorkflowService.getWorkflowStatus', () => {
    let ctx: ReturnType<typeof createService>;

    beforeEach(() => {
        ctx = createService();
    });

    it('returns the workflow status with completed and total task counts', async () => {
        ctx.workflowRepository.findOne.mockResolvedValue({
            workflowId: 'wf-1',
            status: WorkflowStatus.InProgress,
        });
        ctx.taskRepository.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);

        const result = await ctx.service.getWorkflowStatus('wf-1');

        expect(result).toEqual({
            workflowId: 'wf-1',
            status: WorkflowStatus.InProgress,
            totalTasks: 5,
            completedTasks: 3,
        });
    });

    it('counts total and completed tasks with the correct filters', async () => {
        ctx.workflowRepository.findOne.mockResolvedValue({
            workflowId: 'wf-1',
            status: WorkflowStatus.InProgress,
        });
        ctx.taskRepository.count.mockResolvedValue(0);

        await ctx.service.getWorkflowStatus('wf-1');

        expect(ctx.taskRepository.count).toHaveBeenNthCalledWith(1, {
            where: { workflow: { workflowId: 'wf-1' } },
        });
        expect(ctx.taskRepository.count).toHaveBeenNthCalledWith(2, {
            where: { workflow: { workflowId: 'wf-1' }, status: TaskStatus.Completed },
        });
    });

    it('throws WorkflowNotFoundError when the workflow does not exist', async () => {
        ctx.workflowRepository.findOne.mockResolvedValue(null);

        await expect(ctx.service.getWorkflowStatus('missing')).rejects.toBeInstanceOf(
            WorkflowNotFoundError,
        );
    });

    it('does not count tasks when the workflow is missing', async () => {
        ctx.workflowRepository.findOne.mockResolvedValue(null);

        await expect(ctx.service.getWorkflowStatus('missing')).rejects.toThrow();
        expect(ctx.taskRepository.count).not.toHaveBeenCalled();
    });
});

describe('WorkflowService.getWorkflowResults', () => {
    let ctx: ReturnType<typeof createService>;

    beforeEach(() => {
        ctx = createService();
    });

    it('returns the parsed finalResult for a completed workflow', async () => {
        ctx.workflowRepository.findOne.mockResolvedValue({
            workflowId: 'wf-1',
            status: WorkflowStatus.Completed,
            finalResult: JSON.stringify({ finalReport: 'Aggregated data and results' }),
        });

        const result = await ctx.service.getWorkflowResults('wf-1');

        expect(result).toEqual({
            workflowId: 'wf-1',
            status: WorkflowStatus.Completed,
            finalResult: { finalReport: 'Aggregated data and results' },
        });
    });

    it('returns a null finalResult when none is stored', async () => {
        ctx.workflowRepository.findOne.mockResolvedValue({
            workflowId: 'wf-1',
            status: WorkflowStatus.Completed,
            finalResult: null,
        });

        const result = await ctx.service.getWorkflowResults('wf-1');

        expect(result.finalResult).toBeNull();
    });

    it('throws WorkflowNotFoundError when the workflow does not exist', async () => {
        ctx.workflowRepository.findOne.mockResolvedValue(null);

        await expect(ctx.service.getWorkflowResults('missing')).rejects.toBeInstanceOf(
            WorkflowNotFoundError,
        );
    });

    it('throws WorkflowNotCompletedError when the workflow is still in progress', async () => {
        ctx.workflowRepository.findOne.mockResolvedValue({
            workflowId: 'wf-1',
            status: WorkflowStatus.InProgress,
            finalResult: null,
        });

        await expect(ctx.service.getWorkflowResults('wf-1')).rejects.toBeInstanceOf(
            WorkflowNotCompletedError,
        );
    });

    it('throws WorkflowNotCompletedError for a failed workflow', async () => {
        ctx.workflowRepository.findOne.mockResolvedValue({
            workflowId: 'wf-1',
            status: WorkflowStatus.Failed,
            finalResult: JSON.stringify({ error: 'boom' }),
        });

        await expect(ctx.service.getWorkflowResults('wf-1')).rejects.toBeInstanceOf(
            WorkflowNotCompletedError,
        );
    });
});
