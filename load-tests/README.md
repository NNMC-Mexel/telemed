# Production load tests

These tests are intentionally conservative:

- `api-readonly.k6.js` hits read-only Strapi endpoints.
- `socketio-slot-watchers.artillery.yml` opens Socket.IO connections and subscribes to slot updates.
- Payment endpoints, booking creation, refunds, uploads, and admin writes are not tested here.

Run production tests only during an approved window, with database backups and server monitoring open.

## API capacity with k6

Install:

```bash
brew install k6
```

Baseline:

```bash
BASE_URL=https://medconnectserver.nnmc.kz TARGET_VUS=25 HOLD=5m k6 run load-tests/api-readonly.k6.js
```

Step test:

```bash
BASE_URL=https://medconnectserver.nnmc.kz TARGET_VUS=50 HOLD=10m k6 run load-tests/api-readonly.k6.js
BASE_URL=https://medconnectserver.nnmc.kz TARGET_VUS=100 HOLD=10m k6 run load-tests/api-readonly.k6.js
BASE_URL=https://medconnectserver.nnmc.kz TARGET_VUS=200 HOLD=10m k6 run load-tests/api-readonly.k6.js
```

Stop increasing when one of these happens:

- p95 latency is above 1000 ms for normal API reads.
- HTTP 5xx appears repeatedly.
- PostgreSQL CPU/IO stays saturated.
- Node memory keeps growing after traffic drops.

## Socket.IO signaling capacity with Artillery

Install:

```bash
npm install -g artillery
```

Edit `load-tests/slot-watchers.sample.csv` and replace `doctorId` with a real doctor id from production.

Run:

```bash
SIGNALING_URL=https://medconnectrtc.nnmc.kz artillery run --target "$SIGNALING_URL" load-tests/socketio-slot-watchers.artillery.yml
```

Increase the `arrivalRate`, `rampTo`, and `think` values in the YAML to raise concurrent connections.

## How to interpret "max users"

Do not treat virtual users as registered users. The useful number is the last stable step where:

- p95 latency stays within the target.
- error rate stays below 1%.
- CPU, memory, PostgreSQL connections, and network are not pinned.
- the app recovers after the test ends.

For video calls, measure separately:

- concurrent call rooms on signaling-server;
- TURN relay bandwidth and CPU;
- client browser/mobile CPU.

If calls go peer-to-peer, the backend mainly handles signaling. If calls relay through TURN, the TURN server and network bandwidth become the main limit.
