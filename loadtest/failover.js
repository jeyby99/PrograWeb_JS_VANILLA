// Failover test: constant load for 2 minutes while ONE instance is stopped and started again.
//   ~0:30  stop an instance   (docker compose stop app2)
//   ~1:30  start it again     (docker compose start app2)
// Run it once with the good balancer and once with GATEWAY_PROFILE=bad-balancer and compare
// http_req_failed: good ~0%, bad ~1/3 of the requests while the instance is down.
// loadtest/failover-demo.sh does the stop/start automatically for a local run.
import { sleep } from 'k6';
import { getEntidades, distributionThresholds } from './lib/common.js';

export const options = {
  scenarios: {
    failover: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],        // the good balancer must hide the failure
    ...distributionThresholds,
  },
};

export default function () {
  getEntidades();
  sleep(0.3);
}
