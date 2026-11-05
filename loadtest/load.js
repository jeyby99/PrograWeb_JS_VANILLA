// Load test: the normal expected load. Ramps to 30 users, holds for 1 minute, ramps down.
// Pass criteria: under 1% errors and p95 under 800 ms, with traffic spread over the 3 instances.
import { sleep } from 'k6';
import { getEntidades, distributionThresholds } from './lib/common.js';

export const options = {
  stages: [
    { duration: '30s', target: 30 },   // ramp up
    { duration: '1m', target: 30 },    // steady load
    { duration: '15s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
    ...distributionThresholds,
  },
};

export default function () {
  getEntidades();
  sleep(0.5);   // each user sends about 2 requests per second
}
