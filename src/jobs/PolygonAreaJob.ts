import { Job } from './Job';
import { Task } from '../models/Task';
import area from '@turf/area';
import { Feature, Polygon } from 'geojson';

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<number> {
        console.log(`Running polygon area calculation for task ${task.taskId}...`);

        let inputGeometry: Feature<Polygon>;
        try {
            inputGeometry = JSON.parse(task.geoJson);
        } catch {
            throw new Error('Invalid GeoJSON: unable to parse task input.');
        }

        const polygonArea = area(inputGeometry);
        console.log(`The polygon area for task ${task.taskId} is ${polygonArea} square meters.`);
        return polygonArea;
    }
}
