# Bundle Safety — Complete Product & Engineering Context

**Stack:** Next.js + TypeScript, Prisma ORM, PostgreSQL  
**Platform:** Shopify App Store  
**Primary users:** Shopify store owners and authorized staff  
**Working name:** Bundle Safety  
**Status:** Product concept; market demand and technical feasibility still need validation.

## 1. Product overview

Bundle Safety is a Shopify inventory monitoring, investigation, and risk-management app for merchants selling bundles, kits, gift sets, multipacks, and products with shared components.

It helps merchants understand inventory changes, spot suspicious quantity movements, investigate discrepancies, and reduce avoidable overselling risk.

**Store owners use the app internally.** Store shoppers do not install or operate it; they benefit indirectly from more reliable inventory and fewer avoidable cancellations.

**Positioning:** “Understand inventory changes, investigate suspicious stock movements, and catch potential overselling risks sooner—with clear evidence and AI-assisted explanations.”

Do not promise that every error or oversell will be detected or prevented.

## 2. Core principles

1. Evidence first: recorded facts must be separated from hypotheses.
2. Read-only by default: the initial product must not write inventory quantities.
3. Deterministic logic detects incidents; AI explains the evidence.
4. Prefer fewer useful alerts over large volumes of noisy alerts.
5. Explain monitoring limitations and data freshness.
6. Collect the minimum data needed.
7. Build a polished, production-quality SaaS experience, not just a basic MVP screen.

## 3. Target customers

Prioritize Shopify merchants who:
- Sell bundles, kits, gift sets, multipacks, or configurable products.
- Reuse component products across bundles or listings.
- Use bundle or inventory synchronization apps.
- Manage multiple inventory locations or frequent stock movements.
- Have experienced inventory discrepancies or overselling.
- Need investigation tools without granting another app inventory-write permissions.

## 4. Full feature map

### A. Shopify installation and onboarding
- Shopify OAuth installation and secure sessions.
- Explain permissions clearly and request least-privilege scopes.
- Guided onboarding checklist.
- Initial inventory import and baseline.
- Choose locations/products to monitor where practical.
- Configure default thresholds and notifications.
- Optional manual bundle/component mapping.
- Test alert and notification.
- Show setup completion, data freshness, and limitations.
- Handle uninstall and required data deletion.

### B. Overview dashboard
- Monitoring status: healthy, delayed, degraded, or disconnected.
- Last successful sync/reconciliation.
- Monitored products/items and locations.
- New, unresolved, and high-priority incidents.
- Recent suspicious changes.
- Products with repeated incidents.
- Inventory and incident trends.
- Mapped bundle components at risk.
- Reviewed-versus-dismissed alert summary.
- AI report status and usage.
- Actions to review incidents, view history, and configure monitoring.
- Useful empty states for new stores.

Only show metrics derived from real records; label time ranges and never invent demo data.

### C. Inventory monitoring
- Read quantities from Shopify.
- Track by inventory item, location, and quantity type where available.
- Timestamped observations.
- Identify each observation source: webhook, API read, reconciliation, or baseline.
- Show current known quantity and last observed time.
- Detect stale observations and monitoring gaps.
- Handle pagination and large catalogs.
- Handle deleted products and disconnected locations.
- Periodic reconciliation against Shopify's current state.

### D. Inventory history
- Product, variant, inventory item, location, quantity type.
- Previous/current quantity only when genuinely known.
- Quantity delta, event source, event time, received time.
- Linked incident, if any.
- Filters by product, location, date, source, and change size.
- Sorting, pagination, export to CSV.
- Product-level history.
- If the prior quantity is unknown, label the record as a new observation; never invent a previous value.

### E. Deterministic incident detection
Initial rules:
1. Large absolute quantity change.
2. Large percentage change, with minimum baseline quantity.
3. Repeated changes within a short window.
4. Reconciliation discrepancy.
5. Stale monitoring or missing observations.
6. Risk to mapped bundle components.
7. Optional merchant-defined thresholds.

