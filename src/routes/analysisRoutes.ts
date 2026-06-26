import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { WorkflowFactory } from '../workflows/WorkflowFactory';
import { HttpStatus } from '../utils/httpStatus';
import path from 'path';

const router = Router();
const workflowFactory = new WorkflowFactory(AppDataSource);

router.post('/', async (req, res) => {
    const { clientId, geoJson } = req.body;

    if (!clientId || !geoJson) {
        res.status(HttpStatus.BadRequest).json({ message: 'clientId and geoJson are required.' });
        return;
    }

    const workflowFile = path.join(__dirname, '../workflows/example_workflow.yml');

    try {
        const workflow = await workflowFactory.createWorkflowFromYAML(
            workflowFile,
            clientId,
            JSON.stringify(geoJson),
        );

        res.status(HttpStatus.Accepted).json({
            workflowId: workflow.workflowId,
            message: 'Workflow created and tasks queued from YAML definition.',
        });
    } catch (error: any) {
        console.error('Error creating workflow:', error);
        res.status(HttpStatus.InternalServerError).json({ message: 'Failed to create workflow' });
    }
});

export default router;
