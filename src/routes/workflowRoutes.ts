import { Router } from 'express';
import { WorkflowService } from '../services/WorkflowService';
import { WorkflowNotFoundError, WorkflowNotCompletedError } from '../services/errors';
import { HttpStatus } from '../utils/httpStatus';

const router = Router();
const workflowService = new WorkflowService();

router.get('/:id/status', async (req, res) => {
    try {
        const workflowStatus = await workflowService.getWorkflowStatus(req.params.id);
        res.status(HttpStatus.Ok).json(workflowStatus);
    } catch (error) {
        if (error instanceof WorkflowNotFoundError) {
            res.status(HttpStatus.NotFound).json({ message: error.message });
            return;
        }

        console.error('Error getting workflow status:', error);
        res.status(HttpStatus.InternalServerError).json({ message: 'Failed to get workflow status' });
    }
});


router.get('/:id/results', async (req, res) => {
    try {
        const results = await workflowService.getWorkflowResults(req.params.id);
        res.status(HttpStatus.Ok).json(results);
    } catch (error) {
        if (error instanceof WorkflowNotFoundError) {
            res.status(HttpStatus.NotFound).json({ message: error.message });
            return;
        }
        if (error instanceof WorkflowNotCompletedError) {
            res.status(HttpStatus.BadRequest).json({ message: error.message });
            return;
        }
        console.error('Error getting workflow results:', error);
        res.status(HttpStatus.InternalServerError).json({ message: 'Failed to get workflow results' });
    }
});

export default router;
