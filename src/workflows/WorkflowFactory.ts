import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DataSource } from 'typeorm';
import { Workflow, WorkflowStatus } from '../models/Workflow';
import { Task, TaskStatus } from '../models/Task';
import { isValidTaskType } from '../jobs/JobFactory';

interface WorkflowStep {
    taskType: string;
    stepNumber: number;
    dependsOn?: number;
}

interface WorkflowDefinition {
    name: string;
    steps: WorkflowStep[];
}

export class WorkflowFactory {
    constructor(private dataSource: DataSource) { }

    /**
     * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
     * @param filePath - Path to the YAML file.
     * @param clientId - Client identifier for the workflow.
     * @param geoJson - The geoJson data string for tasks (customize as needed).
     * @returns A promise that resolves to the created Workflow.
     */
    async createWorkflowFromYAML(filePath: string, clientId: string, geoJson: string): Promise<Workflow> {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const workflowDef = yaml.load(fileContent) as WorkflowDefinition;
        const workflowRepository = this.dataSource.getRepository(Workflow);
        const taskRepository = this.dataSource.getRepository(Task);

        const workflow = new Workflow();
        workflow.clientId = clientId;
        workflow.status = WorkflowStatus.Initial;
        const savedWorkflow = await workflowRepository.save(workflow);

        try {
            this.validateSteps(workflowDef?.steps);
        } catch (error) {
            savedWorkflow.status = WorkflowStatus.Failed;
            savedWorkflow.finalResult = JSON.stringify({ error: (error as Error).message });
            await workflowRepository.save(savedWorkflow);
            throw error;
        }

        const tasks: Task[] = workflowDef.steps.map(step => {
            const task = new Task();
            task.clientId = clientId;
            task.geoJson = geoJson;
            task.status = TaskStatus.Queued;
            task.taskType = step.taskType;
            task.stepNumber = step.stepNumber;
            task.workflow = savedWorkflow;
            return task;
        });

        const taskByStepNumber = new Map(tasks.map((task): [number, Task] => [task.stepNumber, task]));
        for (const step of workflowDef.steps) {
            if (step.dependsOn !== undefined) {
                const currentTask = taskByStepNumber.get(step.stepNumber);
                const dependencyTask = taskByStepNumber.get(step.dependsOn);
                if (currentTask && dependencyTask) {
                    currentTask.dependency = dependencyTask;
                }
            }
        }

        await taskRepository.save(tasks);

        return savedWorkflow;
    }

    private validateSteps(steps?: WorkflowStep[]): void {
        if (!steps?.length) {
            throw new Error('Workflow definition must contain at least one step.');
        }

        const stepNumbers = new Set(steps.map(step => step.stepNumber));

        for (const step of steps) {
            if (!isValidTaskType(step.taskType)) {
                throw new Error(`Unknown taskType "${step.taskType}" in workflow definition.`);
            }

            if (step.dependsOn !== undefined) {
                if (!stepNumbers.has(step.dependsOn)) {
                    throw new Error(`Step ${step.stepNumber} depends on unknown step ${step.dependsOn}.`);
                }
                if (step.dependsOn >= step.stepNumber) {
                    throw new Error(`Step ${step.stepNumber} cannot depend on step ${step.dependsOn}: a dependency must have a lower stepNumber.`);
                }
            }
        }
    }
}
