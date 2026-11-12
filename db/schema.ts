import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const leads = sqliteTable("leads", {
 id:text("id").primaryKey(), requestKey:text("request_key").notNull().unique(), payloadHash:text("payload_hash").notNull(),
 createdAt:integer("created_at").notNull(), updatedAt:integer("updated_at").notNull(), version:integer("version").notNull().default(1),
 status:text("status").notNull().default("new"), isTest:integer("is_test",{mode:"boolean"}).notNull(), data:text("data").notNull(),
 consentAt:integer("consent_at").notNull(), privacyVersion:text("privacy_version").notNull(), recipientSnapshot:text("recipient_snapshot").notNull(),
 note:text("note").notNull().default(""), expectedCents:integer("expected_cents").notNull().default(0), paidCents:integer("paid_cents").notNull().default(0), actor:text("actor").notNull()
},t=>[index("leads_created_idx").on(t.createdAt),index("leads_status_idx").on(t.status)]);
export const leadEvents = sqliteTable("lead_events", {
 id:text("id").primaryKey(), leadId:text("lead_id").notNull().references(()=>leads.id,{onDelete:"cascade"}),
 createdAt:integer("created_at").notNull(), action:text("action").notNull(), actor:text("actor").notNull(), detail:text("detail").notNull()
},t=>[index("events_lead_idx").on(t.leadId)]);
export const rateLimits=sqliteTable("rate_limits",{ key:text("key").primaryKey(),count:integer("count").notNull(),expiresAt:integer("expires_at").notNull() });
