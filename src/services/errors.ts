export class WorkflowNotFoundError extends Error {
    constructor(workflowId: string) {
        super(`Workflow ${workflowId} not found.`);
        this.name = 'WorkflowNotFoundError';
    }
}

export class WorkflowNotCompletedError extends Error {
    constructor(workflowId: string) {
        super(`Workflow ${workflowId} is not completed yet.`);
        this.name = 'WorkflowNotCompletedError';
    }
}
