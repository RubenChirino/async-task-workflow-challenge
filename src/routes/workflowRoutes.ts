import { Router } from 'express';
import { Workflow, WorkflowStatus } from '../models/Workflow';
import { AppDataSource } from '../data-source';
import { HttpStatus } from '../utils/httpStatus';

const router = Router();

router.get('/:id/results', async (req, res) => {
    const { id: workflowId } = req.params;
    const workflowRepository = AppDataSource.getRepository(Workflow);

    try {
        const workflow = await workflowRepository.findOne({
            where: { workflowId },
        });

        if (!workflow) {
            res.status(HttpStatus.NotFound).json({ message: 'Workflow not found.' });
            return;
        }

        if (workflow.status !== WorkflowStatus.Completed) {
            res.status(HttpStatus.BadRequest).json({ message: 'Workflow is not completed yet.' });
            return;
        }

        res.status(HttpStatus.Ok).json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult: workflow.finalResult ? JSON.parse(workflow.finalResult) : null,
        });
    } catch (error) {
        console.error('Error getting workflow results:', error);
        res.status(HttpStatus.InternalServerError).json({ message: 'Failed to get workflow results' });
    }
});

export default router;
