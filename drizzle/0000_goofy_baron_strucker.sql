CREATE TABLE `lead_events` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`detail` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_lead_idx` ON `lead_events` (`lead_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`request_key` text NOT NULL,
	`payload_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`is_test` integer NOT NULL,
	`data` text NOT NULL,
	`consent_at` integer NOT NULL,
	`privacy_version` text NOT NULL,
	`recipient_snapshot` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`expected_cents` integer DEFAULT 0 NOT NULL,
	`paid_cents` integer DEFAULT 0 NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_request_key_unique` ON `leads` (`request_key`);--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER lead_created_audit AFTER INSERT ON leads BEGIN
 INSERT INTO lead_events (id,lead_id,created_at,action,actor,detail)
 VALUES (lower(hex(randomblob(16))),NEW.id,NEW.created_at,'created',NEW.actor,json_object('status',NEW.status));
END;
--> statement-breakpoint
CREATE TRIGGER lead_updated_audit AFTER UPDATE ON leads BEGIN
 INSERT INTO lead_events (id,lead_id,created_at,action,actor,detail)
 VALUES (lower(hex(randomblob(16))),NEW.id,NEW.updated_at,'updated',NEW.actor,json_object('status',NEW.status,'previousStatus',OLD.status,'expectedCents',NEW.expected_cents,'paidCents',NEW.paid_cents,'previousExpectedCents',OLD.expected_cents,'previousPaidCents',OLD.paid_cents,'noteChanged',NEW.note<>OLD.note));
END;