Every incident should store the rule ID/version, thresholds, evidence window, triggering observations, severity, and suppression configuration. A large change is not automatically an error; legitimate sales, returns, transfers, and manual adjustments can cause it.

### F. Incident management
Each incident should include:
- ID, type, severity, and status.
- Status: new, investigating, resolved, dismissed.
- Affected item/location and mapped bundle group if known.
- Triggering rule and evidence timeline.
- First detected and last updated times.
- Monitoring/data-quality status.
- AI report, if generated.
- Merchant notes and resolution reason.
- Assignment to a team member if team workflows are implemented.
- Activity/audit log.
- Actions to investigate, resolve, dismiss as expected, add notes, reopen on new evidence, export, or merge duplicates.

### G. AI Inventory Incident Reports
AI is an explanation assistant, not the source of truth.

For eligible incidents, generate:
- Plain-English summary.
- Why the deterministic rule triggered.
- Confirmed facts.
- Unknowns and evidence gaps.
- Plausible explanations clearly labeled as possibilities.
- Recommended investigation steps.
- Potentially affected mapped bundle components.
- Suggested severity rationale based on supplied evidence.
- Confidence/limitations note.
- A concise report for internal handoff.

AI must never:
- Claim a specific app, employee, or customer caused a change without evidence.
- Invent orders, events, quantities, timestamps, or bundle relationships.
- Present hypotheses as confirmed facts.
- Change inventory, cancel/block orders, or perform write actions.
- Claim an oversell was prevented without proof.
- Receive unnecessary customer personal data.

Report lifecycle: not generated, queued, generated, failed/retryable, stale because evidence changed, regenerated.

AI controls:
- Strict JSON schema and server-side validation.
- Evidence version, provider/model, and prompt version tracking.
- Token/cost tracking, per-shop limits, timeouts, bounded retries.
- Cache reports while evidence is unchanged.
- Rule-based fallback if the AI provider fails.
- Regenerate action with usage limits.
- Provider abstraction, but start with one provider/model.

Suggested output fields:
`title`, `summary`, `why_flagged`, `confirmed_facts[]`, `possible_explanations[]`, `recommended_checks[]`, `unknowns[]`, `confidence_note`, `evidence_version`.

### H. Bundle/component mapping
- Manual grouping of component products into bundles/kits.
- Product search and selection.
- Bundle name and notes.
- Label relationship source: manual or integration-derived.
- Show incidents affecting mapped components.
- Keep relationship change history.
- Add app-specific integrations only after verifying compatibility and demand.

Do not assume every third-party bundle app exposes component relationships automatically.

### I. Notifications
- In-app notification center.
- Optional email alerts.
- Severity-based preferences and digests.
- Incident grouping and duplicate suppression.
- Delivery logs and bounded retries.
- Links to incident details.
- Per-shop limits and user preferences.
- Notify for incidents, not every webhook.
- Consider Slack or other channels later if demand supports them.

### J. Search, filters, and exports
- Search products, variants, incidents, and locations.
- Filter by severity, status, rule, date, location, and product.
- Sortable tables and pagination.
- CSV exports for history and incidents.
- Background export jobs for large datasets.
- Every query/export must be scoped to the correct shop.

### K. Team permissions
- Owner/admin and authorized staff roles.
- View/review permissions.
- Optional incident assignment and notes.
- Server-side authorization on every action.
- Use Shopify staff permissions where appropriate; avoid building a complex separate user system without need.

### L. Settings
- Monitoring: locations, items, reconciliation frequency.
- Detection: thresholds, rules, suppression windows.
- Notifications: channels and digests.
- Bundle groups and integrations.
- AI: enablement, report usage, data sent, model/provider settings.
- Team access.
- Data retention/export.
- Shopify connection and health.
- Billing and plans.
- Help, support, privacy, and terms.

