# Test the DynamoDB login/photo valuation flow

Configured locally: existing table `bartr-dev`, region `us-east-1`, string `PK` and `SK`, AWS profile `bartr-dev`. Synthetic scoped live read/write and trade tests passed; existing MongoDB and legacy aggregate records are not automatically migrated. See [verification status](VERIFICATION.md).

## 1. Start the backend yourself

From the repository root, in terminal 1:

```sh
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

If already in `backend/`, activate `../.venv/bin/activate` and use `python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.

Root `.env` is loaded automatically. Explicit shell environment variables take precedence, so clear an old exported `BARTR_STORAGE=memory` or conflicting `AWS_PROFILE` before starting. Keep terminal 1 open. The frontend is not needed.

For the browser flow, start the frontend in another terminal with Node 20.19 or newer: `cd frontend && npm run dev`. Open `http://localhost:3000`, register or sign in, save a draft, upload a photo, and select **Analyze photo & value**. Review the estimate and uncertainty, select **Use this estimate**, then save the listing. You can correct the amount instead; a corrected value is recorded as owner-entered. Disable `NEXT_PUBLIC_USE_SEED_DATA` so actions reach the backend. Gemini model access and image valuation have not yet been verified live.

For trade chat, restart both servers after installing the current `requirements.txt`, disable seed mode, and sign in with two different accounts in separate browser profiles. Create a trade and open it in both profiles. The conversation should show **Live**, and a sent message should appear in the other profile within a few seconds. A disconnect changes the status to **Reconnecting**; reopening recovers saved messages. For a different frontend origin, add it exactly to `WEB_ORIGINS`; any hosting proxy must support WebSocket upgrades. Local proxy verification uses temporary memory storage and does not validate your deployed setup.

The following commands go in terminal 2. They create real test records in the existing DynamoDB table and send one image to Gemini, consuming normal API quota. The credentials below are public sample credentials for testing only; do not reuse the password elsewhere. If the username is taken, change its number in both commands. The cookie file contains a session credential; do not share or commit it.

## 2. Register (automatically signs in)

```sh
curl -i -c /tmp/bartr-test-cookies.txt \
  -H 'X-Bartr-Request: 1' -H 'Content-Type: application/json' \
  -d '{"username":"bartr_tester_01","password":"Cedar-Monitor-4827!","name":"Taylor Morgan","community":"ASU Tempe"}' \
  http://127.0.0.1:8000/api/auth/register
```

Expected: 200 and a profile, plus an HTTP-only cookie. Passwords must have at least 10 characters. If this username exists, sign in instead:

```sh
curl -i -c /tmp/bartr-test-cookies.txt \
  -H 'X-Bartr-Request: 1' -H 'Content-Type: application/json' \
  -d '{"username":"bartr_tester_01","password":"Cedar-Monitor-4827!"}' \
  http://127.0.0.1:8000/api/auth/login
```

```sh
curl -b /tmp/bartr-test-cookies.txt http://127.0.0.1:8000/api/profile
```

## 3. Save a draft

```sh
curl -b /tmp/bartr-test-cookies.txt \
  -H 'X-Bartr-Request: 1' -H 'Content-Type: application/json' \
  -d '{"title":"Cat plushie","description":"Plush toy with tags","category":"Toys","condition":"New with tags","value_minor":null,"status":"draft"}' \
  http://127.0.0.1:8000/api/items
```

Copy the returned `id`. Replace `ITEM_ID` below with that actual ID, and use each response's current `revision` rather than assuming its value on retries.

## 4. Upload your photo

Replace the file path with an existing photo on your Mac:

```sh
curl -b /tmp/bartr-test-cookies.txt \
  -H 'X-Bartr-Request: 1' \
  -F 'file=@/absolute/path/to/your/photo.jpeg' \
  'http://127.0.0.1:8000/api/items/ITEM_ID/image?expected_revision=1'
```

Expected: listing revision 2 and an `image_id`. Supported phone formats include JPEG and HEIC. Originals are normalized to JPEG. A normalized photo over 3 MiB is explicitly rejected by this bounded DynamoDB adapter.

## 5. Request image valuation

```sh
curl -b /tmp/bartr-test-cookies.txt \
  -H 'X-Bartr-Request: 1' -H 'Content-Type: application/json' \
  -d '{"expected_revision":2}' \
  http://127.0.0.1:8000/api/items/ITEM_ID/analysis
```

Expected: saved `analysis_id`, image-derived suggestions, `estimate_minor` in USD cents or null, uncertainty/reasons, and any clarification questions. This is an advisory image estimate, not Google Search market comparison. Failure or unknown value must not silently publish or assign a price. Analysis is saved without automatic expiry for that exact revision.

## 6. Review the estimate and publish

Replace `ANALYSIS_ID` with the returned ID, and `4000` with the actual estimate you reviewed (the number here is illustrative, not a prescribed valuation). Use the exact estimate to record `value_source=assisted`; a corrected amount records `value_source=owner`. If the estimate is null or clarification is needed, correct the draft or supply a manual value instead; do not manufacture an assisted value.

```sh
curl -X PATCH -b /tmp/bartr-test-cookies.txt \
  -H 'X-Bartr-Request: 1' -H 'Content-Type: application/json' \
  -d '{"expected_revision":2,"title":"Cat plushie","description":"Plush toy with tags","category":"Toys","condition":"New with tags","value_minor":4000,"analysis_id":"ANALYSIS_ID","status":"available"}' \
  http://127.0.0.1:8000/api/items/ITEM_ID
```

```sh
curl -b /tmp/bartr-test-cookies.txt http://127.0.0.1:8000/api/items/ITEM_ID
curl -b /tmp/bartr-test-cookies.txt http://127.0.0.1:8000/api/items
```

Expected: published listing, image ID, selected comparison value, source, last-set date, and assisted uncertainty where applicable. Other members do not receive the private unreviewed analysis.

## Errors to report

- 503 `DYNAMODB_UNAVAILABLE`: region/profile/permissions/table availability; DescribeTable, GetItem, PutItem and TransactWriteItems are required. A successful health endpoint alone does not validate storage.
- 503 `INVALID_TABLE_SCHEMA`: configured string key names do not match the existing table.
- 401: cookie missing/expired; sign in and reuse the cookie jar on the same host.
- 403: missing `X-Bartr-Request: 1`, disallowed Origin, or another owner's record.
- 409: stale revision/analysis; reload the current listing and use its revision.
- 503 `ANALYSIS_UNAVAILABLE`: model access/key/quota/provider failure. Manual draft entry is still available.

Send the HTTP error code/body and sanitized server log if anything fails. Do not share the Gemini key, AWS credentials, passwords or cookie file.
