import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'https://medconnectserver.nnmc.kz').replace(/\/$/, '');
const TARGET_VUS = Number(__ENV.TARGET_VUS || 25);
const RAMP_UP = __ENV.RAMP_UP || '2m';
const HOLD = __ENV.HOLD || '5m';
const RAMP_DOWN = __ENV.RAMP_DOWN || '1m';

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

export const options = {
  stages: [
    { duration: RAMP_UP, target: TARGET_VUS },
    { duration: HOLD, target: TARGET_VUS },
    { duration: RAMP_DOWN, target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  },
};

const endpoints = [
  '/api/specializations?pagination[pageSize]=20',
  '/api/doctors?pagination[pageSize]=20&populate=specialization',
  '/api/time-slots?pagination[pageSize]=20',
  '/api/articles?pagination[pageSize]=10',
  '/api/global',
];

export default function () {
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'medconnect-loadtest/k6-readonly',
    },
    tags: { endpoint },
  });

  check(res, {
    'status is not 5xx': (r) => r.status < 500,
    'status is expected': (r) => [200, 304, 401, 403, 404].includes(r.status),
  });

  sleep(Math.random() * 2 + 1);
}
