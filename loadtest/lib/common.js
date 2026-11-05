// Shared helpers for the k6 load tests (SCRUM-28).
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

// Gateway URL: local compose (from the k6 container) or the EC2 Elastic IP
export const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:8080';

// Responses per backend instance (X-Served-By) and per balancer (X-Balancer)
export const servedBy = new Counter('served_by');

// A threshold per tag value makes k6 print the count of each one in the summary.
// "count>=0" always passes: these are only there to show the distribution.
export const distributionThresholds = {
  'served_by{instance:app1}': ['count>=0'],
  'served_by{instance:app2}': ['count>=0'],
  'served_by{instance:app3}': ['count>=0'],
  'served_by{instance:none}': ['count>=0'],   // error responses never reach an instance
};

// GET /api/entidades through the gateway, the endpoint every user of Page 1 hits
export function getEntidades() {
  const res = http.get(`${BASE_URL}/api/entidades`, {
    tags: { name: 'GET /api/entidades' },
    timeout: '10s',
  });
  servedBy.add(1, {
    instance: res.headers['X-Served-By'] || 'none',
    balancer: res.headers['X-Balancer'] || 'none',
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'went through the gateway': (r) => r.headers['X-Gateway'] === 'prograweb-gateway',
  });
  return res;
}