### M. Billing and plans
Use Shopify Billing API and verify current requirements before public launch. Suggested plan packaging is a hypothesis:
- Free/trial: limited monitored items, history, and incidents.
- Starter: more monitored items, longer history, standard alerts, limited AI reports.
- Pro: higher limits, advanced rules, exports, longer history, and team workflows.
- Future larger-store tier only if real demand supports it.

Centralize plan entitlements; do not hardcode prices throughout the app. Enforce limits server-side and make usage transparent.

### N. Support and trust
- Contextual help and setup checklist.
- Troubleshooting guide.
- Monitoring health and last sync.
- Support contact/report issue.
- Limitations page.
- Privacy policy and terms.
- Data export/deletion workflows.
- Changelog/status messaging for important monitoring changes.

## 5. Technical stack

- Next.js + TypeScript. For a new project, prefer the currently supported App Router unless the repository already uses a suitable structure.
- Prisma ORM.
- PostgreSQL.
- Shopify's currently supported app framework/library for OAuth and sessions.
- GraphQL Admin API, using a supported stable API version.
- Background worker/queue for webhooks, reconciliation, notifications, exports, and AI reports.
- A robust PostgreSQL-backed queue can be acceptable initially; Redis/BullMQ or a managed queue is also an option if operationally appropriate.
- Schema validation such as Zod.
- Structured logging, error monitoring, and automated tests.

Inspect the actual repository and versions before making architectural changes.

## 6. Data pipeline

1. Shopify sends a supported webhook.
2. Next.js endpoint verifies HMAC against the raw request body.
3. Validate shop installation and event metadata.
4. Persist/enqueue event reliably.
5. Acknowledge Shopify promptly after safe acceptance.
6. Worker deduplicates and normalizes event.
7. Update product/inventory metadata as needed.
8. Query current Shopify state when required.
9. Store timestamped observation with source and data-quality metadata.
10. Run deterministic rules.
11. Create/update incident when a rule triggers.
12. Queue AI only for eligible incidents and new evidence versions.
13. Validate/store AI output or create deterministic fallback.
14. Deliver configured notifications with deduplication.
15. Dashboard queries data scoped to the shop.

Webhooks are not a guaranteed complete audit log. They may not contain previous quantities or identify the actor/app that caused a change. Events can be delayed, duplicated, or out of order. Reconcile against current Shopify state and clearly distinguish an observed discrepancy from a confirmed historical transition.

## 7. Shopify APIs, scopes, and webhooks to verify

Verify exact names, scopes, payloads, and version requirements against current official Shopify docs before implementation.

Investigate:
- GraphQL `InventoryLevel` and inventory item/location queries.
- Product and variant queries for mapping inventory IDs.
- `inventory_levels/update`.
- `inventory_levels/connect`.
- `inventory_levels/disconnect`.
- `products/update`.
- `products/delete`.
- `app/uninstalled`.
- Required privacy/compliance webhooks, including customer data request/redaction and shop redaction topics as applicable.

Likely starting scopes include `read_inventory` and `read_products`; confirm requirements for each operation. Do not request order/customer scopes unless a validated feature requires them. Do not assume every stock change triggers a webhook or every bundle relationship can be discovered.

## 8. Prisma data model proposal

Conceptual schema; confirm Prisma version, current repo, indexes, and Shopify framework before generating migrations.

### `Shop`
`id`, unique `shopDomain`, `installationStatus`, encrypted token or secure token reference, `installedAt`, `uninstalledAt`, timestamps.

### `InventoryItem`
`id`, `shopId`, `shopifyInventoryItemGid`, `productGid`, `variantGid`, `productTitle`, `variantTitle`, nullable `sku`, `tracked`, `deletedAt`, timestamps. Unique `(shopId, shopifyInventoryItemGid)`.

### `InventoryLocation`
`id`, `shopId`, `shopifyLocationGid`, `name`, `active`, timestamps. Unique `(shopId, shopifyLocationGid)`.

