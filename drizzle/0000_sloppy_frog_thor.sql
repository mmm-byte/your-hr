CREATE TYPE "public"."attrition_reason" AS ENUM('better_offer', 'career_change', 'relocation', 'personal', 'performance', 'redundancy', 'retirement');--> statement-breakpoint
CREATE TYPE "public"."country_code" AS ENUM('US', 'IN', 'GB', 'DE', 'CA', 'AU');--> statement-breakpoint
CREATE TYPE "public"."currency_code" AS ENUM('USD', 'INR', 'GBP', 'EUR', 'CAD', 'AUD');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('active', 'on_leave', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('Female', 'Male', 'Non-binary');--> statement-breakpoint
CREATE TYPE "public"."localization_method" AS ENUM('synthetic_geo_factor_v1');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('remote', 'hybrid', 'office');--> statement-breakpoint
CREATE TABLE "absence_records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "absence_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"record_count" integer NOT NULL,
	"total_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "absence_records_record_count_positive_check" CHECK ("absence_records"."record_count" > 0),
	CONSTRAINT "absence_records_total_days_non_negative_check" CHECK ("absence_records"."total_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "attrition_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attrition_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"left_on" date NOT NULL,
	"reason" "attrition_reason" NOT NULL,
	"voluntary" boolean NOT NULL,
	"exit_interview_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attrition_events_exit_score_range_check" CHECK ("attrition_events"."exit_interview_score" is null or "attrition_events"."exit_interview_score" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" integer PRIMARY KEY NOT NULL,
	"branch_code" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country_code" "country_code" NOT NULL,
	"currency_code" "currency_code" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" integer PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"department_id" integer NOT NULL,
	"job_title" text NOT NULL,
	"job_level" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"country_code" "country_code" NOT NULL,
	"hire_date" date NOT NULL,
	"termination_date" date,
	"employment_status" "employment_status" NOT NULL,
	"gender" "gender" NOT NULL,
	"date_of_birth" date NOT NULL,
	"work_mode" "work_mode" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_termination_after_hire_check" CHECK ("employees"."termination_date" is null or "employees"."termination_date" >= "employees"."hire_date"),
	CONSTRAINT "employees_active_has_no_termination_check" CHECK ("employees"."employment_status" = 'terminated' or "employees"."termination_date" is null),
	CONSTRAINT "employees_terminated_requires_termination_check" CHECK ("employees"."employment_status" <> 'terminated' or "employees"."termination_date" is not null)
);
--> statement-breakpoint
CREATE TABLE "performance_reviews" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "performance_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"review_date" date NOT NULL,
	"rating" integer NOT NULL,
	"goals_met_pct" integer NOT NULL,
	"promotion_recommended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "performance_reviews_rating_range_check" CHECK ("performance_reviews"."rating" between 1 and 5),
	CONSTRAINT "performance_reviews_goals_met_range_check" CHECK ("performance_reviews"."goals_met_pct" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "salary_records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "salary_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" integer NOT NULL,
	"effective_from" date NOT NULL,
	"base_salary" numeric(12, 2) NOT NULL,
	"bonus_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"currency_code" "currency_code" NOT NULL,
	"source_base_salary_usd" numeric(12, 2),
	"usd_equivalent" numeric(12, 2),
	"geo_salary_factor" numeric(8, 4),
	"usd_to_local_fx" numeric(12, 5),
	"fx_reference_date" date,
	"localization_method" "localization_method",
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "salary_records_base_salary_positive_check" CHECK ("salary_records"."base_salary" > 0),
	CONSTRAINT "salary_records_bonus_pct_range_check" CHECK ("salary_records"."bonus_pct" >= 0 and "salary_records"."bonus_pct" <= 100)
);
--> statement-breakpoint
ALTER TABLE "absence_records" ADD CONSTRAINT "absence_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attrition_events" ADD CONSTRAINT "attrition_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "absence_records_employee_unique" ON "absence_records" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attrition_events_employee_unique" ON "attrition_events" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "attrition_events_left_on_idx" ON "attrition_events" USING btree ("left_on");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_correlation_id_idx" ON "audit_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_branch_code_unique" ON "branches" USING btree ("branch_code");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_name_unique" ON "departments" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_email_unique" ON "employees" USING btree ("email");--> statement-breakpoint
CREATE INDEX "employees_branch_id_idx" ON "employees" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "employees_department_id_idx" ON "employees" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "employees_employment_status_idx" ON "employees" USING btree ("employment_status");--> statement-breakpoint
CREATE INDEX "employees_work_mode_idx" ON "employees" USING btree ("work_mode");--> statement-breakpoint
CREATE INDEX "employees_job_level_idx" ON "employees" USING btree ("job_level");--> statement-breakpoint
CREATE INDEX "employees_country_code_idx" ON "employees" USING btree ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_reviews_employee_unique" ON "performance_reviews" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "performance_reviews_review_date_idx" ON "performance_reviews" USING btree ("review_date");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_records_employee_effective_unique" ON "salary_records" USING btree ("employee_id","effective_from");--> statement-breakpoint
CREATE INDEX "salary_records_employee_effective_desc_idx" ON "salary_records" USING btree ("employee_id","effective_from" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "salary_records_currency_code_idx" ON "salary_records" USING btree ("currency_code");