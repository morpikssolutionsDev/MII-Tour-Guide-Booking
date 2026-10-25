CREATE TABLE `addons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` integer NOT NULL,
	`unit` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `booking_addons` (
	`booking_id` text NOT NULL,
	`addon_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`amount` integer NOT NULL,
	`included` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`booking_id`, `addon_id`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`addon_id`) REFERENCES `addons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `booking_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`system_key` text,
	`label` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`checked_at` text,
	`checked_by` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_checklist_booking` ON `booking_checklist_items` (`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ux_checklist_system` ON `booking_checklist_items` (`booking_id`,`system_key`) WHERE system_key IS NOT NULL;--> statement-breakpoint
CREATE TABLE `booking_events` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`type` text NOT NULL,
	`actor_user_id` text,
	`payload` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_booking_events_booking` ON `booking_events` (`booking_id`,`at`);--> statement-breakpoint
CREATE TABLE `booking_guides` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`guide_id` text NOT NULL,
	`tour_date` text NOT NULL,
	`slot_id` text NOT NULL,
	`assigned_at` text NOT NULL,
	`released_at` text,
	`notified_at` text,
	`short_notice` integer DEFAULT false NOT NULL,
	`acknowledged_at` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guide_id`) REFERENCES `guides`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_guide_slot` ON `booking_guides` (`guide_id`,`tour_date`,`slot_id`) WHERE released_at IS NULL;--> statement-breakpoint
CREATE INDEX `ix_booking_guides_booking` ON `booking_guides` (`booking_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`customer_id` text NOT NULL,
	`channel` text NOT NULL,
	`created_by` text NOT NULL,
	`language_id` text NOT NULL,
	`package_id` text NOT NULL,
	`slot_id` text NOT NULL,
	`slot_start` text NOT NULL,
	`slot_end` text NOT NULL,
	`tour_date` text NOT NULL,
	`people` integer NOT NULL,
	`guides_needed` integer NOT NULL,
	`status` text NOT NULL,
	`price_snapshot` text NOT NULL,
	`total_amount` integer NOT NULL,
	`hold_expires_at` text,
	`special_needs` text,
	`internal_notes` text,
	`group_ref` text,
	`cancel_reason` text,
	`cancel_detail` text,
	`refund_note` text,
	`cancelled_at` text,
	`cancelled_by` text,
	`completed_at` text,
	`completed_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_code_unique` ON `bookings` (`code`);--> statement-breakpoint
CREATE INDEX `ix_bookings_date_slot` ON `bookings` (`tour_date`,`slot_id`);--> statement-breakpoint
CREATE INDEX `ix_bookings_status_hold` ON `bookings` (`status`,`hold_expires_at`);--> statement-breakpoint
CREATE INDEX `ix_bookings_customer` ON `bookings` (`customer_id`);--> statement-breakpoint
CREATE INDEX `ix_bookings_created` ON `bookings` (`created_at`);--> statement-breakpoint
CREATE TABLE `briefing_material_packages` (
	`material_id` text NOT NULL,
	`package_id` text NOT NULL,
	PRIMARY KEY(`material_id`, `package_id`),
	FOREIGN KEY (`material_id`) REFERENCES `briefing_materials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `briefing_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body_html` text NOT NULL,
	`link_url` text,
	`file_url` text,
	`file_name` text,
	`file_size` integer,
	`applies_to_all` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `checklist_template_items` (
	`id` text PRIMARY KEY NOT NULL,
	`system_key` text,
	`label` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checklist_template_items_system_key_unique` ON `checklist_template_items` (`system_key`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone_e164` text NOT NULL,
	`nationality` text NOT NULL,
	`email` text,
	`notes` text,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`marketing_consent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_phone_e164_unique` ON `customers` (`phone_e164`);--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`token` text NOT NULL,
	`token_expires_at` text NOT NULL,
	`submitted_at` text,
	`source` text,
	`entered_by` text,
	`overall_rating` integer,
	`comment` text,
	`would_revisit` text,
	`contact_consent` integer,
	`invalid_attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_booking_id_unique` ON `feedback` (`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_token_unique` ON `feedback` (`token`);--> statement-breakpoint
CREATE TABLE `feedback_guide_ratings` (
	`feedback_id` text NOT NULL,
	`guide_id` text NOT NULL,
	`rating` integer NOT NULL,
	PRIMARY KEY(`feedback_id`, `guide_id`),
	FOREIGN KEY (`feedback_id`) REFERENCES `feedback`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guide_id`) REFERENCES `guides`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guide_languages` (
	`guide_id` text NOT NULL,
	`language_id` text NOT NULL,
	PRIMARY KEY(`guide_id`, `language_id`),
	FOREIGN KEY (`guide_id`) REFERENCES `guides`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`language_id`) REFERENCES `languages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guide_leaves` (
	`id` text PRIMARY KEY NOT NULL,
	`guide_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`decision_note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`guide_id`) REFERENCES `guides`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_leaves_guide_status` ON `guide_leaves` (`guide_id`,`status`,`start_date`);--> statement-breakpoint
CREATE TABLE `guide_working_days` (
	`guide_id` text NOT NULL,
	`weekday` integer NOT NULL,
	PRIMARY KEY(`guide_id`, `weekday`),
	FOREIGN KEY (`guide_id`) REFERENCES `guides`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guides` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`full_name` text NOT NULL,
	`display_name` text NOT NULL,
	`phone_e164` text NOT NULL,
	`photo_url` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guides_user_id_unique` ON `guides` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `guides_phone_e164_unique` ON `guides` (`phone_e164`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holidays_date_unique` ON `holidays` (`date`);--> statement-breakpoint
CREATE TABLE `languages` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_id` text NOT NULL,
	`name_en` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `languages_code_unique` ON `languages` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `languages_name_id_unique` ON `languages` (`name_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`event_key` text NOT NULL,
	`channel` text NOT NULL,
	`locale` text NOT NULL,
	`recipient_user_id` text,
	`recipient_phone` text,
	`recipient_name` text NOT NULL,
	`booking_id` text,
	`leave_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`link` text,
	`context` text NOT NULL,
	`dedupe_key` text,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leave_id`) REFERENCES `guide_leaves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_key_unique` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `ix_notifications_recipient` ON `notifications` (`recipient_user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_notifications_booking` ON `notifications` (`booking_id`);--> statement-breakpoint
CREATE INDEX `ix_notifications_channel` ON `notifications` (`channel`,`created_at`);--> statement-breakpoint
CREATE TABLE `package_facilities` (
	`package_id` text NOT NULL,
	`facility_id` text NOT NULL,
	PRIMARY KEY(`package_id`, `facility_id`),
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `package_included_addons` (
	`package_id` text NOT NULL,
	`addon_id` text NOT NULL,
	PRIMARY KEY(`package_id`, `addon_id`),
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`addon_id`) REFERENCES `addons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_per_guide` integer NOT NULL,
	`max_people_per_guide` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
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
	`recorded_by` text NOT NULL,
	`created_at` text NOT NULL,
	`voided_at` text,
	`voided_by` text,
	`void_reason` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_payments_booking` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE INDEX `ix_payments_paid_at` ON `payments` (`paid_at`);--> statement-breakpoint
CREATE TABLE `price_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_rules_type_unique` ON `price_rules` (`type`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `slots` (
	`id` text PRIMARY KEY NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`default_channel` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`password_changed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);