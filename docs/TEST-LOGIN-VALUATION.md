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

Root `.env` is loaded automatically. Explicit shell environment variables take precedence, so clear an old exported `BARTR_STORAGE=json` or `memory` and any conflicting `AWS_PROFILE` before starting. Local-only modes also require `BARTR_ALLOW_LOCAL_STORAGE=true`; do not enable it for shared accounts. Keep terminal 1 open. The frontend is not needed.

For frontend testing, start the frontend in another terminal with Node 20.19 or newer: `cd frontend && npm run dev`. Open `http://localhost:3000` and sign in with a test account before checking authenticated pages. Create the account first if necessary. Set `NEXT_PUBLIC_USE_SEED_DATA=false` in `frontend/.env.local` so actions reach the backend, then restart the frontend after changing it. For valuation, upload a photo, review the suggested details, choose the condition, and select **Estimate price**. Review the estimate, uncertainty, and sources before publishing; a successful current estimate is applied automatically. Live provider smoke tests do not establish price accuracy.

The Add item dialog uses **Estimate price** to search for comparable listings. The market-search model uses `GEMINI_VALUATION_MODEL` or falls back to `GEMINI_MODEL`; `GEMINI_EXTRACTION_MODEL` optionally selects the extraction model. If search fails or has insufficient evidence, the app requests an image-based AI estimate and labels it as having no comparable listings. This fallback uses `GEMINI_IMAGE_MODEL`, `GEMINI_VALUATION_MODEL`, or `GEMINI_MODEL` in that order. Each developer needs their own configured `GEMINI_API_KEY` and model access; restart the backend after changing settings. If both searches and image evaluation fail, the draft is preserved and the user can retry. Do not commit credentials.

The model is instructed to make a rough estimate without asking for optional details such as exact wattage or unconfirmed working order. If comparable search requests clarification, the image-based path tries an estimate; a genuinely unidentifiable item or a material conflict may still need clarification. Model behavior and estimate accuracy require live evaluation.

When the image model provides both a positive estimate and optional questions, the estimate remains usable unless the model flags a material conflict. If it provides no estimate for an identifiable item, the backend makes one additional image-model request; this can add latency and provider usage. An unavailable or null retry does not create a price.

For a faster local valuation, set both `GEMINI_VALUATION_MODEL` and `GEMINI_EXTRACTION_MODEL` to `gemini-3.5-flash-lite`. One synthetic-image smoke test was faster than `gemini-3.8-flash`, but it does not establish real-item accuracy or typical latency. The same source and evidence checks still apply. Model access and charges depend on the configured Google project.

For trade chat, restart both servers after installing the current `requirements.txt`, disable seed mode, and sign in with two different accounts in separate browser profiles. Create a trade and open it in both profiles. The conversation should show **Live**, and a sent message should appear in the other profile within a few seconds. A disconnect changes the status to **Reconnecting**; reopening recovers saved messages. For a different frontend origin, add it exactly to `WEB_ORIGINS`; any hosting proxy must support WebSocket upgrades. Local proxy verification uses temporary memory storage and does not validate your deployed setup.

For DynamoDB semantic matching, configure `AWS_REGION`, `BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0` and `BEDROCK_EMBEDDING_DIMENSIONS=256` in the backend environment, with model access and `bedrock:InvokeModel` permissions. Restart the backend after changing settings. In Home, open **Your matches**, enable **Semantic matching**, and select **Find bundle matches**. The first search lazily builds separate projections and may incur Bedrock and DynamoDB charges. A provider error is not a no-match result. The current bounded search supports up to 30 same-community available listings and 40 participant preference terms; use exact matching if it reports capacity. Semantic exclusions are conservative heuristics, and quality has not been established on a labeled real-world dataset.

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

Expected: saved `analysis_id`, `estimate_minor` in USD cents or null, comparable range and source links when sufficient evidence exists, uncertainty/reasons, and any clarification questions. The backend calculates the median of at least three eligible cited comparable prices or returns a labeled image-based fallback without sources. Provider-cited output is not independent verification that a source page currently lists that price. Analysis does not publish the listing and is saved for the exact revision.

## 6. Review the estimate and publish

Replace `ANALYSIS_ID` with the returned ID, and `4000` with the actual estimate you reviewed (the number here is illustrative, not a prescribed valuation). Publication requires the exact estimate and records `value_source=assisted`. If the estimate is null or clarification is needed, correct the draft and evaluate the new revision; do not manufacture an assisted value.

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
- 503 `ANALYSIS_RATE_LIMITED`: Google Search returned a quota/rate-limit response; check Gemini project billing and Search grounding quota, then retry.
- 503 `INVALID_TABLE_SCHEMA`: configured string key names do not match the existing table.
- 401: cookie missing/expired; sign in and reuse the cookie jar on the same host.
- 403: missing `X-Bartr-Request: 1`, disallowed Origin, or another owner's record.
- 409: stale revision/analysis; reload the current listing and use its revision.
- 503 `ANALYSIS_UNAVAILABLE`: model access/key/quota/provider failure. Manual draft entry is still available.

Send the HTTP error code/body and sanitized server log if anything fails. Do not share the Gemini key, AWS credentials, passwords or cookie file.
