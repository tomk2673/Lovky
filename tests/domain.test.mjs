import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { leadSchema, TEST_CONTACT, PRIVACY_VERSION, parseWholeMoney, parseCents, csvCell, updateSchema } from "../lib/lead-validation.ts";

import { createRequestKey } from "../lib/request-key.ts";

test("request keys use UUID v4 even without the HTTPS-only randomUUID API", () => {
  const keys = new Set(Array.from({length:100}, () => createRequestKey()));
  assert.equal(keys.size, 100);
  for (const k of keys) assert.match(k, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

const valid = { ...TEST_CONTACT, entity: "s.r.o.", amount: 3_500_000, purpose: "Provozní kapitál", property: "Komerční nemovitost", propertyValue: null, lien: "Nevím", urgency: "Do 30 dnů", businessPurpose: true, consent: true, privacyVersion: PRIVACY_VERSION, isTest: true, website: "" };

test("Czech amount input accepts spaces without silently changing ambiguous amounts", () => {
  for (const s of ["3 500 000", "3\u00a0500\u00a0000", "3\u202f500\u202f000"]) assert.equal(parseWholeMoney(s), 3_500_000);
  for (const s of ["-1000", "0", "1e6", "1.000,-", "100,50", "1000000001", "500 Kč", ""]) assert.equal(parseWholeMoney(s), null, s);
});

test("commission values remain exact integer cents", () => {
  assert.equal(parseCents("1 500,50"), 150050);
  assert.equal(parseCents("0,01"), 1);
  assert.equal(parseCents("0"), 0);
  for (const s of ["-10", "1,555", "1e4", "NaN", "1000001"]) assert.equal(parseCents(s), null);
});

test("lead validation rejects consumer intent, absent consent, bot input and injected server fields", () => {
  assert.ok(leadSchema.safeParse(valid).success);
  for (const change of [{ businessPurpose: false }, { consent: false }, { website: "bot.example" }, { status: "won" }, { score: 100 }, { amount: -1 }, { amount: 2.5 }, { ico: "123" }, { phone: "+" }, { email: "broken" }, { privacyVersion: "old" }]) assert.equal(leadSchema.safeParse({ ...valid, ...change }).success, false, JSON.stringify(change));
  assert.ok(leadSchema.safeParse({ ...valid, email: "" }).success);
});

test("CSV cells neutralize spreadsheet formulas and quote multiline content", () => {
  for (const s of ["=1+1", "+420123456789", "-1+2", "@SUM(A1)", "  =SUM(A1)", "\tcmd"]) assert.ok(csvCell(s).startsWith('"\''), s);
  assert.equal(csvCell('a;"b"\nc'), '"a;""b""\nc"');
});

test("admin mutations validate versions, statuses and monetary limits", () => {
  const v = { version: 1, status: "handed_over", note: "Kontaktován", expectedCents: 10000, paidCents: 0 };
  assert.ok(updateSchema.safeParse(v).success);
  for (const change of [{ version: 0 }, { status: "approved" }, { paidCents: -1 }, { expectedCents: 1.5 }, { note: "x".repeat(2001) }]) assert.equal(updateSchema.safeParse({ ...v, ...change }).success, false);
});

test("migration enforces idempotency, atomic audit, optimistic concurrency and complete erasure", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(readFileSync(new URL("../drizzle/0000_goofy_baron_strucker.sql", import.meta.url), "utf8"));
  const insert = db.prepare("INSERT INTO leads(id,request_key,payload_hash,created_at,updated_at,is_test,data,consent_at,privacy_version,recipient_snapshot,actor) VALUES(?,?,?,?,?,1,?,?,?,?,?)");
  const args = ["test-1", "request-1", "hash", 1, 1, JSON.stringify(valid), 1, PRIVACY_VERSION, "{}", "form"];
  insert.run(...args);
  assert.equal(db.prepare("SELECT count(*) AS n FROM lead_events").get().n, 1);
  assert.throws(() => insert.run("test-2", ...args.slice(1)), /UNIQUE/);
  assert.equal(db.prepare("SELECT count(*) AS n FROM leads").get().n, 1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM lead_events").get().n, 1);
  const update = db.prepare("UPDATE leads SET status=?,expected_cents=?,updated_at=2,version=version+1,actor='owner' WHERE id='test-1' AND version=? RETURNING version");
  assert.equal(update.get("handed_over", 150050, 1).version, 2);
  assert.equal(update.get("closed", 0, 1), undefined);
  assert.equal(db.prepare("SELECT count(*) AS n FROM lead_events").get().n, 2);
  const audit = JSON.parse(db.prepare("SELECT detail FROM lead_events WHERE action='updated'").get().detail);
  assert.equal(audit.previousStatus, "new");
  assert.equal(audit.status, "handed_over");
  assert.equal(audit.expectedCents, 150050);
  db.prepare("DELETE FROM leads WHERE id='test-1'").run();
  assert.equal(db.prepare("SELECT count(*) AS n FROM lead_events").get().n, 0);
  db.close();
});
