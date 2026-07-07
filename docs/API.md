# Print Agent — Local Management API

The Print Agent exposes a **local-only** HTTP API for managing printers, print jobs,
configuration, logs, and the print queue on the machine it runs on. It is not a cloud
service — it never accepts remote printing requests, and by default it rejects any
request that doesn't originate from `127.0.0.1` / `::1`.

- Base URL: `http://127.0.0.1:3210/api/v1`
- Interactive docs (Swagger UI): `http://127.0.0.1:3210/docs`
- Raw OpenAPI document: `http://127.0.0.1:3210/docs/json`

## Response envelope

Every response is one of two shapes:

```json
{ "success": true, "message": "Job created", "data": { "...": "..." } }
```

```json
{ "success": false, "message": "Printer not found", "errors": ["Printer not found"] }
```

Validation failures populate `errors` with one entry per invalid field.

## Security

| Control | Default | Config key |
|---|---|---|
| Localhost-only | on | `allowRemote` (set `true` to allow LAN access) |
| API key auth | off | `requireApiKey` |
| CORS origins | `http://localhost`, `http://127.0.0.1` | `corsOrigins` |
| Rate limit | 120 requests / 60s per IP | `rateLimitMax`, `rateLimitWindowMs` |

When `requireApiKey` is enabled, every request must include the headers obtained from
`POST /applications`:

```
X-Api-Key: pk_...
X-Api-Secret: sk_...
```

The secret is only ever shown once, at registration time — the agent stores just its hash.

## Endpoint summary

| Area | Endpoints |
|---|---|
| Health | `GET /health`, `GET /`, `GET /status`, `GET /version` |
| Metrics | `GET /metrics` |
| Queue | `GET /queue`, `GET /queue/status`, `POST /queue/pause`, `POST /queue/resume`, `POST /queue/clear` |
| Printers | `GET/POST /printers`, `GET/PUT/DELETE /printers/:id`, `POST /printers/:id/test`, `GET /printers/:id/status`, `GET\|POST /printers/discover`, `PUT /printers/:id/default`, `PUT /printers/:id/enable`, `PUT /printers/:id/disable` |
| Jobs | `POST/GET /jobs`, `GET/DELETE /jobs/:id`, `POST /jobs/:id/retry`, `POST /jobs/:id/cancel`, `GET /jobs/:id/events`, `DELETE /jobs/completed`, `GET /jobs/pending`, `GET /jobs/failed`, `GET /jobs/history` |
| Config | `GET/PUT /config`, `POST /config/reset` |
| Logs | `GET /logs`, `GET /logs/latest`, `GET /logs/errors`, `DELETE /logs` |
| Applications | `POST/GET /applications`, `GET/DELETE /applications/:id`, `PUT /applications/:id/enable`, `PUT /applications/:id/disable` |

`GET /jobs` and its variants accept `page`, `pageSize`, `status`, `printerId`,
`applicationId`, `type`, `createdFrom`, `createdTo`, `sortBy` (`createdAt`|`priority`|`status`),
and `sortOrder` (`asc`|`desc`).

## Examples

### curl

```bash
# Register an application once, keep the returned apiSecret somewhere safe
curl -X POST http://127.0.0.1:3210/api/v1/applications \
  -H 'content-type: application/json' \
  -d '{"name": "My POS", "version": "1.0.0", "vendor": "Acme"}'

# Register a printer
curl -X POST http://127.0.0.1:3210/api/v1/printers \
  -H 'content-type: application/json' \
  -d '{"name": "Kitchen", "driver": "escpos-usb", "connectionType": "usb", "connection": {"vendorId": 1046, "productId": 8214}}'

# Submit a print job
curl -X POST http://127.0.0.1:3210/api/v1/jobs \
  -H 'content-type: application/json' \
  -d '{"printerId": "<printer-id>", "type": "receipt", "payload": "<document-json-or-path>"}'

# Poll job status
curl http://127.0.0.1:3210/api/v1/jobs/<job-id>

# Watch queue health
curl http://127.0.0.1:3210/api/v1/queue/status
```

### Node.js

```js
const BASE = 'http://127.0.0.1:3210/api/v1';

async function printReceipt(printerId, payload) {
  const res = await fetch(`${BASE}/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ printerId, type: 'receipt', payload }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.message);
  return body.data;
}

const job = await printReceipt('printer-id', JSON.stringify({ lines: ['Hello, world!'] }));
console.log('queued job', job.id);
```

### PHP

```php
<?php
$base = 'http://127.0.0.1:3210/api/v1';

function printAgentRequest(string $method, string $path, ?array $body = null): array {
    global $base;
    $ch = curl_init($base . $path);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

$job = printAgentRequest('POST', '/jobs', [
    'printerId' => 'printer-id',
    'type' => 'receipt',
    'payload' => json_encode(['lines' => ['Hello, world!']]),
]);

echo $job['data']['id'] . "\n";
```

### Flutter / Dart

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

const base = 'http://127.0.0.1:3210/api/v1';

Future<Map<String, dynamic>> printReceipt(String printerId, String payload) async {
  final response = await http.post(
    Uri.parse('$base/jobs'),
    headers: {'content-type': 'application/json'},
    body: jsonEncode({'printerId': printerId, 'type': 'receipt', 'payload': payload}),
  );
  final body = jsonDecode(response.body) as Map<String, dynamic>;
  if (body['success'] != true) {
    throw Exception(body['message']);
  }
  return body['data'] as Map<String, dynamic>;
}
```

## Architecture notes

- Controllers only translate HTTP ⇄ service calls; all business logic lives in services.
- Services never touch SQL directly — that's the repository layer's job.
- Every request body/query/params is validated by a Zod schema in a `preHandler`
  before it reaches a controller; controllers never validate manually.
- The queue and pipeline layers have no knowledge of HTTP, and drivers have no
  knowledge of the API — printing works the same whether triggered by the API,
  a future desktop UI, or an internal recovery pass on startup.
