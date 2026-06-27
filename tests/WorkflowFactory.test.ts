import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/data-source', () => ({ AppDataSource: {} }));

import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WorkflowFactory } from '../src/workflows/WorkflowFactory';
import { Workflow, WorkflowStatus } from '../src/models/Workflow';
import { Task } from '../src/models/Task';

const tempDirs: string[] = [];

function yamlFile(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'workflow-factory-'));
    tempDirs.push(dir);
    const file = join(dir, 'workflow.yml');
    writeFileSync(file, content);
    return file;
}

function createFactory() {
    const workflowRepository = { save: vi.fn((workflow) => Promise.resolve(workflow)) };
    const taskRepository = { save: vi.fn((tasks) => Promise.resolve(tasks)) };
    const dataSource = {
        getRepository: (entity: unknown) =>
            entity === Workflow ? workflowRepository : taskRepository,
    };
    const factory = new WorkflowFactory(dataSource as never);
    return { factory, workflowRepository, taskRepository };
}

afterEach(() => {
    while (tempDirs.length) {
        rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
});

describe('WorkflowFactory validation', () => {
    let ctx: ReturnType<typeof createFactory>;

    beforeEach(() => {
        ctx = createFactory();
    });

    it('throws when the definition has no steps key', async () => {
        const file = yamlFile('name: "broken"\n');

        await expect(ctx.factory.createWorkflowFromYAML(file, 'client-1', 'geo')).rejects.toThrow(
            'must contain at least one step',
        );
    });

    it('throws when the steps list is empty', async () => {
        const file = yamlFile('name: "broken"\nsteps: []\n');

        await expect(ctx.factory.createWorkflowFromYAML(file, 'client-1', 'geo')).rejects.toThrow(
            'must contain at least one step',
        );
    });

    it('throws for an unknown taskType', async () => {
        const file = yamlFile('name: "x"\nsteps:\n  - taskType: "ghost"\n    stepNumber: 1\n');

        await expect(ctx.factory.createWorkflowFromYAML(file, 'client-1', 'geo')).rejects.toThrow(
            'Unknown taskType "ghost"',
        );
    });

    it('throws when a step depends on an unknown step', async () => {
        const file = yamlFile(
            'name: "x"\nsteps:\n  - taskType: "analysis"\n    stepNumber: 1\n  - taskType: "polygonArea"\n    stepNumber: 2\n    dependsOn: 9\n',
        );

        await expect(ctx.factory.createWorkflowFromYAML(file, 'client-1', 'geo')).rejects.toThrow(
            'depends on unknown step 9',
        );
    });

    it('throws on a forward dependency', async () => {
        const file = yamlFile(
            'name: "x"\nsteps:\n  - taskType: "analysis"\n    stepNumber: 1\n    dependsOn: 2\n  - taskType: "polygonArea"\n    stepNumber: 2\n',
        );

        await expect(ctx.factory.createWorkflowFromYAML(file, 'client-1', 'geo')).rejects.toThrow(
            'must have a lower stepNumber',
        );
    });

    it('throws on a self dependency', async () => {
        const file = yamlFile(
            'name: "x"\nsteps:\n  - taskType: "analysis"\n    stepNumber: 1\n    dependsOn: 1\n',
        );

        await expect(ctx.factory.createWorkflowFromYAML(file, 'client-1', 'geo')).rejects.toThrow(
            'must have a lower stepNumber',
        );
    });

    it('persists the workflow as failed when validation fails', async () => {
        const file = yamlFile('name: "x"\nsteps:\n  - taskType: "ghost"\n    stepNumber: 1\n');

        await expect(ctx.factory.createWorkflowFromYAML(file, 'client-1', 'geo')).rejects.toThrow();

        expect(ctx.workflowRepository.save).toHaveBeenCalledTimes(2);
        const failedWorkflow = ctx.workflowRepository.save.mock.calls[1][0];
        expect(failedWorkflow.status).toBe(WorkflowStatus.Failed);
        expect(JSON.parse(failedWorkflow.finalResult).error).toContain('Unknown taskType');
        expect(ctx.taskRepository.save).not.toHaveBeenCalled();
    });
});

describe('WorkflowFactory dependency wiring', () => {
    let ctx: ReturnType<typeof createFactory>;

    beforeEach(() => {
        ctx = createFactory();
    });

    it('links each task to the task referenced by its dependsOn', async () => {
        const file = yamlFile(
            'name: "x"\nsteps:\n  - taskType: "analysis"\n    stepNumber: 1\n  - taskType: "polygonArea"\n    stepNumber: 2\n    dependsOn: 1\n  - taskType: "reportGeneration"\n    stepNumber: 3\n    dependsOn: 2\n',
        );

        await ctx.factory.createWorkflowFromYAML(file, 'client-1', 'geo');

        const savedTasks: Task[] = ctx.taskRepository.save.mock.calls[0][0];
        const byStep = new Map(savedTasks.map((task) => [task.stepNumber, task]));

        expect(byStep.get(1)!.dependency).toBeUndefined();
        expect(byStep.get(2)!.dependency).toBe(byStep.get(1));
        expect(byStep.get(3)!.dependency).toBe(byStep.get(2));
    });

    it('assigns the workflow and queued status to every created task', async () => {
        const file = yamlFile(
            'name: "x"\nsteps:\n  - taskType: "analysis"\n    stepNumber: 1\n  - taskType: "notification"\n    stepNumber: 2\n    dependsOn: 1\n',
        );

        const workflow = await ctx.factory.createWorkflowFromYAML(file, 'client-1', 'geo');
        const savedTasks: Task[] = ctx.taskRepository.save.mock.calls[0][0];

        expect(savedTasks).toHaveLength(2);
        for (const task of savedTasks) {
            expect(task.workflow).toBe(workflow);
            expect(task.clientId).toBe('client-1');
            expect(task.status).toBe('queued');
        }
    });
});