### `InventoryObservation`
`id`, `shopId`, `inventoryItemId`, `locationId`, `quantityName`, `quantity`, `observedAt`, `receivedAt`, `source`, nullable `sourceEventId`, `dataQuality`, timestamps. Index `(shopId, inventoryItemId, locationId, observedAt)`.

### `WebhookEvent`
`id`, `shopId`, `eventKey`, `topic`, `receivedAt`, `processedAt`, `status`, `attemptCount`, safe `errorCode`, timestamps. Deduplicate by shop/event ID where reliable; define a safe fallback when a stable ID is unavailable.

### `DetectionRule`
`id`, `shopId`, `ruleType`, `enabled`, validated JSON `configuration`, `version`, timestamps.

### `Incident`
`id`, `shopId`, `incidentKey`, `type`, `severity`, `status`, nullable `inventoryItemId`, nullable `locationId`, `ruleType`, `ruleVersion`, `evidenceVersion`, `firstDetectedAt`, `lastDetectedAt`, `resolvedAt`, `resolutionReason`, timestamps. Add an appropriate unique grouping key for duplicate suppression.

### `IncidentEvidence`
`id`, `shopId`, `incidentId`, `evidenceType`, related observation IDs or normalized rows, minimal `evidencePayload`, `createdAt`. Avoid storing oversized raw payloads.

### `AiReport`
`id`, `shopId`, `incidentId`, `evidenceVersion`, `provider`, `model`, `promptVersion`, `status`, validated `outputJson`, `inputTokens`, `outputTokens`, `estimatedCost`, `errorCode`, `generatedAt`, timestamps.

### `BundleGroup`
`id`, `shopId`, `name`, `description`, `relationshipSource`, `active`, timestamps.

### `BundleGroupItem`
`id`, `shopId`, `bundleGroupId`, `inventoryItemId`, `role`, timestamps.

### `IncidentActivity` / `IncidentNote`
`id`, `shopId`, `incidentId`, `actorType`, nullable `actorId`, `activityType`, nullable `content`, minimal metadata JSON, `createdAt`.

### `NotificationDelivery`
`id`, `shopId`, `incidentId`, `channel`, destination reference (avoid unnecessary PII), `status`, `attemptCount`, `sentAt`, safe `errorCode`, timestamps.

Add billing/entitlements, Shopify session data, and background job tables according to the chosen framework and queue. Use foreign keys, tenant-scoped queries, indexes, migrations, and safe deletion behavior.

## 9. Detection rules and initial defaults

Initial values are examples to validate, not universal truths:
- Absolute change threshold: 30 units.
- Percentage change threshold: 50%.
- Minimum previous quantity for percentage rule: 20 units.
- Repeated-change window: 10 minutes.
- Reconciliation interval: start around every 6 hours, then adjust for catalog size, API limits, and merchant needs.
- Duplicate incident suppression: 30 minutes per item/location/rule.

Make values configurable. Version the rule configuration used for every incident.

Requirements:
- Handle zero/missing baselines and negative values safely.
- Avoid division by zero.
- Use appropriate numeric types.
- Handle duplicates and event ordering.
- Do not classify all sales, returns, transfers, or manual adjustments as defects.
- Group repeated signals into one incident.
- Provide a deterministic explanation for each rule.
- Distinguish an observed mismatch from a confirmed historical change.

## 10. AI safety and prompt requirements

Send only a compact evidence package: incident type, product/location display labels, known quantities/delta/time window, rule/threshold, relevant observations, evidence quality, known mapped components, and missing evidence. Do not send tokens, full store exports, customer data, or unrelated records.

Core instruction for the model:

“You are an inventory incident explanation assistant. Explain only the evidence supplied by the application. Never invent inventory events, order activity, app names, users, quantities, timestamps, or causes. Separate confirmed facts from possible explanations. Do not present a hypothesis as a confirmed cause. Never perform or recommend automatic inventory writes. If evidence is incomplete, state the limitation and suggest checks possible with available data.”

