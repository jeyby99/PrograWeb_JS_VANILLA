// Smoke test: 1 user for 30 s. Checks that everything answers before any heavier test.
import { sleep } from 'k6';
import { getEntidades, distributionThresholds } from './lib/common.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate==0'],          // no errors at all
    http_req_duration: ['p(95)<1000'],     // 95% of requests under 1 s
    ...distributionThresholds,
  },
};

export default function () {
  getEntidades();
  sleep(1);
}
