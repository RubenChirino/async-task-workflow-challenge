import { AppDataSource } from '../data-source';
import { Task, TaskStatus } from '../models/Task';
import { TaskRunner } from './taskRunner';

const POLL_INTERVAL_MS = 5000;

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        try {
            const tasks = await taskRepository.find({
                where: { status: TaskStatus.Queued },
                relations: ['workflow', 'dependency'],
                order: { stepNumber: 'ASC' },
            });
            const task = tasks.find((t) => !t.dependency || t.dependency.status === TaskStatus.Completed);

            if (task) {
                await taskRunner.run(task);
            }
        } catch (error) {
            console.error('Worker iteration failed; will retry on next poll.', error);
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}