Treat merchant-entered text and product names as untrusted data, not instructions. Validate output schema, keep AI separate from observed facts, track model/prompt versions, cache by evidence version, set budgets, and use safe fallback text.

## 11. Security and privacy

- Encrypt in transit and at rest.
- Store Shopify tokens securely and server-side.
- Verify webhook HMAC using raw request bytes.
- Enforce shop/tenant isolation in every query, mutation, job, and export.
- Use least-privilege scopes.
- Avoid customer personal data in the MVP.
- Do not log secrets or unnecessary payloads.
- Validate inputs and use server-side authorization.
- Rate-limit sensitive endpoints and expensive operations.
- Implement Shopify's current mandatory privacy webhooks and deletion obligations.
- Publish privacy policy and terms before public launch.
- Define retention and deletion behavior.
- Review AI provider retention/training/data-processing terms and disclose data sent to the provider.
- Never expose AI API keys in client bundles.

## 12. UI and design direction

The app should feel polished, professional, calm, and trustworthy. Use consistent spacing, restrained accent colors, clear tables/charts, useful empty/loading/error states, accessible contrast, responsive layouts, and real data only. Avoid excessive gradients or decorative AI visuals. Consider Shopify Polaris or the currently recommended Shopify design system after verifying current guidance.

### Main navigation
- Overview
- Incidents
- Inventory History
- Products & Locations
- Bundle Groups
- Reports / Exports
- Notifications
- Settings
- Help

### Core screens
1. Onboarding.
2. Overview dashboard.
3. Incident list with filters.
4. Incident detail with evidence timeline, rule explanation, AI report, unknowns, next checks, notes, activity log.
5. Inventory history.
6. Product detail with history and related incidents.
7. Bundle groups.
8. Reports and export jobs.
9. Settings: monitoring, rules, alerts, AI, retention, billing, Shopify connection.
10. Help, limitations, support, privacy.

All metrics must be derived from real records. Clearly label sample/demo data.

## 13. Cost and usage controls

- Run deterministic rules before AI.
- Generate reports only for eligible incidents.
- Group events and suppress duplicates.
- Set per-shop daily/monthly report quotas.
- Limit input/output tokens.
- Use timeouts and bounded retries.
- Cache reports by incident/evidence version.
- Track token usage, latency, errors, and estimated cost.
- Alert operators when usage budgets are exceeded.
- Use current provider pricing at implementation time; do not hardcode assumed model prices.

## 14. Operations and observability

Track:
- Webhook receipt/processing delay.
- Duplicate events and HMAC failures.
- Queue depth, retries, and failed jobs.
- API throttling and failed queries.
- Reconciliation freshness and success rate.
- Observation source and incident volume.
- Notification delivery.
- AI report latency, success/failure, tokens, and cost.
- Authorization and tenant-isolation errors.

Alert operators when monitoring stalls, reconciliation repeatedly fails, queues back up, webhook failures rise, or AI budgets are exceeded. Show merchants a degraded/stale state when monitoring is not reliable.

## 15. Testing strategy

Unit tests:
- Delta/percentage calculations, threshold boundaries, zero/missing baselines.
- Incident grouping/suppression.
- Evidence versioning.
- AI schema validation and fallback.
- Tenant access checks.

Integration tests:
- HMAC verification.
- Duplicate/delayed webhook processing.
- Reconciliation and pagination.
- API throttling/retries.
- Database constraints and transactions.
- Queue retries.
- Notification delivery.
- Deletion flows.

End-to-end:
- Installation and onboarding.
- Initial baseline.
- Large decrease.
- Normal sales-like changes.
- Location connect/disconnect.
- Missing webhook followed by reconciliation.
- AI timeout and invalid output.
- Uninstall/deletion.
- Cross-shop access attempts.

