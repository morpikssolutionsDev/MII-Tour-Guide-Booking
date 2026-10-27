PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`kind` text NOT NULL,
	`method` text NOT NULL,
	`amount` integer NOT NULL,
	`paid_at` text NOT NULL,
	`reference` text,
	`proof_url` text,
	`proof_name` text,
	`note` text,
	`recorded_by` text,
	`created_at` text NOT NULL,
	`voided_at` text,
	`voided_by` text,
	`void_reason` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "booking_id", "kind", "method", "amount", "paid_at", "reference", "proof_url", "proof_name", "note", "recorded_by", "created_at", "voided_at", "voided_by", "void_reason") SELECT "id", "booking_id", "kind", "method", "amount", "paid_at", "reference", "proof_url", "proof_name", "note", "recorded_by", "created_at", "voided_at", "voided_by", "void_reason" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ix_payments_booking` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE INDEX `ix_payments_paid_at` ON `payments` (`paid_at`);--> statement-breakpoint
ALTER TABLE `booking_guides` ADD `acknowledged_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `booking_guides` ADD `ack_note` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `merge_group_id` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `merged_at` text;--> statement-breakpoint
CREATE INDEX `ix_bookings_merge_group` ON `bookings` (`merge_group_id`);--> statement-breakpoint
ALTER TABLE `notifications` ADD `recipient_email` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `delivery_status` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `error` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `sent_at` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `attachment_name` text;