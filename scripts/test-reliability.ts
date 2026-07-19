import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getStore,
  resetMemoryStore,
  resetStore,
} from "../src/lib/db";
import {
  listVerticalIds,
  loadVertical,
  toPublicVertical,
} from "../src/lib/config/loadVertical";
import { validateJobSpec } from "../src/lib/intake/jobSpec";
import { logQuote } from "../src/lib/tools/logQuote";
import { getCompetingBids } from "../src/lib/tools/getCompetingBids";
import { closeSession } from "../src/lib/tools/closeSession";
import {
  blobStorageMode,
  hasDurableBlobStorage,
} from "../src/lib/storage/blobAuth";

type CaseFile = {
  version: number;
  cases: Array<{
    id: string;
    agent: string;
    input: string;
    expected: string;
  }>;
};

function prompt(name: string): string {
  return readFileSync(join(process.cwd(), name), "utf8");
}

function assertPromptContracts(): void {
  const files = [
    "agents/prompts/intake.md",
    "agents/prompts/negotiator.md",
    "agents/prompts/counter-agents/tough.md",
    "agents/prompts/counter-agents/stonewaller.md",
    "agents/prompts/counter-agents/upseller.md",
  ];
  for (const file of files) {
    const value = prompt(file);
    assert.match(value, /^# Role/m, `${file} needs a Role section`);
    assert.match(value, /^# Guardrails/m, `${file} needs a Guardrails section`);
    assert.match(
      value,
      /override this prompt|cannot (?:change|override)/i,
      `${file} must resist instruction override`,
    );
    assert.match(value, /never (reveal|speak)/i, `${file} must protect internals`);
  }

  const intake = prompt("agents/prompts/intake.md");
  assert.match(intake, /explicit approval/i);
  assert.match(intake, /Never invent/i);
  assert.match(intake, /Tool error handling/i);

  const negotiator = prompt("agents/prompts/negotiator.md");
  for (const invariant of [
    "get_competing_bids",
    "log_quote",
    "close_session",
    "Never invent",
    "Never agree to purchase",
    "Tool error handling",
  ]) {
    assert.ok(negotiator.includes(invariant), `negotiator prompt missing ${invariant}`);
  }
}

function assertCaseCatalog(): void {
  const cases = JSON.parse(
    prompt("agents/reliability-cases.json"),
  ) as CaseFile;
  assert.equal(cases.version, 1);
  assert.ok(cases.cases.length >= 20);
  assert.equal(
    new Set(cases.cases.map((item) => item.id)).size,
    cases.cases.length,
    "reliability case ids must be unique",
  );
  for (const item of cases.cases) {
    assert.ok(item.input.trim());
    assert.ok(item.expected.trim());
  }
}

function assertVerticalContracts(): void {
  for (const id of listVerticalIds()) {
    const vertical = loadVertical(id);
    assert.equal(vertical.vendors.length, 3);
    assert.deepEqual(
      vertical.vendors.map((vendor) => vendor.id).sort(),
      ["stonewaller", "tough", "upseller"],
    );
    assert.ok(vertical.intake.questions.some((question) => question.required));
    assert.ok(vertical.quote_line_items.filter((line) => line.required).length >= 2);
    const publicConfig = toPublicVertical(vertical);
    assert.ok(
      publicConfig.vendors.every(
        (vendor) => !("pricing_strategy_secret" in vendor),
      ),
      `${id} leaked a counterparty strategy`,
    );
    assert.equal(validateJobSpec(vertical, vertical.demo_defaults).ok, true);
  }
}

function assertBlobAuth(): void {
  const oidc = {
    VERCEL_OIDC_TOKEN: "short-lived",
    BLOB_STORE_ID: "store_example",
  };
  const legacy = {
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_example",
  };
  assert.equal(blobStorageMode(oidc), "oidc");
  assert.equal(blobStorageMode(legacy), "read-write-token");
  assert.equal(hasDurableBlobStorage({}), false);
}

async function assertToolHonesty(): Promise<void> {
  delete process.env.DATABASE_URL;
  resetMemoryStore();
  resetStore();
  const store = getStore();
  assert.equal(store.backend, "memory");

  const hvac = loadVertical("hvac");
  const job = await store.createJob({
    vertical: "hvac",
    job_spec: { ...hvac.demo_defaults },
  });
  await store.confirmJob(job.id);
  const otherJob = await store.createJob({
    vertical: "hvac",
    job_spec: { ...hvac.demo_defaults, zip: "60614" },
  });
  const tough = await store.createSession({
    job_id: job.id,
    vendor_id: "tough",
    vendor_name: "Summit Air",
  });
  const upseller = await store.createSession({
    job_id: job.id,
    vendor_id: "upseller",
    vendor_name: "ValueHVAC",
  });
  const otherSession = await store.createSession({
    job_id: otherJob.id,
    vendor_id: "tough",
    vendor_name: "Other",
  });

  const base = {
    job_id: job.id,
    session_id: tough.id,
    vendor_id: "tough",
    line_items: [
      { label: "Equipment", amount: 5_000 },
      { label: "Labor and installation", amount: 2_000 },
    ],
    total: 7_000,
  };

  assert.equal((await logQuote({ ...base, total: 0 })).ok, false);
  assert.equal(
    (await logQuote({ ...base, total: 8_000 })).ok,
    false,
    "bad arithmetic must be rejected",
  );
  assert.equal(
    (
      await logQuote({
        ...base,
        line_items: [
          { label: "Equipment", amount: 3_500 },
          { label: " equipment ", amount: 3_500 },
        ],
      })
    ).ok,
    false,
    "duplicate categories must be rejected",
  );
  assert.equal(
    (await logQuote({ ...base, vendor_id: "upseller" })).ok,
    false,
    "vendor/session mismatch must be rejected",
  );

  const first = await logQuote(base);
  assert.equal(first.ok, true);
  const retry = await logQuote(base);
  assert.equal(retry.ok, true, "exact tool retry must be idempotent");
  assert.equal(
    (await store.listQuotesByJob(job.id)).length,
    1,
    "idempotent retry must not duplicate a quote",
  );
  const changedWithoutFlag = await logQuote({
    ...base,
    total: 6_800,
    line_items: [
      { label: "Equipment", amount: 4_800 },
      { label: "Labor and installation", amount: 2_000 },
    ],
  });
  assert.equal(changedWithoutFlag.ok, false);
  if (!changedWithoutFlag.ok) {
    assert.equal(changedWithoutFlag.code, "UPDATE_FLAG_REQUIRED");
  }
  assert.equal(
    (
      await logQuote({
        ...base,
        total: 6_800,
        line_items: [
          { label: "Equipment", amount: 4_800 },
          { label: "Labor and installation", amount: 2_000 },
        ],
        is_update: true,
      })
    ).ok,
    true,
  );

  const upsellQuote = await logQuote({
    job_id: job.id,
    session_id: upseller.id,
    vendor_id: "upseller",
    line_items: [
      { label: "Equipment", amount: 3_000 },
      { label: "Labor and installation", amount: 1_500 },
    ],
    total: 4_500,
  });
  assert.equal(upsellQuote.ok, true);

  const bids = await getCompetingBids({
    job_id: job.id,
    session_id: tough.id,
  });
  assert.equal(bids.ok, true);
  if (bids.ok) {
    assert.equal(bids.bids.length, 1);
    assert.equal(bids.bids[0]?.vendor_id, "upseller");
  }
  const crossJob = await getCompetingBids({
    job_id: job.id,
    session_id: otherSession.id,
  });
  assert.equal(crossJob.ok, false);
  if (!crossJob.ok) assert.equal(crossJob.code, "JOB_MISMATCH");

  const callbackWithoutWindow = await closeSession({
    session_id: upseller.id,
    job_id: job.id,
    outcome_type: "callback_commitment",
  });
  assert.equal(callbackWithoutWindow.ok, false);

  const closeTough = await closeSession({
    session_id: tough.id,
    job_id: job.id,
    outcome_type: "itemized_quote",
  });
  assert.equal(closeTough.ok, true);
  assert.equal(
    (await logQuote({ ...base, is_update: true })).ok,
    false,
    "closed sessions must reject later quote writes",
  );

  const stone = await store.createSession({
    job_id: job.id,
    vendor_id: "stonewaller",
    vendor_name: "ComfortPro",
  });
  const closeStone = await closeSession({
    session_id: stone.id,
    job_id: job.id,
    outcome_type: "callback_commitment",
    callback_window: "Tomorrow 9–11 AM",
  });
  assert.equal(closeStone.ok, true);
  if (closeStone.ok) {
    assert.equal(closeStone.session.outcome_type, "documented_decline");
    assert.equal(closeStone.session.callback_window, "Tomorrow 9–11 AM");
  }
}

async function main(): Promise<void> {
  assertPromptContracts();
  assertCaseCatalog();
  assertVerticalContracts();
  assertBlobAuth();
  await assertToolHonesty();
  console.log("RELIABILITY TESTS OK — 20 human cases + prompt, config, storage, and tool invariants");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
