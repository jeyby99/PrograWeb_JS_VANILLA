// Breakpoint test: like stress.js but up to 2,000 users, to find where the EC2 t3.micro
// really breaks. On the server stress.js (600 users) only slowed it down (p95 1.5 s,
// 0% errors); between 1,000 and 2,000 users p95 goes to ~7 s and requests time out.
// Expected to fail. Watch the recovery after the ramp-down.
import { getEntidades, distributionThresholds } from './lib/common.js';

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 600 },
        { duration: '30s', target: 1000 },
        { duration: '30s', target: 1500 },
        { duration: '30s', target: 2000 },
        { duration: '30s', target: 0 },    // recovery
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    ...distributionThresholds,
  },
};

export default function () {
  getEntidades();   // no sleep, like stress.js
}
