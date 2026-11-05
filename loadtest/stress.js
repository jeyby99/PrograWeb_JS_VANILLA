// Stress test: keeps adding users WITHOUT pauses until the system breaks.
// It is EXPECTED to fail: the goal is to find the breaking point, i.e. the stage where
// latency explodes and the gateway starts answering 5xx (504 = the 5 s response timeout).
// The thresholds mark where the system stops being acceptable; the test is not aborted,
// so the report shows the whole collapse.
import { getEntidades, distributionThresholds } from './lib/common.js';

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 400 },
        { duration: '30s', target: 600 },
        { duration: '30s', target: 0 },    // recovery: does it come back?
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],        // over 5% errors = broken
    http_req_duration: ['p(95)<2000'],     // p95 over 2 s = unusable
    ...distributionThresholds,
  },
};

export default function () {
  getEntidades();   // no sleep: every user hammers the gateway
}