Pilot metrics:
- Alert precision and false-positive rate.
- Detection delay.
- Incident review rate.
- AI report usefulness.
- Monitoring/reconciliation uptime.
- Pilot-to-paid conversion and retention.

## 16. Roadmap

### Phase 0 — Verify repository and APIs
Inspect current repo, Next.js/Prisma versions, Shopify framework, API version, scopes, webhooks, billing, and privacy requirements. Document unresolved assumptions.

### Phase 1 — Reliable inventory data
Installation, inventory import, baseline observations, verified webhooks, queue, idempotency, reconciliation, and history UI.

### Phase 2 — Detection and incident workflows
Rules, incident lifecycle, detail/list views, filters, monitoring health, in-app notifications, CSV export.

### Phase 3 — AI reports
Evidence builder, provider abstraction, structured output, validation, fallback, caching, usage limits, and cost monitoring.

### Phase 4 — Bundle context and polished experience
Manual bundle groups, component-risk view, onboarding, settings, help, responsive UI, accessibility, and team features if justified.

### Phase 5 — Production readiness
Billing, privacy/deletion compliance, security review, observability, load/rate-limit tests, pilot feedback, false-positive tuning, App Store listing and support.

A narrow technical proof may take weeks; the full product and reliable pilot can take longer. Do not sacrifice correctness, privacy, or Shopify compliance to meet a date.

## 17. Definition of done for public launch

- Installation/OAuth works.
- Inventory is correctly read for tested products and locations.
- Webhooks are authenticated, deduplicated, and processed asynchronously.
- Reconciliation works and freshness is visible.
- Rules create explainable incidents.
- AI output is validated, evidence-bound, and safely falls back.
- No automatic inventory writes occur.
- Shop isolation is tested.
- Privacy, deletion, billing, and Shopify requirements are satisfied.
- Monitoring failures are visible to merchants/operators.
- Help, support, terms, and privacy policy are present.
- Pilot evidence shows that target merchants find alerts useful enough to consider paying.

## 18. Instructions for the coding agent

Before changing code:
1. Inspect the repository, current architecture, relevant files, and actual versions.
2. Do not overwrite existing architecture without understanding it.
3. Verify Shopify APIs and requirements against current official docs.
4. Propose a phased plan and Prisma schema.
5. Identify assumptions that cannot be verified.
6. Do not invent third-party app integration capabilities.

Implementation requirements:
- TypeScript and strict types where practical.
- Prisma migrations and explicit constraints/indexes.
- Validate webhooks, inputs, and AI outputs.
- Keep secrets server-side.
- Scope every query/job/export by `shopId`.
- Use transactions and idempotency for event processing.
- Add bounded retries and observable failure states.
- Never allow AI to call inventory-write operations.
- No automatic inventory correction.
- Tests for critical flows and security boundaries.
- `.env.example` with placeholders only.
- Setup, migration, development, test, deployment, and Shopify configuration docs.
- Report completed, incomplete, and unverified items honestly.

## 19. Product positioning

**Working description:** “Bundle Safety helps Shopify merchants monitor inventory changes, investigate suspicious stock movements, and understand potential bundle-related inventory risks with evidence-based alerts and AI-assisted incident reports.”

**Short value statement:** “Know what changed. Understand what to check next. Monitor inventory with confidence.”

This positioning is a hypothesis. Validate merchant demand and technical feasibility before claiming that the app prevents inventory failures.

## 20. Official references to verify

During implementation, use current official Shopify documentation for:
- GraphQL Admin API `InventoryLevel` and inventory queries.
- Webhook topics, subscriptions, verification, queues, retries, and reconciliation.
- OAuth/session handling.
- Scopes and protected customer data.
- Mandatory privacy webhooks and data deletion.
- Shopify Billing API and App Store requirements.

Select a supported stable API version at implementation time and document it. Shopify APIs and app requirements evolve.
