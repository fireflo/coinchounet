import { randomUUID } from 'node:crypto';

export const createCorrelationId = () => randomUUID();
