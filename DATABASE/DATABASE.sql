CREATE SCHEMA "org";

CREATE SCHEMA "iam";

CREATE SCHEMA "workflow";

CREATE SCHEMA "audit";

CREATE SCHEMA "mdm";

CREATE SCHEMA "core";

CREATE SCHEMA "pur";

CREATE SCHEMA "ap";

CREATE SCHEMA "sal";

CREATE SCHEMA "ar";

CREATE SCHEMA "cash";

CREATE SCHEMA "bank";

CREATE SCHEMA "inv";

CREATE SCHEMA "fa";

CREATE SCHEMA "ccdc";

CREATE SCHEMA "tax";

CREATE SCHEMA "gl";

CREATE SCHEMA "report";

CREATE SCHEMA "integration";

CREATE TABLE "org"."company" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "code" varchar(30) NOT NULL,
  "name" varchar(255) NOT NULL,
  "legal_name" varchar(255) NOT NULL,
  "tax_code" varchar(30) NOT NULL,
  "address" varchar(500),
  "phone" varchar(30),
  "email" varchar(255),
  "accounting_currency_id" uuid NOT NULL,
  "legal_reporting_currency_id" uuid NOT NULL,
  "accounting_regime" varchar(30) NOT NULL DEFAULT 'TT99',
  "fiscal_year_start_month" smallint NOT NULL DEFAULT 1,
  "timezone" varchar(80) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_company_fiscal_year_start_month" CHECK (fiscal_year_start_month between 1 and 12)
);

CREATE TABLE "org"."branch" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "parent_branch_id" uuid,
  "code" varchar(30) NOT NULL,
  "name" varchar(255) NOT NULL,
  "tax_code" varchar(30),
  "address" varchar(500),
  "phone" varchar(30),
  "representative_name" varchar(255),
  "established_date" date,
  "closed_date" date,
  "is_head_office" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "org"."department" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "parent_department_id" uuid,
  "code" varchar(30) NOT NULL,
  "name" varchar(255) NOT NULL,
  "manager_employee_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "org"."position" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(150) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "org"."employee" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "department_id" uuid,
  "position_id" uuid,
  "employee_code" varchar(30) NOT NULL,
  "full_name" varchar(255) NOT NULL,
  "email" varchar(255),
  "phone" varchar(30),
  "hire_date" date,
  "termination_date" date,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "org"."employee_assignment" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "employee_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "department_id" uuid,
  "position_id" uuid,
  "valid_from" date NOT NULL,
  "valid_to" date,
  "is_primary" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "iam"."user_account" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "username" varchar(100) NOT NULL,
  "email" varchar(255) NOT NULL,
  "display_name" varchar(255) NOT NULL,
  "phone" varchar(30),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "failed_login_count" integer NOT NULL DEFAULT 0,
  "locked_until" timestamptz,
  "last_login_at" timestamptz,
  "password_changed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "iam"."user_identity" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "provider" varchar(30) NOT NULL,
  "provider_subject" varchar(255) NOT NULL,
  "password_hash" varchar(255),
  "verified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "iam"."user_session" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "user_id" uuid NOT NULL,
  "refresh_token_hash" varchar(255) NOT NULL,
  "device_name" varchar(255),
  "ip_address" varchar(64),
  "user_agent" text,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "iam"."role" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "role_type" varchar(20) NOT NULL DEFAULT 'CUSTOM',
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "description" varchar(500),
  "is_system_admin" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "iam"."permission_resource" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "code" varchar(100) NOT NULL,
  "module_code" varchar(30) NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "iam"."permission_action" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "code" varchar(50) NOT NULL,
  "name" varchar(150) NOT NULL,
  "risk_level" varchar(20) NOT NULL DEFAULT 'NORMAL'
);

CREATE TABLE "iam"."permission" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "resource_id" uuid NOT NULL,
  "action_id" uuid NOT NULL,
  "code" varchar(160) NOT NULL,
  "description" varchar(500),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "iam"."role_permission" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "effect" varchar(10) NOT NULL DEFAULT 'ALLOW',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "iam"."user_role_assignment" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_membership_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "data_scope_set_id" uuid,
  "valid_from" timestamptz NOT NULL DEFAULT (now()),
  "valid_to" timestamptz,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "assigned_by_user_id" uuid NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT (now()),
  "revoked_by_user_id" uuid,
  "revoked_at" timestamptz,
  "revoke_reason" varchar(500),
  CONSTRAINT "ck_user_role_assignment_validity" CHECK (valid_to is null or valid_to >= valid_from)
);

CREATE TABLE "iam"."permission_bundle" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "module_code" varchar(30) NOT NULL,
  "description" varchar(500),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "iam"."permission_bundle_item" (
  "bundle_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  PRIMARY KEY ("bundle_id", "permission_id")
);

CREATE TABLE "iam"."role_permission_bundle" (
  "role_id" uuid NOT NULL,
  "bundle_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  PRIMARY KEY ("role_id", "bundle_id")
);

CREATE TABLE "iam"."company_membership" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "employee_id" uuid,
  "membership_status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "joined_at" timestamptz NOT NULL DEFAULT (now()),
  "left_at" timestamptz,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "iam"."data_scope_set" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "allow_all_company_data" boolean NOT NULL DEFAULT false,
  "allow_owned_records" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "iam"."data_scope_branch" (
  "data_scope_set_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "include_descendants" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("data_scope_set_id", "branch_id")
);

CREATE TABLE "iam"."data_scope_department" (
  "data_scope_set_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "include_descendants" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("data_scope_set_id", "department_id")
);

CREATE TABLE "iam"."data_scope_warehouse" (
  "data_scope_set_id" uuid NOT NULL,
  "warehouse_id" uuid NOT NULL,
  PRIMARY KEY ("data_scope_set_id", "warehouse_id")
);

CREATE TABLE "iam"."data_scope_bank_account" (
  "data_scope_set_id" uuid NOT NULL,
  "company_bank_account_id" uuid NOT NULL,
  PRIMARY KEY ("data_scope_set_id", "company_bank_account_id")
);

CREATE TABLE "iam"."data_scope_project" (
  "data_scope_set_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  PRIMARY KEY ("data_scope_set_id", "project_id")
);

CREATE TABLE "iam"."data_scope_cost_center" (
  "data_scope_set_id" uuid NOT NULL,
  "cost_center_id" uuid NOT NULL,
  PRIMARY KEY ("data_scope_set_id", "cost_center_id")
);

CREATE TABLE "iam"."segregation_of_duties_rule" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "resource_code" varchar(100) NOT NULL,
  "first_action_code" varchar(50) NOT NULL,
  "conflicting_action_code" varchar(50) NOT NULL,
  "enforcement_mode" varchar(20) NOT NULL DEFAULT 'BLOCK',
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "effective_from" timestamptz NOT NULL DEFAULT (now()),
  "effective_to" timestamptz,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "iam"."segregation_of_duties_violation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "rule_id" uuid NOT NULL,
  "document_id" uuid,
  "user_id" uuid NOT NULL,
  "detected_action" varchar(50) NOT NULL,
  "resolution_status" varchar(20) NOT NULL DEFAULT 'OPEN',
  "override_reason" text,
  "overridden_by_user_id" uuid,
  "detected_at" timestamptz NOT NULL DEFAULT (now()),
  "resolved_at" timestamptz
);

CREATE TABLE "workflow"."approval_workflow" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "module_code" varchar(30) NOT NULL,
  "document_type_id" uuid,
  "business_type_code" varchar(80),
  "priority" integer NOT NULL DEFAULT 100,
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_by_user_id" uuid NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "workflow"."approval_workflow_version" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "approval_workflow_id" uuid NOT NULL,
  "version_no" integer NOT NULL,
  "effective_from" timestamptz NOT NULL,
  "effective_to" timestamptz,
  "allow_self_approval" boolean NOT NULL DEFAULT false,
  "require_creator_different_from_approver" boolean NOT NULL DEFAULT true,
  "require_creator_different_from_poster" boolean NOT NULL DEFAULT false,
  "version_status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "published_by_user_id" uuid,
  "published_at" timestamptz,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_approval_workflow_version_validity" CHECK (effective_to is null or effective_to >= effective_from)
);

CREATE TABLE "workflow"."approval_step" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "approval_workflow_version_id" uuid NOT NULL,
  "step_no" integer NOT NULL,
  "name" varchar(255) NOT NULL,
  "approval_mode" varchar(20) NOT NULL DEFAULT 'ANY',
  "minimum_approval_count" integer NOT NULL DEFAULT 1,
  "can_return" boolean NOT NULL DEFAULT true,
  "can_reject" boolean NOT NULL DEFAULT true,
  "service_level_hours" integer
);

CREATE TABLE "workflow"."approval_step_assignee" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "approval_step_id" uuid NOT NULL,
  "assignee_type" varchar(20) NOT NULL,
  "user_id" uuid,
  "role_id" uuid,
  "minimum_amount" numeric(20,4),
  "maximum_amount" numeric(20,4),
  "branch_id" uuid,
  "condition_json" jsonb
);

CREATE TABLE "workflow"."approval_condition" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "approval_workflow_version_id" uuid NOT NULL,
  "condition_type" varchar(30) NOT NULL,
  "field_name" varchar(100),
  "operator" varchar(20) NOT NULL,
  "value_json" jsonb NOT NULL,
  "priority" integer NOT NULL DEFAULT 100
);

CREATE TABLE "workflow"."approval_instance" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "approval_workflow_version_id" uuid NOT NULL,
  "current_step_no" integer,
  "instance_status" varchar(20) NOT NULL DEFAULT 'RUNNING',
  "submitted_by_user_id" uuid NOT NULL,
  "started_at" timestamptz NOT NULL DEFAULT (now()),
  "completed_at" timestamptz
);

CREATE TABLE "workflow"."approval_task" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "approval_instance_id" uuid NOT NULL,
  "approval_step_id" uuid NOT NULL,
  "assigned_user_id" uuid,
  "assigned_role_id" uuid,
  "task_status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "due_at" timestamptz,
  "acted_at" timestamptz,
  "acted_by_user_id" uuid,
  "comment" text
);

CREATE TABLE "workflow"."approval_action_log" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "approval_instance_id" uuid NOT NULL,
  "approval_task_id" uuid,
  "action_code" varchar(30) NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "from_status" varchar(30),
  "to_status" varchar(30) NOT NULL,
  "comment" text,
  "acted_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "workflow"."approval_delegation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "delegator_user_id" uuid NOT NULL,
  "delegate_user_id" uuid NOT NULL,
  "valid_from" timestamptz NOT NULL,
  "valid_to" timestamptz NOT NULL,
  "document_type_id" uuid,
  "branch_id" uuid,
  "maximum_amount" numeric(20,4),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_approval_delegation_validity" CHECK (valid_to > valid_from)
);

CREATE TABLE "audit"."audit_log" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "role_assignment_id" uuid,
  "module_code" varchar(30) NOT NULL,
  "action_code" varchar(50) NOT NULL,
  "entity_type" varchar(100) NOT NULL,
  "entity_id" uuid,
  "document_id" uuid,
  "request_id" varchar(100),
  "ip_address" varchar(64),
  "user_agent" text,
  "reason" text,
  "occurred_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "audit"."audit_change" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "audit_log_id" uuid NOT NULL,
  "field_name" varchar(150) NOT NULL,
  "old_value_json" jsonb,
  "new_value_json" jsonb
);

CREATE TABLE "audit"."login_log" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "user_id" uuid,
  "username_or_email" varchar(255),
  "login_result" varchar(20) NOT NULL,
  "failure_reason" varchar(255),
  "ip_address" varchar(64),
  "user_agent" text,
  "occurred_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "audit"."data_export_log" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "module_code" varchar(30) NOT NULL,
  "export_type" varchar(80) NOT NULL,
  "filter_json" jsonb,
  "row_count" bigint,
  "file_name" varchar(255),
  "occurred_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "audit"."security_event" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid,
  "user_id" uuid,
  "event_type" varchar(80) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "event_detail_json" jsonb,
  "ip_address" varchar(64),
  "request_id" varchar(100),
  "occurred_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "mdm"."currency" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "code" varchar(3) NOT NULL,
  "name" varchar(100) NOT NULL,
  "decimal_places" smallint NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."exchange_rate_type" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."exchange_rate" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "rate_type_id" uuid NOT NULL,
  "from_currency_id" uuid NOT NULL,
  "to_currency_id" uuid NOT NULL,
  "effective_date" date NOT NULL,
  "rate" numeric(20,8) NOT NULL,
  "source_bank_id" uuid,
  "source_description" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_exchange_rate_positive" CHECK (rate > 0)
);

CREATE TABLE "mdm"."payment_term" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(150) NOT NULL,
  "due_days" integer NOT NULL DEFAULT 0,
  "discount_days" integer,
  "discount_rate" numeric(9,6),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."tax_rate" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(30) NOT NULL,
  "tax_type" varchar(30) NOT NULL,
  "rate_percent" numeric(9,4) NOT NULL,
  "deductible" boolean NOT NULL DEFAULT true,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "ck_tax_rate_validity" CHECK (effective_to is null or effective_to >= effective_from)
);

CREATE TABLE "mdm"."project" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "start_date" date,
  "end_date" date,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."cost_center" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "parent_id" uuid,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."party" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "legal_name" varchar(255),
  "tax_code" varchar(30),
  "identity_no" varchar(50),
  "default_currency_id" uuid,
  "payment_term_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "mdm"."party_role" (
  "party_id" uuid NOT NULL,
  "role_type" varchar(30) NOT NULL,
  "active_from" date NOT NULL,
  "active_to" date,
  PRIMARY KEY ("party_id", "role_type")
);

CREATE TABLE "mdm"."party_address" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "party_id" uuid NOT NULL,
  "address_type" varchar(30) NOT NULL,
  "address_line" varchar(500) NOT NULL,
  "province_code" varchar(20),
  "district_code" varchar(20),
  "ward_code" varchar(20),
  "is_default" boolean NOT NULL DEFAULT false
);

CREATE TABLE "mdm"."bank" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "code" varchar(30) NOT NULL,
  "name" varchar(255) NOT NULL,
  "swift_code" varchar(30),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."party_bank_account" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "party_id" uuid NOT NULL,
  "bank_id" uuid NOT NULL,
  "account_number" varchar(100) NOT NULL,
  "account_name" varchar(255) NOT NULL,
  "branch_name" varchar(255),
  "is_default" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."item_category" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "parent_id" uuid,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."unit_of_measure" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(100) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."item" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "category_id" uuid,
  "base_uom_id" uuid NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "item_type" varchar(30) NOT NULL,
  "track_inventory" boolean NOT NULL DEFAULT true,
  "track_lot" boolean NOT NULL DEFAULT false,
  "track_serial" boolean NOT NULL DEFAULT false,
  "valuation_method" varchar(30),
  "default_tax_rate_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "mdm"."item_uom_conversion" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "item_id" uuid NOT NULL,
  "from_uom_id" uuid NOT NULL,
  "to_uom_id" uuid NOT NULL,
  "factor" numeric(20,8) NOT NULL
);

CREATE TABLE "mdm"."warehouse" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "address" varchar(500),
  "keeper_employee_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."inventory_location" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "warehouse_id" uuid NOT NULL,
  "parent_id" uuid,
  "code" varchar(50) NOT NULL,
  "name" varchar(150) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."company_bank_account" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "bank_id" uuid NOT NULL,
  "account_number" varchar(100) NOT NULL,
  "account_name" varchar(255) NOT NULL,
  "currency_id" uuid NOT NULL,
  "gl_account_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."document_type" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "module_code" varchar(30) NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "document_class" varchar(30) NOT NULL,
  "legal_form_code" varchar(50),
  "legal_basis" varchar(255),
  "supports_workflow" boolean NOT NULL DEFAULT true,
  "requires_posting" boolean NOT NULL DEFAULT false,
  "creates_inventory" boolean NOT NULL DEFAULT false,
  "creates_receivable" boolean NOT NULL DEFAULT false,
  "creates_payable" boolean NOT NULL DEFAULT false,
  "creates_tax_record" boolean NOT NULL DEFAULT false,
  "allows_manual_number" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."document_numbering_rule" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid,
  "document_type_id" uuid NOT NULL,
  "code" varchar(80) NOT NULL,
  "prefix" varchar(30),
  "suffix" varchar(30),
  "separator" varchar(10),
  "padding_length" smallint NOT NULL DEFAULT 6,
  "reset_policy" varchar(20) NOT NULL DEFAULT 'YEARLY',
  "include_branch_code" boolean NOT NULL DEFAULT false,
  "include_fiscal_year" boolean NOT NULL DEFAULT true,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "ck_document_numbering_rule_validity" CHECK (effective_to is null or effective_to >= effective_from),
  CONSTRAINT "ck_document_numbering_rule_padding" CHECK (padding_length > 0)
);

CREATE TABLE "mdm"."party_contact" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "party_id" uuid NOT NULL,
  "contact_type" varchar(30) NOT NULL,
  "contact_name" varchar(255) NOT NULL,
  "job_title" varchar(150),
  "email" varchar(255),
  "phone" varchar(30),
  "is_default" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."customer_profile" (
  "party_id" uuid PRIMARY KEY NOT NULL,
  "receivable_account_id" uuid,
  "revenue_account_id" uuid,
  "credit_limit" numeric(20,4),
  "credit_days" integer,
  "price_list_code" varchar(80),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "mdm"."vendor_profile" (
  "party_id" uuid PRIMARY KEY NOT NULL,
  "payable_account_id" uuid,
  "expense_account_id" uuid,
  "purchase_account_id" uuid,
  "payment_priority" varchar(20),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "core"."business_document" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "document_type_id" uuid NOT NULL,
  "document_no" varchar(80) NOT NULL,
  "fiscal_year" integer NOT NULL,
  "document_date" date NOT NULL,
  "posting_date" date,
  "currency_id" uuid NOT NULL,
  "exchange_rate" numeric(20,8) NOT NULL DEFAULT 1,
  "counterparty_id" uuid,
  "project_id" uuid,
  "cost_center_id" uuid,
  "document_status" varchar(30) NOT NULL DEFAULT 'DRAFT',
  "workflow_status" varchar(30) NOT NULL DEFAULT 'NOT_STARTED',
  "source_type" varchar(30) NOT NULL DEFAULT 'MANUAL',
  "total_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "total_tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "total_amount_base" numeric(20,4) NOT NULL DEFAULT 0,
  "description" text,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_by_user_id" uuid NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT (now()),
  "row_version" bigint NOT NULL DEFAULT 1,
  "deleted_at" timestamptz,
  CONSTRAINT "ck_business_document_status" CHECK (document_status in ('DRAFT','SUBMITTED','APPROVED','POSTED','CANCELLED','REVERSED')),
  CONSTRAINT "ck_business_document_workflow_status" CHECK (workflow_status in ('NOT_STARTED','RUNNING','APPROVED','REJECTED','CANCELLED')),
  CONSTRAINT "ck_business_document_exchange_rate" CHECK (exchange_rate > 0),
  CONSTRAINT "ck_business_document_row_version" CHECK (row_version > 0)
);

CREATE TABLE "core"."document_status_history" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "document_id" uuid NOT NULL,
  "from_status" varchar(30),
  "to_status" varchar(30) NOT NULL,
  "changed_by" uuid NOT NULL,
  "changed_at" timestamptz NOT NULL DEFAULT (now()),
  "reason" text
);

CREATE TABLE "core"."document_link" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "source_document_id" uuid NOT NULL,
  "target_document_id" uuid NOT NULL,
  "link_type" varchar(30) NOT NULL,
  "linked_amount" numeric(20,4),
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "core"."document_attachment" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "document_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "mime_type" varchar(120) NOT NULL,
  "storage_key" varchar(500) NOT NULL,
  "file_size" bigint NOT NULL,
  "checksum_sha256" varchar(64),
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "core"."document_reference" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "document_id" uuid NOT NULL,
  "reference_type" varchar(50) NOT NULL,
  "reference_no" varchar(150) NOT NULL,
  "reference_date" date,
  "issuer_name" varchar(255)
);

CREATE TABLE "core"."document_signature" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "document_id" uuid NOT NULL,
  "rendered_output_id" uuid,
  "signer_user_id" uuid,
  "signer_name_snapshot" varchar(255) NOT NULL,
  "signer_title_snapshot" varchar(255),
  "signature_type" varchar(30) NOT NULL,
  "signature_hash" varchar(255),
  "signed_at" timestamptz NOT NULL
);

CREATE TABLE "core"."document_template" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "document_type_id" uuid NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "core"."document_template_version" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "template_id" uuid NOT NULL,
  "version_no" integer NOT NULL,
  "template_engine" varchar(30) NOT NULL,
  "template_body" text NOT NULL,
  "effective_from" timestamptz NOT NULL,
  "effective_to" timestamptz,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "core"."document_lock" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "locked_by_user_id" uuid NOT NULL,
  "lock_token" varchar(100) NOT NULL,
  "locked_at" timestamptz NOT NULL DEFAULT (now()),
  "expires_at" timestamptz NOT NULL
);

CREATE TABLE "core"."configuration_definition" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "configuration_key" varchar(120) NOT NULL,
  "configuration_group" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" varchar(1000),
  "data_type" varchar(30) NOT NULL,
  "default_value_json" jsonb,
  "validation_rule_json" jsonb,
  "is_sensitive" boolean NOT NULL DEFAULT false,
  "requires_confirmation" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "core"."company_configuration_value" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid,
  "configuration_definition_id" uuid NOT NULL,
  "configuration_scope_key" varchar(120) NOT NULL,
  "value_json" jsonb NOT NULL,
  "effective_from" timestamptz NOT NULL DEFAULT (now()),
  "effective_to" timestamptz,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "change_reason" text,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_company_configuration_validity" CHECK (effective_to is null or effective_to >= effective_from)
);

CREATE TABLE "core"."document_number_sequence" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid,
  "document_type_id" uuid NOT NULL,
  "numbering_rule_id" uuid NOT NULL,
  "fiscal_year" integer NOT NULL,
  "sequence_scope_key" varchar(120) NOT NULL,
  "last_number" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "core"."document_note" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "document_id" uuid NOT NULL,
  "note_type" varchar(30) NOT NULL DEFAULT 'INTERNAL',
  "note_text" text NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "core"."document_rendered_output" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "document_id" uuid NOT NULL,
  "template_version_id" uuid NOT NULL,
  "output_format" varchar(20) NOT NULL,
  "storage_key" varchar(500) NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "checksum_sha256" varchar(64) NOT NULL,
  "is_final" boolean NOT NULL DEFAULT false,
  "generated_by_user_id" uuid NOT NULL,
  "generated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "pur"."purchase_request" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "requester_employee_id" uuid NOT NULL,
  "department_id" uuid,
  "required_date" date,
  "priority" varchar(20) NOT NULL DEFAULT 'NORMAL',
  "purpose" text
);

CREATE TABLE "pur"."purchase_request_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "purchase_request_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid,
  "description" varchar(500) NOT NULL,
  "uom_id" uuid,
  "quantity" numeric(20,6) NOT NULL,
  "estimated_unit_price" numeric(20,4),
  "warehouse_id" uuid,
  "project_id" uuid,
  "cost_center_id" uuid
);

CREATE TABLE "pur"."purchase_order" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "vendor_id" uuid NOT NULL,
  "buyer_employee_id" uuid,
  "payment_term_id" uuid,
  "delivery_address" varchar(500),
  "expected_delivery_date" date,
  "contract_no" varchar(100),
  "subtotal" numeric(20,4) NOT NULL DEFAULT 0,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "pur"."purchase_order_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "purchase_order_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "purchase_contract_line_id" uuid,
  "item_id" uuid,
  "description" varchar(500) NOT NULL,
  "uom_id" uuid,
  "ordered_quantity" numeric(20,6) NOT NULL,
  "unit_price" numeric(20,4) NOT NULL,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "tax_rate_id" uuid,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "line_total_amount" numeric(20,4) NOT NULL,
  "warehouse_id" uuid,
  "project_id" uuid,
  "cost_center_id" uuid
);

CREATE TABLE "pur"."goods_receipt" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "vendor_id" uuid,
  "warehouse_id" uuid NOT NULL,
  "received_by_employee_id" uuid,
  "delivery_note_no" varchar(100),
  "receipt_reason" varchar(500)
);

CREATE TABLE "pur"."goods_receipt_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "goods_receipt_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "purchase_order_line_id" uuid,
  "item_id" uuid NOT NULL,
  "uom_id" uuid NOT NULL,
  "document_quantity" numeric(20,6) NOT NULL,
  "actual_quantity" numeric(20,6) NOT NULL,
  "unit_cost" numeric(20,4),
  "amount" numeric(20,4),
  "location_id" uuid,
  "lot_id" uuid
);

CREATE TABLE "pur"."service_receipt" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "vendor_id" uuid NOT NULL,
  "accepted_by_employee_id" uuid NOT NULL,
  "service_period_from" date,
  "service_period_to" date
);

CREATE TABLE "pur"."service_receipt_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "service_receipt_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "purchase_order_line_id" uuid,
  "description" varchar(500) NOT NULL,
  "quantity" numeric(20,6) NOT NULL DEFAULT 1,
  "unit_price" numeric(20,4) NOT NULL,
  "amount" numeric(20,4) NOT NULL,
  "expense_account_id" uuid,
  "project_id" uuid,
  "cost_center_id" uuid
);

CREATE TABLE "pur"."purchase_invoice" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "vendor_id" uuid NOT NULL,
  "payment_term_id" uuid,
  "due_date" date,
  "supplier_invoice_reference_no" varchar(100),
  "supplier_invoice_reference_date" date,
  "subtotal_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "total_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "pur"."purchase_invoice_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "purchase_invoice_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid,
  "description" varchar(500) NOT NULL,
  "uom_id" uuid,
  "quantity" numeric(20,6),
  "unit_price" numeric(20,4),
  "amount_before_tax" numeric(20,4) NOT NULL,
  "tax_rate_id" uuid,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "expense_or_inventory_account_id" uuid NOT NULL,
  "ap_account_id" uuid NOT NULL,
  "project_id" uuid,
  "cost_center_id" uuid
);

CREATE TABLE "pur"."purchase_return" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "vendor_id" uuid NOT NULL,
  "warehouse_id" uuid,
  "reason" varchar(500) NOT NULL
);

CREATE TABLE "pur"."purchase_return_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "purchase_return_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "original_receipt_line_id" uuid,
  "original_invoice_line_id" uuid,
  "item_id" uuid,
  "uom_id" uuid,
  "quantity" numeric(20,6) NOT NULL,
  "unit_price" numeric(20,4),
  "amount" numeric(20,4) NOT NULL,
  "tax_rate_id" uuid,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "pur"."landed_cost" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "allocation_method" varchar(30) NOT NULL,
  "total_cost" numeric(20,4) NOT NULL
);

CREATE TABLE "pur"."landed_cost_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "landed_cost_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "cost_type" varchar(50) NOT NULL,
  "vendor_id" uuid,
  "amount" numeric(20,4) NOT NULL,
  "account_id" uuid NOT NULL
);

CREATE TABLE "pur"."landed_cost_allocation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "landed_cost_line_id" uuid NOT NULL,
  "goods_receipt_line_id" uuid NOT NULL,
  "allocated_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "pur"."purchase_contract" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "vendor_id" uuid NOT NULL,
  "contract_no" varchar(100) NOT NULL,
  "contract_date" date NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "payment_term_id" uuid,
  "contract_value" numeric(20,4),
  "currency_id" uuid NOT NULL,
  "contract_status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "pur"."purchase_contract_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "purchase_contract_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid,
  "description" varchar(500) NOT NULL,
  "uom_id" uuid,
  "contracted_quantity" numeric(20,6),
  "unit_price" numeric(20,4),
  "contract_amount" numeric(20,4) NOT NULL,
  "tax_rate_id" uuid,
  "warehouse_id" uuid,
  "project_id" uuid,
  "cost_center_id" uuid
);

CREATE TABLE "pur"."purchase_request_order_allocation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "purchase_request_line_id" uuid NOT NULL,
  "purchase_order_line_id" uuid NOT NULL,
  "allocated_quantity" numeric(20,6) NOT NULL
);

CREATE TABLE "pur"."purchase_invoice_line_order_allocation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "purchase_invoice_line_id" uuid NOT NULL,
  "purchase_order_line_id" uuid NOT NULL,
  "allocated_quantity" numeric(20,6),
  "allocated_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "pur"."purchase_invoice_line_goods_receipt_allocation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "purchase_invoice_line_id" uuid NOT NULL,
  "goods_receipt_line_id" uuid NOT NULL,
  "allocated_quantity" numeric(20,6),
  "allocated_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "pur"."purchase_invoice_line_service_receipt_allocation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "purchase_invoice_line_id" uuid NOT NULL,
  "service_receipt_line_id" uuid NOT NULL,
  "allocated_quantity" numeric(20,6),
  "allocated_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "ap"."payable_open_item" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "vendor_id" uuid NOT NULL,
  "source_document_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "currency_id" uuid NOT NULL,
  "original_amount" numeric(20,4) NOT NULL,
  "settled_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "open_amount" numeric(20,4) NOT NULL,
  "due_date" date,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN',
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "ap"."payable_schedule" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "open_item_id" uuid NOT NULL,
  "installment_no" integer NOT NULL,
  "due_date" date NOT NULL,
  "amount" numeric(20,4) NOT NULL,
  "settled_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "ap"."vendor_advance" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "vendor_id" uuid NOT NULL,
  "payment_document_id" uuid NOT NULL,
  "currency_id" uuid NOT NULL,
  "original_amount" numeric(20,4) NOT NULL,
  "applied_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "remaining_amount" numeric(20,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE "ap"."payable_settlement" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "vendor_id" uuid NOT NULL,
  "settlement_document_id" uuid NOT NULL,
  "settlement_date" date NOT NULL,
  "currency_id" uuid NOT NULL,
  "total_amount" numeric(20,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'POSTED'
);

CREATE TABLE "ap"."payable_settlement_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "settlement_id" uuid NOT NULL,
  "open_item_id" uuid NOT NULL,
  "schedule_id" uuid NOT NULL,
  "settled_amount" numeric(20,4) NOT NULL,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "exchange_difference" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "ap"."payable_offset" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "vendor_id" uuid NOT NULL,
  "receivable_party_id" uuid,
  "offset_date" date NOT NULL,
  "amount" numeric(20,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'POSTED'
);

CREATE TABLE "ap"."payable_adjustment" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "vendor_id" uuid NOT NULL,
  "adjustment_type" varchar(30) NOT NULL,
  "adjustment_reason" varchar(500) NOT NULL,
  "currency_id" uuid NOT NULL,
  "total_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "ap"."payable_adjustment_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "payable_adjustment_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "payable_open_item_id" uuid,
  "account_id" uuid NOT NULL,
  "debit_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "credit_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "description" varchar(500)
);

CREATE TABLE "ap"."vendor_advance_application" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "vendor_advance_id" uuid NOT NULL,
  "payable_open_item_id" uuid NOT NULL,
  "settlement_id" uuid,
  "applied_amount" numeric(20,4) NOT NULL,
  "applied_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "ap"."payable_offset_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "payable_offset_id" uuid NOT NULL,
  "payable_open_item_id" uuid NOT NULL,
  "receivable_open_item_id" uuid NOT NULL,
  "offset_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "sal"."quotation" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "customer_id" uuid NOT NULL,
  "valid_until" date,
  "sales_employee_id" uuid,
  "payment_term_id" uuid,
  "subtotal" numeric(20,4) NOT NULL DEFAULT 0,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "sal"."quotation_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "quotation_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid,
  "description" varchar(500) NOT NULL,
  "uom_id" uuid,
  "quantity" numeric(20,6) NOT NULL,
  "unit_price" numeric(20,4) NOT NULL,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "tax_rate_id" uuid,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "line_total" numeric(20,4) NOT NULL
);

CREATE TABLE "sal"."sales_order" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "customer_id" uuid NOT NULL,
  "sales_employee_id" uuid,
  "payment_term_id" uuid,
  "delivery_address" varchar(500),
  "expected_delivery_date" date,
  "subtotal" numeric(20,4) NOT NULL DEFAULT 0,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "sal"."sales_order_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "sales_order_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "quotation_line_id" uuid,
  "sales_contract_line_id" uuid,
  "item_id" uuid,
  "description" varchar(500) NOT NULL,
  "uom_id" uuid,
  "ordered_quantity" numeric(20,6) NOT NULL,
  "unit_price" numeric(20,4) NOT NULL,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "tax_rate_id" uuid,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "line_total_amount" numeric(20,4) NOT NULL,
  "warehouse_id" uuid
);

CREATE TABLE "sal"."delivery" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "customer_id" uuid NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "delivery_address" varchar(500),
  "delivered_by_employee_id" uuid,
  "delivery_note_no" varchar(100)
);

CREATE TABLE "sal"."delivery_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "delivery_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "sales_order_line_id" uuid,
  "item_id" uuid NOT NULL,
  "uom_id" uuid NOT NULL,
  "quantity" numeric(20,6) NOT NULL,
  "location_id" uuid,
  "lot_id" uuid
);

CREATE TABLE "sal"."sales_invoice" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "customer_id" uuid NOT NULL,
  "payment_term_id" uuid,
  "due_date" date,
  "subtotal_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "total_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "sal"."sales_invoice_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "sales_invoice_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid,
  "description" varchar(500) NOT NULL,
  "uom_id" uuid,
  "quantity" numeric(20,6),
  "unit_price" numeric(20,4),
  "amount_before_tax" numeric(20,4) NOT NULL,
  "tax_rate_id" uuid,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "revenue_account_id" uuid NOT NULL,
  "ar_account_id" uuid NOT NULL,
  "project_id" uuid,
  "cost_center_id" uuid
);

CREATE TABLE "sal"."sales_return" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "customer_id" uuid NOT NULL,
  "warehouse_id" uuid,
  "reason" varchar(500) NOT NULL
);

CREATE TABLE "sal"."sales_return_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "sales_return_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "original_delivery_line_id" uuid,
  "original_invoice_line_id" uuid,
  "item_id" uuid,
  "uom_id" uuid,
  "quantity" numeric(20,6) NOT NULL,
  "unit_price" numeric(20,4),
  "amount" numeric(20,4) NOT NULL,
  "tax_rate_id" uuid,
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "sal"."sales_contract" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "customer_id" uuid NOT NULL,
  "contract_no" varchar(100) NOT NULL,
  "contract_date" date NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "payment_term_id" uuid,
  "contract_value" numeric(20,4),
  "currency_id" uuid NOT NULL,
  "contract_status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "sal"."sales_contract_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "sales_contract_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid,
  "description" varchar(500) NOT NULL,
  "uom_id" uuid,
  "contracted_quantity" numeric(20,6),
  "unit_price" numeric(20,4),
  "contract_amount" numeric(20,4) NOT NULL,
  "tax_rate_id" uuid,
  "warehouse_id" uuid
);

CREATE TABLE "sal"."sales_invoice_line_order_allocation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "sales_invoice_line_id" uuid NOT NULL,
  "sales_order_line_id" uuid NOT NULL,
  "allocated_quantity" numeric(20,6),
  "allocated_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "sal"."sales_invoice_line_delivery_allocation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "sales_invoice_line_id" uuid NOT NULL,
  "delivery_line_id" uuid NOT NULL,
  "allocated_quantity" numeric(20,6),
  "allocated_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "ar"."receivable_open_item" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "source_document_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "currency_id" uuid NOT NULL,
  "original_amount" numeric(20,4) NOT NULL,
  "settled_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "open_amount" numeric(20,4) NOT NULL,
  "due_date" date,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN',
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "ar"."receivable_schedule" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "open_item_id" uuid NOT NULL,
  "installment_no" integer NOT NULL,
  "due_date" date NOT NULL,
  "amount" numeric(20,4) NOT NULL,
  "settled_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "ar"."customer_advance" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "receipt_document_id" uuid NOT NULL,
  "currency_id" uuid NOT NULL,
  "original_amount" numeric(20,4) NOT NULL,
  "applied_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "remaining_amount" numeric(20,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE "ar"."receivable_settlement" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "settlement_document_id" uuid NOT NULL,
  "settlement_date" date NOT NULL,
  "currency_id" uuid NOT NULL,
  "total_amount" numeric(20,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'POSTED'
);

CREATE TABLE "ar"."receivable_settlement_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "settlement_id" uuid NOT NULL,
  "open_item_id" uuid NOT NULL,
  "schedule_id" uuid NOT NULL,
  "settled_amount" numeric(20,4) NOT NULL,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "exchange_difference" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "ar"."receivable_offset" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "payable_party_id" uuid,
  "offset_date" date NOT NULL,
  "amount" numeric(20,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'POSTED'
);

CREATE TABLE "ar"."receivable_adjustment" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "customer_id" uuid NOT NULL,
  "adjustment_type" varchar(30) NOT NULL,
  "adjustment_reason" varchar(500) NOT NULL,
  "currency_id" uuid NOT NULL,
  "total_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "ar"."receivable_adjustment_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "receivable_adjustment_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "receivable_open_item_id" uuid,
  "account_id" uuid NOT NULL,
  "debit_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "credit_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "description" varchar(500)
);

CREATE TABLE "ar"."customer_advance_application" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "customer_advance_id" uuid NOT NULL,
  "receivable_open_item_id" uuid NOT NULL,
  "settlement_id" uuid,
  "applied_amount" numeric(20,4) NOT NULL,
  "applied_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "ar"."receivable_offset_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "receivable_offset_id" uuid NOT NULL,
  "receivable_open_item_id" uuid NOT NULL,
  "payable_open_item_id" uuid NOT NULL,
  "offset_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "cash"."cash_fund" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(150) NOT NULL,
  "currency_id" uuid NOT NULL,
  "cash_account_id" uuid NOT NULL,
  "cashier_employee_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "cash"."cash_receipt" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "cash_fund_id" uuid NOT NULL,
  "payer_party_id" uuid,
  "payer_name" varchar(255) NOT NULL,
  "payer_address" varchar(500),
  "reason" varchar(500) NOT NULL,
  "received_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "cash"."cash_receipt_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "cash_receipt_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "account_id" uuid NOT NULL,
  "party_id" uuid,
  "amount" numeric(20,4) NOT NULL,
  "project_id" uuid,
  "cost_center_id" uuid,
  "description" varchar(500)
);

CREATE TABLE "cash"."cash_payment" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "cash_fund_id" uuid NOT NULL,
  "payee_party_id" uuid,
  "payee_name" varchar(255) NOT NULL,
  "payee_address" varchar(500),
  "reason" varchar(500) NOT NULL,
  "paid_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "cash"."cash_payment_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "cash_payment_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "account_id" uuid NOT NULL,
  "party_id" uuid,
  "amount" numeric(20,4) NOT NULL,
  "project_id" uuid,
  "cost_center_id" uuid,
  "description" varchar(500)
);

CREATE TABLE "cash"."advance_request" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL,
  "requested_amount" numeric(20,4) NOT NULL,
  "purpose" varchar(500) NOT NULL,
  "settlement_due_date" date
);

CREATE TABLE "cash"."advance_settlement" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "employee_id" uuid NOT NULL,
  "advance_document_id" uuid NOT NULL,
  "advanced_amount" numeric(20,4) NOT NULL,
  "actual_spent_amount" numeric(20,4) NOT NULL,
  "refund_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "additional_payment_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "cash"."payment_request" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "requester_employee_id" uuid NOT NULL,
  "payee_party_id" uuid,
  "requested_amount" numeric(20,4) NOT NULL,
  "purpose" varchar(500) NOT NULL,
  "requested_payment_date" date
);

CREATE TABLE "cash"."cash_count" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "cash_fund_id" uuid NOT NULL,
  "book_balance" numeric(20,4) NOT NULL,
  "actual_balance" numeric(20,4) NOT NULL,
  "difference_amount" numeric(20,4) NOT NULL,
  "counted_at" timestamptz NOT NULL
);

CREATE TABLE "cash"."cash_book_entry" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "cash_fund_id" uuid NOT NULL,
  "source_document_id" uuid NOT NULL,
  "entry_date" date NOT NULL,
  "sequence_no" bigint NOT NULL,
  "receipt_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "payment_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "balance_after_entry" numeric(20,4),
  "description" varchar(500),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "bank"."bank_receipt" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "bank_account_id" uuid NOT NULL,
  "payer_party_id" uuid,
  "transaction_reference" varchar(150),
  "value_date" date NOT NULL,
  "received_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "bank"."bank_receipt_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "bank_receipt_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "account_id" uuid NOT NULL,
  "party_id" uuid,
  "amount" numeric(20,4) NOT NULL,
  "project_id" uuid,
  "cost_center_id" uuid
);

CREATE TABLE "bank"."bank_payment" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "bank_account_id" uuid NOT NULL,
  "payee_party_id" uuid,
  "transaction_reference" varchar(150),
  "value_date" date NOT NULL,
  "paid_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "bank"."bank_payment_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "bank_payment_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "account_id" uuid NOT NULL,
  "party_id" uuid,
  "amount" numeric(20,4) NOT NULL,
  "project_id" uuid,
  "cost_center_id" uuid
);

CREATE TABLE "bank"."payment_order" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "bank_account_id" uuid NOT NULL,
  "beneficiary_party_id" uuid,
  "beneficiary_name" varchar(255) NOT NULL,
  "beneficiary_account_no" varchar(100) NOT NULL,
  "beneficiary_bank_name" varchar(255) NOT NULL,
  "amount" numeric(20,4) NOT NULL,
  "purpose" varchar(500) NOT NULL,
  "bank_status" varchar(30) NOT NULL DEFAULT 'NOT_SENT'
);

CREATE TABLE "bank"."bank_transfer" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "from_bank_account_id" uuid NOT NULL,
  "to_bank_account_id" uuid NOT NULL,
  "amount" numeric(20,4) NOT NULL,
  "bank_fee" numeric(20,4) NOT NULL DEFAULT 0,
  "value_date" date NOT NULL
);

CREATE TABLE "bank"."statement" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "bank_account_id" uuid NOT NULL,
  "statement_no" varchar(100) NOT NULL,
  "from_date" date NOT NULL,
  "to_date" date NOT NULL,
  "opening_balance" numeric(20,4) NOT NULL,
  "closing_balance" numeric(20,4) NOT NULL,
  "imported_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "bank"."statement_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "statement_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "transaction_date" date NOT NULL,
  "value_date" date,
  "reference_no" varchar(150),
  "description" varchar(1000),
  "debit_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "credit_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "balance" numeric(20,4),
  "counterparty_account" varchar(100),
  "counterparty_name" varchar(255)
);

CREATE TABLE "bank"."reconciliation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "bank_account_id" uuid NOT NULL,
  "statement_id" uuid NOT NULL,
  "reconciliation_date" date NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN',
  "started_by" uuid NOT NULL,
  "completed_by" uuid,
  "completed_at" timestamptz
);

CREATE TABLE "bank"."reconciliation_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "reconciliation_id" uuid NOT NULL,
  "statement_line_id" uuid NOT NULL,
  "matched_document_id" uuid,
  "matched_amount" numeric(20,4) NOT NULL,
  "match_type" varchar(30) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'MATCHED'
);

CREATE TABLE "bank"."bank_book_entry" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "bank_account_id" uuid NOT NULL,
  "source_document_id" uuid NOT NULL,
  "entry_date" date NOT NULL,
  "sequence_no" bigint NOT NULL,
  "debit_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "credit_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "balance_after_entry" numeric(20,4),
  "bank_reference_no" varchar(150),
  "description" varchar(500),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "inv"."stock_receipt" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "receipt_type" varchar(30) NOT NULL,
  "source_party_id" uuid,
  "received_by_employee_id" uuid
);

CREATE TABLE "inv"."stock_receipt_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "stock_receipt_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid NOT NULL,
  "uom_id" uuid NOT NULL,
  "document_quantity" numeric(20,6) NOT NULL,
  "actual_quantity" numeric(20,6) NOT NULL,
  "unit_cost" numeric(20,4),
  "amount" numeric(20,4),
  "location_id" uuid,
  "lot_id" uuid
);

CREATE TABLE "inv"."stock_issue" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "issue_type" varchar(30) NOT NULL,
  "recipient_party_id" uuid,
  "issued_by_employee_id" uuid,
  "reason" varchar(500)
);

CREATE TABLE "inv"."stock_issue_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "stock_issue_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid NOT NULL,
  "uom_id" uuid NOT NULL,
  "requested_quantity" numeric(20,6) NOT NULL,
  "actual_quantity" numeric(20,6) NOT NULL,
  "unit_cost" numeric(20,4),
  "amount" numeric(20,4),
  "location_id" uuid,
  "lot_id" uuid
);

CREATE TABLE "inv"."stock_transfer" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "from_warehouse_id" uuid NOT NULL,
  "to_warehouse_id" uuid NOT NULL,
  "transfer_date" date NOT NULL,
  "received_date" date
);

CREATE TABLE "inv"."stock_transfer_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "stock_transfer_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid NOT NULL,
  "uom_id" uuid NOT NULL,
  "quantity" numeric(20,6) NOT NULL,
  "from_location_id" uuid,
  "to_location_id" uuid,
  "lot_id" uuid
);

CREATE TABLE "inv"."stock_adjustment" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "adjustment_type" varchar(30) NOT NULL,
  "reason" varchar(500) NOT NULL
);

CREATE TABLE "inv"."stock_adjustment_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "stock_adjustment_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid NOT NULL,
  "uom_id" uuid NOT NULL,
  "quantity_delta" numeric(20,6) NOT NULL,
  "value_delta" numeric(20,4) NOT NULL DEFAULT 0,
  "location_id" uuid,
  "lot_id" uuid
);

CREATE TABLE "inv"."stocktake" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "count_date" date NOT NULL,
  "count_scope" varchar(30) NOT NULL DEFAULT 'FULL'
);

CREATE TABLE "inv"."stocktake_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "stocktake_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_id" uuid NOT NULL,
  "location_id" uuid,
  "lot_id" uuid,
  "book_quantity" numeric(20,6) NOT NULL,
  "actual_quantity" numeric(20,6) NOT NULL,
  "difference_quantity" numeric(20,6) NOT NULL,
  "book_value" numeric(20,4),
  "difference_value" numeric(20,4)
);

CREATE TABLE "inv"."lot" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "lot_no" varchar(100) NOT NULL,
  "manufacture_date" date,
  "expiry_date" date,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "inv"."serial_number" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "serial_no" varchar(150) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'IN_STOCK',
  "current_warehouse_id" uuid,
  "current_location_id" uuid
);

CREATE TABLE "inv"."stock_movement" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "location_id" uuid,
  "item_id" uuid NOT NULL,
  "lot_id" uuid,
  "source_document_id" uuid NOT NULL,
  "source_line_id" uuid,
  "movement_date" date NOT NULL,
  "movement_type" varchar(30) NOT NULL,
  "quantity_in" numeric(20,6) NOT NULL DEFAULT 0,
  "quantity_out" numeric(20,6) NOT NULL DEFAULT 0,
  "unit_cost" numeric(20,4),
  "value_in" numeric(20,4) NOT NULL DEFAULT 0,
  "value_out" numeric(20,4) NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "inv"."inventory_balance" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "as_of_date" date NOT NULL,
  "quantity_on_hand" numeric(20,6) NOT NULL,
  "inventory_value" numeric(20,4) NOT NULL,
  "average_unit_cost" numeric(20,4),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "inv"."inventory_location_balance" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "as_of_date" date NOT NULL,
  "quantity_on_hand" numeric(20,6) NOT NULL,
  "inventory_value" numeric(20,4) NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "inv"."inventory_lot_balance" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "lot_id" uuid NOT NULL,
  "as_of_date" date NOT NULL,
  "quantity_on_hand" numeric(20,6) NOT NULL,
  "inventory_value" numeric(20,4) NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "inv"."inventory_inspection" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "supplier_id" uuid,
  "inspection_date" date NOT NULL,
  "inspection_result" varchar(30) NOT NULL,
  "inspection_note" text
);

CREATE TABLE "inv"."inventory_inspection_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "inventory_inspection_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "goods_receipt_line_id" uuid,
  "item_id" uuid NOT NULL,
  "uom_id" uuid NOT NULL,
  "inspected_quantity" numeric(20,6) NOT NULL,
  "accepted_quantity" numeric(20,6) NOT NULL,
  "rejected_quantity" numeric(20,6) NOT NULL DEFAULT 0,
  "quality_result" varchar(30) NOT NULL,
  "note" varchar(500)
);

CREATE TABLE "inv"."inventory_costing_run" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "warehouse_id" uuid,
  "costing_method" varchar(30) NOT NULL,
  "run_no" varchar(80) NOT NULL,
  "run_status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "started_by_user_id" uuid NOT NULL,
  "started_at" timestamptz NOT NULL DEFAULT (now()),
  "completed_at" timestamptz
);

CREATE TABLE "inv"."inventory_cost_layer" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "item_id" uuid NOT NULL,
  "lot_id" uuid,
  "source_movement_id" uuid NOT NULL,
  "layer_date" date NOT NULL,
  "original_quantity" numeric(20,6) NOT NULL,
  "remaining_quantity" numeric(20,6) NOT NULL,
  "unit_cost" numeric(20,4) NOT NULL,
  "layer_status" varchar(20) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE "inv"."inventory_cost_allocation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "costing_run_id" uuid NOT NULL,
  "outbound_movement_id" uuid NOT NULL,
  "cost_layer_id" uuid NOT NULL,
  "allocated_quantity" numeric(20,6) NOT NULL,
  "allocated_value" numeric(20,4) NOT NULL
);

CREATE TABLE "fa"."fixed_asset_category" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "default_useful_life_months" integer,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "fa"."depreciation_method" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(150) NOT NULL,
  "method_type" varchar(30) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "fa"."fixed_asset" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "asset_code" varchar(50) NOT NULL,
  "asset_name" varchar(255) NOT NULL,
  "serial_no" varchar(150),
  "department_id" uuid,
  "custodian_employee_id" uuid,
  "acquisition_date" date NOT NULL,
  "in_service_date" date NOT NULL,
  "original_cost" numeric(20,4) NOT NULL,
  "residual_value" numeric(20,4) NOT NULL DEFAULT 0,
  "useful_life_months" integer NOT NULL,
  "depreciation_method_id" uuid NOT NULL,
  "accumulated_depreciation" numeric(20,4) NOT NULL DEFAULT 0,
  "net_book_value" numeric(20,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "fa"."fixed_asset_account_mapping" (
  "asset_id" uuid PRIMARY KEY NOT NULL,
  "asset_account_id" uuid NOT NULL,
  "accum_depr_account_id" uuid NOT NULL,
  "depreciation_expense_account_id" uuid NOT NULL
);

CREATE TABLE "fa"."fixed_asset_acquisition" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL,
  "source_invoice_document_id" uuid,
  "handover_form_no" varchar(100),
  "acquisition_amount" numeric(20,4) NOT NULL
);

CREATE TABLE "fa"."fixed_asset_transfer" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL,
  "from_branch_id" uuid NOT NULL,
  "to_branch_id" uuid NOT NULL,
  "from_department_id" uuid,
  "to_department_id" uuid,
  "transfer_date" date NOT NULL,
  "reason" varchar(500)
);

CREATE TABLE "fa"."fixed_asset_revaluation" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL,
  "revaluation_date" date NOT NULL,
  "old_original_cost" numeric(20,4) NOT NULL,
  "new_original_cost" numeric(20,4) NOT NULL,
  "old_accumulated_depreciation" numeric(20,4) NOT NULL,
  "new_accumulated_depreciation" numeric(20,4) NOT NULL,
  "reason" varchar(500) NOT NULL
);

CREATE TABLE "fa"."fixed_asset_disposal" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL,
  "disposal_date" date NOT NULL,
  "disposal_type" varchar(30) NOT NULL,
  "proceeds_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "disposal_cost" numeric(20,4) NOT NULL DEFAULT 0,
  "reason" varchar(500)
);

CREATE TABLE "fa"."depreciation_schedule" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "asset_id" uuid NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "depreciation_amount" numeric(20,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PLANNED'
);

CREATE TABLE "fa"."depreciation_run" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "run_no" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "journal_entry_id" uuid,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "fa"."depreciation_run_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "depreciation_run_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "depreciation_amount" numeric(20,4) NOT NULL,
  "expense_account_id" uuid NOT NULL,
  "accum_depr_account_id" uuid NOT NULL
);

CREATE TABLE "fa"."fixed_asset_maintenance_completion" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "fixed_asset_id" uuid NOT NULL,
  "vendor_id" uuid,
  "maintenance_type" varchar(30) NOT NULL,
  "work_description" text NOT NULL,
  "started_date" date,
  "completed_date" date NOT NULL,
  "expense_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "capitalized_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "acceptance_result" varchar(30) NOT NULL
);

CREATE TABLE "fa"."fixed_asset_inventory" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "branch_id" uuid NOT NULL,
  "department_id" uuid,
  "inventory_date" date NOT NULL,
  "inventory_scope" varchar(30) NOT NULL DEFAULT 'FULL',
  "conclusion" text
);

CREATE TABLE "fa"."fixed_asset_inventory_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "fixed_asset_inventory_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "fixed_asset_id" uuid NOT NULL,
  "book_status" varchar(30) NOT NULL,
  "actual_status" varchar(30) NOT NULL,
  "book_value" numeric(20,4) NOT NULL,
  "actual_value" numeric(20,4),
  "difference_amount" numeric(20,4),
  "handling_proposal" varchar(500)
);

CREATE TABLE "ccdc"."tool_category" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "default_allocation_months" integer,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "ccdc"."tool" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "quantity" numeric(20,6) NOT NULL,
  "original_value" numeric(20,4) NOT NULL,
  "remaining_value" numeric(20,4) NOT NULL,
  "allocation_months" integer NOT NULL,
  "department_id" uuid,
  "custodian_employee_id" uuid,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "ccdc"."tool_issue" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "tool_id" uuid NOT NULL,
  "department_id" uuid,
  "employee_id" uuid,
  "issue_date" date NOT NULL,
  "quantity" numeric(20,6) NOT NULL
);

CREATE TABLE "ccdc"."tool_transfer" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "tool_id" uuid NOT NULL,
  "from_department_id" uuid,
  "to_department_id" uuid,
  "from_employee_id" uuid,
  "to_employee_id" uuid,
  "transfer_date" date NOT NULL
);

CREATE TABLE "ccdc"."allocation_schedule" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tool_id" uuid NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "allocation_amount" numeric(20,4) NOT NULL,
  "expense_account_id" uuid NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PLANNED'
);

CREATE TABLE "ccdc"."allocation_run" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "run_no" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "journal_entry_id" uuid,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "ccdc"."allocation_run_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "allocation_run_id" uuid NOT NULL,
  "tool_id" uuid NOT NULL,
  "allocation_amount" numeric(20,4) NOT NULL,
  "expense_account_id" uuid NOT NULL,
  "prepaid_account_id" uuid NOT NULL
);

CREATE TABLE "ccdc"."prepaid_expense" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "source_document_id" uuid,
  "original_amount" numeric(20,4) NOT NULL,
  "remaining_amount" numeric(20,4) NOT NULL,
  "start_date" date NOT NULL,
  "allocation_months" integer NOT NULL,
  "prepaid_account_id" uuid NOT NULL,
  "expense_account_id" uuid NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "ccdc"."prepaid_expense_schedule" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "prepaid_expense_id" uuid NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "allocation_amount" numeric(20,4) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PLANNED'
);

CREATE TABLE "tax"."tax_service_provider" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "provider_type" varchar(30) NOT NULL,
  "supports_einvoice" boolean NOT NULL DEFAULT false,
  "supports_tax_filing" boolean NOT NULL DEFAULT false,
  "api_base_url" varchar(500),
  "credential_reference" varchar(255),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "tax"."einvoice_raw_payload" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "provider_id" uuid,
  "external_id" varchar(255),
  "payload_type" varchar(50) NOT NULL,
  "payload_json" jsonb NOT NULL,
  "checksum_sha256" varchar(64),
  "received_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tax"."tax_invoice" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "provider_id" uuid,
  "direction" varchar(10) NOT NULL,
  "invoice_type" varchar(30) NOT NULL,
  "form_symbol" varchar(50),
  "invoice_symbol" varchar(50),
  "invoice_number" varchar(80) NOT NULL,
  "invoice_date" date NOT NULL,
  "seller_tax_code" varchar(30) NOT NULL,
  "seller_name" varchar(255) NOT NULL,
  "buyer_tax_code" varchar(30),
  "buyer_name" varchar(255),
  "currency_id" uuid NOT NULL,
  "exchange_rate" numeric(20,8) NOT NULL DEFAULT 1,
  "amount_before_tax" numeric(20,4) NOT NULL,
  "tax_amount" numeric(20,4) NOT NULL,
  "total_amount" numeric(20,4) NOT NULL,
  "lookup_code" varchar(150),
  "provider_invoice_id" varchar(255),
  "deduplication_key" varchar(255) NOT NULL,
  "invoice_status" varchar(30) NOT NULL,
  "processing_status" varchar(30) NOT NULL DEFAULT 'NEW',
  "raw_payload_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tax"."tax_invoice_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tax_invoice_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "item_name" varchar(500) NOT NULL,
  "uom_name" varchar(100),
  "quantity" numeric(20,6),
  "unit_price" numeric(20,4),
  "amount_before_tax" numeric(20,4) NOT NULL,
  "tax_rate_percent" numeric(9,4),
  "tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "discount_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "tax"."tax_invoice_link" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "source_tax_invoice_id" uuid NOT NULL,
  "target_tax_invoice_id" uuid NOT NULL,
  "link_type" varchar(30) NOT NULL,
  "reason" varchar(500),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tax"."input_invoice_processing" (
  "tax_invoice_id" uuid PRIMARY KEY NOT NULL,
  "vendor_id" uuid,
  "linked_document_id" uuid,
  "accounting_status" varchar(30) NOT NULL DEFAULT 'UNACCOUNTED',
  "deductibility_status" varchar(30) NOT NULL DEFAULT 'PENDING',
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "note" text
);

CREATE TABLE "tax"."invoice_validation_result" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tax_invoice_id" uuid NOT NULL,
  "rule_code" varchar(80) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "result" varchar(20) NOT NULL,
  "message" varchar(1000),
  "checked_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tax"."invoice_risk_check" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tax_invoice_id" uuid NOT NULL,
  "supplier_tax_code" varchar(30) NOT NULL,
  "risk_source" varchar(80) NOT NULL,
  "risk_level" varchar(20) NOT NULL,
  "risk_code" varchar(80),
  "detail" text,
  "checked_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tax"."vat_ledger" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "tax_period_id" uuid NOT NULL,
  "tax_invoice_id" uuid NOT NULL,
  "source_document_id" uuid,
  "direction" varchar(10) NOT NULL,
  "taxable_amount" numeric(20,4) NOT NULL,
  "tax_amount" numeric(20,4) NOT NULL,
  "deductible_tax_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "tax_rate_percent" numeric(9,4),
  "posted_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tax"."tax_period" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "tax_type" varchar(30) NOT NULL,
  "period_code" varchar(20) NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "filing_due_date" date,
  "payment_due_date" date,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE "tax"."tax_declaration" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "tax_period_id" uuid NOT NULL,
  "tax_form_version_id" uuid NOT NULL,
  "declaration_type" varchar(50) NOT NULL,
  "declaration_version" integer NOT NULL DEFAULT 1,
  "submission_type" varchar(30) NOT NULL DEFAULT 'INITIAL',
  "payable_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "refundable_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "carry_forward_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "tax"."tax_declaration_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tax_declaration_id" uuid NOT NULL,
  "tax_form_indicator_id" uuid NOT NULL,
  "indicator_code" varchar(50) NOT NULL,
  "indicator_name_snapshot" varchar(255) NOT NULL,
  "amount" numeric(20,4),
  "text_value" varchar(1000),
  "calculation_detail_json" jsonb
);

CREATE TABLE "tax"."tax_obligation" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "tax_period_id" uuid NOT NULL,
  "tax_type" varchar(30) NOT NULL,
  "source_declaration_id" uuid,
  "assessed_amount" numeric(20,4) NOT NULL,
  "paid_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "remaining_amount" numeric(20,4) NOT NULL,
  "due_date" date NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE "tax"."tax_payment" (
  "document_id" uuid PRIMARY KEY NOT NULL,
  "tax_obligation_id" uuid,
  "tax_type" varchar(30) NOT NULL,
  "payment_reference" varchar(150),
  "payment_date" date NOT NULL,
  "amount" numeric(20,4) NOT NULL,
  "bank_account_id" uuid
);

CREATE TABLE "tax"."tax_submission" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "tax_declaration_id" uuid NOT NULL,
  "submission_no" varchar(100),
  "provider_id" uuid,
  "submitted_at" timestamptz NOT NULL,
  "submitted_by" uuid NOT NULL,
  "status" varchar(30) NOT NULL
);

CREATE TABLE "tax"."tax_submission_response" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "submission_id" uuid NOT NULL,
  "response_code" varchar(100),
  "response_status" varchar(30) NOT NULL,
  "response_message" text,
  "response_payload" jsonb,
  "received_at" timestamptz NOT NULL
);

CREATE TABLE "tax"."einvoice_sync_batch" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "provider_id" uuid NOT NULL,
  "direction" varchar(10) NOT NULL,
  "from_time" timestamptz NOT NULL,
  "to_time" timestamptz NOT NULL,
  "started_at" timestamptz NOT NULL,
  "completed_at" timestamptz,
  "status" varchar(20) NOT NULL,
  "record_count" integer NOT NULL DEFAULT 0,
  "error_count" integer NOT NULL DEFAULT 0
);

CREATE TABLE "tax"."tax_invoice_document_link" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tax_invoice_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "link_type" varchar(30) NOT NULL,
  "allocated_amount_before_tax" numeric(20,4),
  "allocated_tax_amount" numeric(20,4),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "tax"."tax_form_definition" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tax_type" varchar(30) NOT NULL,
  "form_code" varchar(80) NOT NULL,
  "form_name" varchar(255) NOT NULL,
  "legal_basis" varchar(255) NOT NULL,
  "filing_frequency" varchar(30),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "tax"."tax_form_version" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tax_form_definition_id" uuid NOT NULL,
  "version_no" integer NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "schema_version" varchar(50),
  "version_status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_tax_form_version_validity" CHECK (effective_to is null or effective_to >= effective_from)
);

CREATE TABLE "tax"."tax_form_indicator" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tax_form_version_id" uuid NOT NULL,
  "parent_indicator_id" uuid,
  "indicator_code" varchar(50) NOT NULL,
  "indicator_name" varchar(500) NOT NULL,
  "data_type" varchar(30) NOT NULL,
  "calculation_source" varchar(80),
  "display_order" integer NOT NULL,
  "is_required" boolean NOT NULL DEFAULT false
);

CREATE TABLE "tax"."tax_calculation_rule" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "tax_type" varchar(30) NOT NULL,
  "rule_code" varchar(100) NOT NULL,
  "rule_name" varchar(255) NOT NULL,
  "rule_version" integer NOT NULL,
  "implementation_key" varchar(150) NOT NULL,
  "legal_basis" varchar(255) NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "gl"."account_class" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(30) NOT NULL,
  "name" varchar(150) NOT NULL,
  "normal_balance" varchar(10) NOT NULL
);

CREATE TABLE "gl"."account" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "chart_of_accounts_id" uuid NOT NULL,
  "account_class_id" uuid NOT NULL,
  "parent_account_id" uuid,
  "code" varchar(50) NOT NULL,
  "name" varchar(255) NOT NULL,
  "account_level" smallint NOT NULL,
  "account_type" varchar(30) NOT NULL,
  "normal_balance" varchar(10) NOT NULL,
  "statutory_account_code" varchar(50),
  "is_statutory_account" boolean NOT NULL DEFAULT false,
  "is_postable" boolean NOT NULL DEFAULT true,
  "requires_party" boolean NOT NULL DEFAULT false,
  "requires_project" boolean NOT NULL DEFAULT false,
  "requires_cost_center" boolean NOT NULL DEFAULT false,
  "requires_warehouse" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "gl"."fiscal_year" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "year_no" integer NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "ck_fiscal_year_dates" CHECK (end_date >= start_date)
);

CREATE TABLE "gl"."fiscal_period" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "fiscal_year_id" uuid NOT NULL,
  "period_no" smallint NOT NULL,
  "name" varchar(100) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "ck_fiscal_period_dates" CHECK (end_date >= start_date)
);

CREATE TABLE "gl"."period_lock" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "module_code" varchar(30) NOT NULL,
  "lock_status" varchar(20) NOT NULL DEFAULT 'OPEN',
  "locked_by" uuid,
  "locked_at" timestamptz,
  "reason" varchar(500)
);

CREATE TABLE "gl"."journal_entry" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "source_document_id" uuid,
  "posting_batch_id" uuid,
  "journal_no" varchar(80) NOT NULL,
  "journal_type" varchar(30) NOT NULL,
  "posting_version" integer NOT NULL DEFAULT 1,
  "posting_date" date NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "base_currency_id" uuid NOT NULL,
  "description" varchar(1000),
  "journal_status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "reversal_of_journal_entry_id" uuid,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "posted_by_user_id" uuid,
  "posted_at" timestamptz,
  CONSTRAINT "ck_journal_entry_status" CHECK (journal_status in ('DRAFT','POSTED','REVERSED','CANCELLED')),
  CONSTRAINT "ck_journal_entry_posting_version" CHECK (posting_version > 0)
);

CREATE TABLE "gl"."journal_entry_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "journal_entry_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "account_id" uuid NOT NULL,
  "debit_amount_base" numeric(20,4) NOT NULL DEFAULT 0,
  "credit_amount_base" numeric(20,4) NOT NULL DEFAULT 0,
  "transaction_currency_id" uuid NOT NULL,
  "exchange_rate" numeric(20,8) NOT NULL DEFAULT 1,
  "debit_amount_foreign" numeric(20,4) NOT NULL DEFAULT 0,
  "credit_amount_foreign" numeric(20,4) NOT NULL DEFAULT 0,
  "party_id" uuid,
  "project_id" uuid,
  "cost_center_id" uuid,
  "warehouse_id" uuid,
  "tax_rate_id" uuid,
  "description" varchar(1000),
  CONSTRAINT "ck_journal_entry_line_base_nonnegative" CHECK (debit_amount_base >= 0 and credit_amount_base >= 0),
  CONSTRAINT "ck_journal_entry_line_base_one_side" CHECK ((debit_amount_base > 0 and credit_amount_base = 0) or (credit_amount_base > 0 and debit_amount_base = 0)),
  CONSTRAINT "ck_journal_entry_line_foreign_one_side" CHECK (not (debit_amount_foreign > 0 and credit_amount_foreign > 0))
);

CREATE TABLE "gl"."posting_rule" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "document_type_id" uuid NOT NULL,
  "business_subtype" varchar(50),
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "priority" integer NOT NULL DEFAULT 100,
  "condition_json" jsonb,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "gl"."posting_rule_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "posting_rule_id" uuid NOT NULL,
  "line_no" integer NOT NULL,
  "side" varchar(10) NOT NULL,
  "account_source_type" varchar(30) NOT NULL,
  "fixed_account_id" uuid,
  "amount_source" varchar(80) NOT NULL,
  "dimension_rule_json" jsonb,
  "description_template" varchar(500)
);

CREATE TABLE "gl"."posting_batch" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "batch_no" varchar(80) NOT NULL,
  "module_code" varchar(30) NOT NULL,
  "started_at" timestamptz NOT NULL,
  "completed_at" timestamptz,
  "status" varchar(20) NOT NULL,
  "processed_count" integer NOT NULL DEFAULT 0,
  "error_count" integer NOT NULL DEFAULT 0
);

CREATE TABLE "gl"."closing_run" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "run_type" varchar(30) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "journal_entry_id" uuid,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "gl"."closing_run_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "closing_run_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "debit_amount" numeric(20,4) NOT NULL DEFAULT 0,
  "credit_amount" numeric(20,4) NOT NULL DEFAULT 0
);

CREATE TABLE "gl"."chart_of_accounts" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "accounting_regime" varchar(30) NOT NULL DEFAULT 'TT99',
  "effective_from" date NOT NULL,
  "effective_to" date,
  "is_default" boolean NOT NULL DEFAULT false,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "ck_chart_of_accounts_validity" CHECK (effective_to is null or effective_to >= effective_from)
);

CREATE TABLE "gl"."account_opening_balance" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "fiscal_year_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "currency_id" uuid NOT NULL,
  "party_id" uuid,
  "project_id" uuid,
  "cost_center_id" uuid,
  "warehouse_id" uuid,
  "opening_debit_amount_base" numeric(20,4) NOT NULL DEFAULT 0,
  "opening_credit_amount_base" numeric(20,4) NOT NULL DEFAULT 0,
  "opening_debit_amount_foreign" numeric(20,4) NOT NULL DEFAULT 0,
  "opening_credit_amount_foreign" numeric(20,4) NOT NULL DEFAULT 0,
  "dimension_key" varchar(255) NOT NULL,
  "imported_from" varchar(100),
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "gl"."account_balance" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "opening_debit" numeric(20,4) NOT NULL DEFAULT 0,
  "opening_credit" numeric(20,4) NOT NULL DEFAULT 0,
  "period_debit" numeric(20,4) NOT NULL DEFAULT 0,
  "period_credit" numeric(20,4) NOT NULL DEFAULT 0,
  "closing_debit" numeric(20,4) NOT NULL DEFAULT 0,
  "closing_credit" numeric(20,4) NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "gl"."account_dimension_balance" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "dimension_key" varchar(255) NOT NULL,
  "party_id" uuid,
  "project_id" uuid,
  "cost_center_id" uuid,
  "warehouse_id" uuid,
  "opening_debit" numeric(20,4) NOT NULL DEFAULT 0,
  "opening_credit" numeric(20,4) NOT NULL DEFAULT 0,
  "period_debit" numeric(20,4) NOT NULL DEFAULT 0,
  "period_credit" numeric(20,4) NOT NULL DEFAULT 0,
  "closing_debit" numeric(20,4) NOT NULL DEFAULT 0,
  "closing_credit" numeric(20,4) NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "gl"."foreign_currency_revaluation_run" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "revaluation_date" date NOT NULL,
  "rate_type_id" uuid NOT NULL,
  "run_no" varchar(80) NOT NULL,
  "run_status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "journal_entry_id" uuid,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "gl"."foreign_currency_revaluation_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "revaluation_run_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "party_id" uuid,
  "currency_id" uuid NOT NULL,
  "foreign_balance" numeric(20,4) NOT NULL,
  "old_base_balance" numeric(20,4) NOT NULL,
  "new_exchange_rate" numeric(20,8) NOT NULL,
  "new_base_balance" numeric(20,4) NOT NULL,
  "exchange_difference" numeric(20,4) NOT NULL
);

CREATE TABLE "report"."report_definition" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "module_code" varchar(30) NOT NULL,
  "report_type" varchar(30) NOT NULL,
  "data_source" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "report"."report_parameter" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "report_definition_id" uuid NOT NULL,
  "parameter_code" varchar(80) NOT NULL,
  "parameter_name" varchar(255) NOT NULL,
  "data_type" varchar(30) NOT NULL,
  "required" boolean NOT NULL DEFAULT false,
  "default_value_json" jsonb,
  "display_order" integer NOT NULL DEFAULT 0
);

CREATE TABLE "report"."saved_report" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "report_definition_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "parameter_values_json" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "report"."financial_statement_template" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "statement_type" varchar(30) NOT NULL,
  "legal_form_code" varchar(50) NOT NULL,
  "legal_basis" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "report"."financial_statement_template_version" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "template_id" uuid NOT NULL,
  "version_no" integer NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "version_status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_financial_statement_template_version_validity" CHECK (effective_to is null or effective_to >= effective_from)
);

CREATE TABLE "report"."financial_statement_line" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "template_version_id" uuid NOT NULL,
  "parent_line_id" uuid,
  "line_no" integer NOT NULL,
  "indicator_code" varchar(50) NOT NULL,
  "indicator_name" varchar(500) NOT NULL,
  "line_type" varchar(30) NOT NULL,
  "formula_expression" text,
  "display_order" integer NOT NULL,
  "is_required" boolean NOT NULL DEFAULT true
);

CREATE TABLE "report"."financial_statement_account_mapping" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "statement_line_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "mapping_side" varchar(20) NOT NULL,
  "sign_multiplier" numeric(9,4) NOT NULL DEFAULT 1,
  "condition_json" jsonb,
  "effective_from" date NOT NULL,
  "effective_to" date
);

CREATE TABLE "report"."financial_statement_run" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "branch_id" uuid,
  "reporting_scope" varchar(20) NOT NULL DEFAULT 'COMPANY',
  "template_version_id" uuid NOT NULL,
  "fiscal_period_id" uuid NOT NULL,
  "reporting_currency_id" uuid NOT NULL,
  "run_type" varchar(30) NOT NULL,
  "run_status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "generated_by_user_id" uuid NOT NULL,
  "generated_at" timestamptz NOT NULL DEFAULT (now()),
  "approved_by_user_id" uuid,
  "approved_at" timestamptz,
  CONSTRAINT "ck_financial_statement_run_scope" CHECK (reporting_scope in ('COMPANY','BRANCH'))
);

CREATE TABLE "report"."financial_statement_value" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "statement_run_id" uuid NOT NULL,
  "statement_line_id" uuid NOT NULL,
  "current_period_amount" numeric(20,4),
  "comparative_period_amount" numeric(20,4),
  "text_value" text,
  "calculation_detail_json" jsonb
);

CREATE TABLE "report"."accounting_book_template" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "code" varchar(80) NOT NULL,
  "name" varchar(255) NOT NULL,
  "book_type" varchar(50) NOT NULL,
  "legal_form_code" varchar(50),
  "legal_basis" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "report"."accounting_book_template_version" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "accounting_book_template_id" uuid NOT NULL,
  "version_no" integer NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "layout_definition_json" jsonb NOT NULL,
  "version_status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  CONSTRAINT "ck_accounting_book_template_version_validity" CHECK (effective_to is null or effective_to >= effective_from)
);

CREATE TABLE "report"."financial_statement_adjustment" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "statement_run_id" uuid NOT NULL,
  "statement_line_id" uuid NOT NULL,
  "branch_id" uuid,
  "adjustment_type" varchar(30) NOT NULL,
  "adjustment_amount" numeric(20,4) NOT NULL,
  "reason" varchar(1000) NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "approved_by_user_id" uuid,
  "approved_at" timestamptz
);

CREATE TABLE "integration"."outbox_event" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid,
  "aggregate_type" varchar(100) NOT NULL,
  "aggregate_id" uuid,
  "event_type" varchar(150) NOT NULL,
  "payload_json" jsonb NOT NULL,
  "occurred_at" timestamptz NOT NULL DEFAULT (now()),
  "published_at" timestamptz,
  "retry_count" integer NOT NULL DEFAULT 0
);

CREATE TABLE "integration"."inbox_message" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "source_system" varchar(100) NOT NULL,
  "message_id" varchar(255) NOT NULL,
  "message_type" varchar(150) NOT NULL,
  "payload_json" jsonb NOT NULL,
  "received_at" timestamptz NOT NULL DEFAULT (now()),
  "processed_at" timestamptz,
  "status" varchar(20) NOT NULL DEFAULT 'RECEIVED'
);

CREATE TABLE "integration"."api_client" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid,
  "client_code" varchar(80) NOT NULL,
  "client_name" varchar(255) NOT NULL,
  "client_secret_hash" varchar(255) NOT NULL,
  "allowed_scopes_json" jsonb NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "integration"."webhook_delivery" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid,
  "webhook_subscription_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "target_url" varchar(1000) NOT NULL,
  "attempt_no" integer NOT NULL,
  "request_body" jsonb NOT NULL,
  "response_status" integer,
  "response_body" text,
  "delivered_at" timestamptz,
  "next_retry_at" timestamptz
);

CREATE TABLE "integration"."idempotency_key" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid,
  "client_id" uuid NOT NULL,
  "idempotency_key" varchar(255) NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "response_status" integer,
  "response_body" jsonb,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "integration"."external_mapping" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "external_system" varchar(100) NOT NULL,
  "entity_type" varchar(100) NOT NULL,
  "internal_id" uuid NOT NULL,
  "external_id" varchar(255) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "integration"."import_job" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "module_code" varchar(30) NOT NULL,
  "import_type" varchar(80) NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "storage_key" varchar(500) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "total_rows" integer NOT NULL DEFAULT 0,
  "success_rows" integer NOT NULL DEFAULT 0,
  "error_rows" integer NOT NULL DEFAULT 0,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "completed_at" timestamptz
);

CREATE TABLE "integration"."import_row_error" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "import_job_id" uuid NOT NULL,
  "row_no" integer NOT NULL,
  "field_name" varchar(150),
  "error_code" varchar(80) NOT NULL,
  "error_message" varchar(1000) NOT NULL,
  "raw_row_json" jsonb
);

CREATE TABLE "integration"."webhook_subscription" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "event_type" varchar(150) NOT NULL,
  "target_url" varchar(1000) NOT NULL,
  "secret_reference" varchar(255),
  "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "integration"."sync_checkpoint" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT (gen_random_uuid()),
  "company_id" uuid NOT NULL,
  "external_system" varchar(100) NOT NULL,
  "sync_scope" varchar(100) NOT NULL,
  "checkpoint_value" varchar(1000),
  "last_successful_sync_at" timestamptz,
  "last_attempt_at" timestamptz,
  "status" varchar(20) NOT NULL DEFAULT 'READY',
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE UNIQUE INDEX "uq_company_code" ON "org"."company" ("code");

CREATE UNIQUE INDEX "uq_company_tax_code" ON "org"."company" ("tax_code");

CREATE INDEX "idx_company_status" ON "org"."company" ("status");

CREATE INDEX "idx_company_accounting_currency_id" ON "org"."company" ("accounting_currency_id");

CREATE INDEX "idx_company_legal_reporting_currency_id" ON "org"."company" ("legal_reporting_currency_id");

CREATE UNIQUE INDEX "uq_branch_company_code" ON "org"."branch" ("company_id", "code");

CREATE INDEX "idx_branch_company_status" ON "org"."branch" ("company_id", "status");

CREATE INDEX "idx_branch_parent" ON "org"."branch" ("parent_branch_id");

CREATE UNIQUE INDEX "uq_department_company_code" ON "org"."department" ("company_id", "code");

CREATE INDEX "idx_department_branch_status" ON "org"."department" ("branch_id", "status");

CREATE INDEX "idx_department_parent" ON "org"."department" ("parent_department_id");

CREATE INDEX "idx_department_manager_employee_id" ON "org"."department" ("manager_employee_id");

CREATE UNIQUE INDEX "uq_position_company_code" ON "org"."position" ("company_id", "code");

CREATE UNIQUE INDEX "uq_employee_company_code" ON "org"."employee" ("company_id", "employee_code");

CREATE INDEX "idx_employee_org_status" ON "org"."employee" ("branch_id", "department_id", "status");

CREATE INDEX "idx_employee_email" ON "org"."employee" ("email");

CREATE INDEX "idx_employee_department_id" ON "org"."employee" ("department_id");

CREATE INDEX "idx_employee_position_id" ON "org"."employee" ("position_id");

CREATE UNIQUE INDEX "uq_employee_assignment_version" ON "org"."employee_assignment" ("employee_id", "valid_from");

CREATE INDEX "idx_employee_assignment_org" ON "org"."employee_assignment" ("branch_id", "department_id", "valid_from");

CREATE INDEX "idx_employee_assignment_department_id" ON "org"."employee_assignment" ("department_id");

CREATE INDEX "idx_employee_assignment_position_id" ON "org"."employee_assignment" ("position_id");

CREATE UNIQUE INDEX "uq_user_account_username" ON "iam"."user_account" ("username");

CREATE UNIQUE INDEX "uq_user_account_email" ON "iam"."user_account" ("email");

CREATE INDEX "idx_user_account_status" ON "iam"."user_account" ("status");

CREATE UNIQUE INDEX "uq_identity_provider_subject" ON "iam"."user_identity" ("provider", "provider_subject");

CREATE INDEX "idx_identity_user" ON "iam"."user_identity" ("user_id");

CREATE INDEX "idx_session_user_expiry" ON "iam"."user_session" ("user_id", "expires_at");

CREATE UNIQUE INDEX "uq_session_refresh_hash" ON "iam"."user_session" ("refresh_token_hash");

CREATE UNIQUE INDEX "uq_role_company_code" ON "iam"."role" ("company_id", "code");

CREATE INDEX "idx_role_company_status" ON "iam"."role" ("company_id", "status");

CREATE UNIQUE INDEX "uq_permission_resource_code" ON "iam"."permission_resource" ("code");

CREATE INDEX "idx_permission_resource_module" ON "iam"."permission_resource" ("module_code", "status");

CREATE UNIQUE INDEX "uq_permission_action_code" ON "iam"."permission_action" ("code");

CREATE UNIQUE INDEX "uq_permission_resource_action" ON "iam"."permission" ("resource_id", "action_id");

CREATE UNIQUE INDEX "uq_permission_code" ON "iam"."permission" ("code");

CREATE INDEX "idx_permission_action_id" ON "iam"."permission" ("action_id");

CREATE INDEX "idx_role_permission_permission" ON "iam"."role_permission" ("permission_id");

CREATE UNIQUE INDEX "uq_user_role_assignment_version" ON "iam"."user_role_assignment" ("company_membership_id", "role_id", "valid_from");

CREATE INDEX "idx_user_role_assignment_membership_status" ON "iam"."user_role_assignment" ("company_membership_id", "status");

CREATE INDEX "idx_user_role_assignment_role_status" ON "iam"."user_role_assignment" ("role_id", "status");

CREATE INDEX "idx_user_role_assignment_scope" ON "iam"."user_role_assignment" ("data_scope_set_id");

CREATE INDEX "idx_user_role_assignment_assigned_by_user_id" ON "iam"."user_role_assignment" ("assigned_by_user_id");

CREATE INDEX "idx_user_role_assignment_revoked_by_user_id" ON "iam"."user_role_assignment" ("revoked_by_user_id");

CREATE UNIQUE INDEX "uq_permission_bundle_code" ON "iam"."permission_bundle" ("code");

CREATE INDEX "idx_permission_bundle_item_permission_id" ON "iam"."permission_bundle_item" ("permission_id");

CREATE INDEX "idx_role_permission_bundle_bundle_id" ON "iam"."role_permission_bundle" ("bundle_id");

CREATE UNIQUE INDEX "uq_company_membership_company_user" ON "iam"."company_membership" ("company_id", "user_id");

CREATE UNIQUE INDEX "uq_company_membership_company_employee" ON "iam"."company_membership" ("company_id", "employee_id");

CREATE INDEX "idx_company_membership_status" ON "iam"."company_membership" ("company_id", "membership_status");

CREATE INDEX "idx_company_membership_created_by_user_id" ON "iam"."company_membership" ("created_by_user_id");

CREATE INDEX "idx_company_membership_employee_id" ON "iam"."company_membership" ("employee_id");

CREATE INDEX "idx_company_membership_user_id" ON "iam"."company_membership" ("user_id");

CREATE UNIQUE INDEX "uq_data_scope_set_company_code" ON "iam"."data_scope_set" ("company_id", "code");

CREATE INDEX "idx_data_scope_set_status" ON "iam"."data_scope_set" ("company_id", "status");

CREATE INDEX "idx_data_scope_set_created_by_user_id" ON "iam"."data_scope_set" ("created_by_user_id");

CREATE INDEX "idx_data_scope_branch_branch_id" ON "iam"."data_scope_branch" ("branch_id");

CREATE INDEX "idx_data_scope_department_department_id" ON "iam"."data_scope_department" ("department_id");

CREATE INDEX "idx_data_scope_warehouse_warehouse_id" ON "iam"."data_scope_warehouse" ("warehouse_id");

CREATE INDEX "idx_data_scope_bank_account_company_bank_account_id" ON "iam"."data_scope_bank_account" ("company_bank_account_id");

CREATE INDEX "idx_data_scope_project_project_id" ON "iam"."data_scope_project" ("project_id");

CREATE INDEX "idx_data_scope_cost_center_cost_center_id" ON "iam"."data_scope_cost_center" ("cost_center_id");

CREATE UNIQUE INDEX "uq_sod_rule_company_code" ON "iam"."segregation_of_duties_rule" ("company_id", "code");

CREATE INDEX "idx_sod_rule_resource_status" ON "iam"."segregation_of_duties_rule" ("company_id", "resource_code", "status");

CREATE INDEX "idx_segregation_of_duties_rule_created_by_user_id" ON "iam"."segregation_of_duties_rule" ("created_by_user_id");

CREATE INDEX "idx_sod_violation_status" ON "iam"."segregation_of_duties_violation" ("company_id", "resolution_status", "detected_at");

CREATE INDEX "idx_sod_violation_rule_user" ON "iam"."segregation_of_duties_violation" ("rule_id", "user_id", "detected_at");

CREATE INDEX "idx_segregation_of_duties_violation_document_id" ON "iam"."segregation_of_duties_violation" ("document_id");

CREATE INDEX "idx_segregation_of_duties_violation_overridden_by_user_id" ON "iam"."segregation_of_duties_violation" ("overridden_by_user_id");

CREATE INDEX "idx_segregation_of_duties_violation_user_id" ON "iam"."segregation_of_duties_violation" ("user_id");

CREATE UNIQUE INDEX "uq_approval_workflow_company_code" ON "workflow"."approval_workflow" ("company_id", "code");

CREATE INDEX "idx_approval_workflow_selector" ON "workflow"."approval_workflow" ("company_id", "document_type_id", "status", "priority");

CREATE INDEX "idx_approval_workflow_created_by_user_id" ON "workflow"."approval_workflow" ("created_by_user_id");

CREATE INDEX "idx_approval_workflow_document_type_id" ON "workflow"."approval_workflow" ("document_type_id");

CREATE INDEX "idx_approval_workflow_updated_by_user_id" ON "workflow"."approval_workflow" ("updated_by_user_id");

CREATE UNIQUE INDEX "uq_approval_workflow_version" ON "workflow"."approval_workflow_version" ("approval_workflow_id", "version_no");

CREATE INDEX "idx_approval_workflow_version_effective" ON "workflow"."approval_workflow_version" ("approval_workflow_id", "version_status", "effective_from");

CREATE INDEX "idx_approval_workflow_version_created_by_user_id" ON "workflow"."approval_workflow_version" ("created_by_user_id");

CREATE INDEX "idx_approval_workflow_version_published_by_user_id" ON "workflow"."approval_workflow_version" ("published_by_user_id");

CREATE UNIQUE INDEX "uq_approval_step_no" ON "workflow"."approval_step" ("approval_workflow_version_id", "step_no");

CREATE INDEX "idx_approval_step_assignee" ON "workflow"."approval_step_assignee" ("approval_step_id", "assignee_type", "user_id", "role_id", "branch_id");

CREATE INDEX "idx_approval_step_assignee_user" ON "workflow"."approval_step_assignee" ("user_id");

CREATE INDEX "idx_approval_step_assignee_role" ON "workflow"."approval_step_assignee" ("role_id");

CREATE INDEX "idx_approval_step_assignee_branch_id" ON "workflow"."approval_step_assignee" ("branch_id");

CREATE INDEX "idx_approval_condition_priority" ON "workflow"."approval_condition" ("approval_workflow_version_id", "priority");

CREATE INDEX "idx_approval_instance_document" ON "workflow"."approval_instance" ("document_id", "instance_status");

CREATE INDEX "idx_approval_instance_company" ON "workflow"."approval_instance" ("company_id", "instance_status", "started_at");

CREATE INDEX "idx_approval_instance_approval_workflow_version_id" ON "workflow"."approval_instance" ("approval_workflow_version_id");

CREATE INDEX "idx_approval_instance_submitted_by_user_id" ON "workflow"."approval_instance" ("submitted_by_user_id");

CREATE INDEX "idx_approval_task_user" ON "workflow"."approval_task" ("assigned_user_id", "task_status", "due_at");

CREATE INDEX "idx_approval_task_role" ON "workflow"."approval_task" ("assigned_role_id", "task_status", "due_at");

CREATE INDEX "idx_approval_task_instance" ON "workflow"."approval_task" ("approval_instance_id", "task_status");

CREATE INDEX "idx_approval_task_acted_by_user_id" ON "workflow"."approval_task" ("acted_by_user_id");

CREATE INDEX "idx_approval_task_approval_step_id" ON "workflow"."approval_task" ("approval_step_id");

CREATE INDEX "idx_approval_action_instance" ON "workflow"."approval_action_log" ("approval_instance_id", "acted_at");

CREATE INDEX "idx_approval_action_log_actor_user_id" ON "workflow"."approval_action_log" ("actor_user_id");

CREATE INDEX "idx_approval_action_log_approval_task_id" ON "workflow"."approval_action_log" ("approval_task_id");

CREATE INDEX "idx_approval_delegation_delegator" ON "workflow"."approval_delegation" ("company_id", "delegator_user_id", "valid_from", "valid_to");

CREATE INDEX "idx_approval_delegation_delegate" ON "workflow"."approval_delegation" ("company_id", "delegate_user_id", "status");

CREATE INDEX "idx_approval_delegation_branch_id" ON "workflow"."approval_delegation" ("branch_id");

CREATE INDEX "idx_approval_delegation_created_by_user_id" ON "workflow"."approval_delegation" ("created_by_user_id");

CREATE INDEX "idx_approval_delegation_delegate_user_id" ON "workflow"."approval_delegation" ("delegate_user_id");

CREATE INDEX "idx_approval_delegation_delegator_user_id" ON "workflow"."approval_delegation" ("delegator_user_id");

CREATE INDEX "idx_approval_delegation_document_type_id" ON "workflow"."approval_delegation" ("document_type_id");

CREATE INDEX "idx_audit_log_company_time" ON "audit"."audit_log" ("company_id", "occurred_at");

CREATE INDEX "idx_audit_log_actor_time" ON "audit"."audit_log" ("company_id", "actor_user_id", "occurred_at");

CREATE INDEX "idx_audit_log_entity" ON "audit"."audit_log" ("entity_type", "entity_id", "occurred_at");

CREATE INDEX "idx_audit_log_document" ON "audit"."audit_log" ("document_id", "occurred_at");

CREATE INDEX "idx_audit_log_actor_user_id" ON "audit"."audit_log" ("actor_user_id");

CREATE INDEX "idx_audit_log_role_assignment_id" ON "audit"."audit_log" ("role_assignment_id");

CREATE INDEX "idx_audit_change_log" ON "audit"."audit_change" ("audit_log_id");

CREATE INDEX "idx_login_log_user_time" ON "audit"."login_log" ("user_id", "occurred_at");

CREATE INDEX "idx_login_log_result_time" ON "audit"."login_log" ("login_result", "occurred_at");

CREATE INDEX "idx_data_export_log_user_time" ON "audit"."data_export_log" ("company_id", "user_id", "occurred_at");

CREATE INDEX "idx_data_export_log_user_id" ON "audit"."data_export_log" ("user_id");

CREATE INDEX "idx_security_event_severity_time" ON "audit"."security_event" ("severity", "occurred_at");

CREATE INDEX "idx_security_event_user_time" ON "audit"."security_event" ("company_id", "user_id", "occurred_at");

CREATE INDEX "idx_security_event_user_id" ON "audit"."security_event" ("user_id");

CREATE UNIQUE INDEX "uq_currency_code" ON "mdm"."currency" ("code");

CREATE UNIQUE INDEX "uq_exchange_rate_type" ON "mdm"."exchange_rate_type" ("company_id", "code");

CREATE UNIQUE INDEX "uq_exchange_rate" ON "mdm"."exchange_rate" ("company_id", "rate_type_id", "from_currency_id", "to_currency_id", "effective_date");

CREATE INDEX "idx_exchange_rate_date" ON "mdm"."exchange_rate" ("company_id", "effective_date");

CREATE INDEX "idx_exchange_rate_from_currency_id" ON "mdm"."exchange_rate" ("from_currency_id");

CREATE INDEX "idx_exchange_rate_rate_type_id" ON "mdm"."exchange_rate" ("rate_type_id");

CREATE INDEX "idx_exchange_rate_source_bank_id" ON "mdm"."exchange_rate" ("source_bank_id");

CREATE INDEX "idx_exchange_rate_to_currency_id" ON "mdm"."exchange_rate" ("to_currency_id");

CREATE UNIQUE INDEX "uq_payment_term" ON "mdm"."payment_term" ("company_id", "code");

CREATE UNIQUE INDEX "uq_tax_rate_version" ON "mdm"."tax_rate" ("company_id", "code", "effective_from");

CREATE INDEX "idx_tax_rate_type" ON "mdm"."tax_rate" ("company_id", "tax_type", "status");

CREATE UNIQUE INDEX "uq_project" ON "mdm"."project" ("company_id", "code");

CREATE UNIQUE INDEX "uq_cost_center" ON "mdm"."cost_center" ("company_id", "code");

CREATE INDEX "idx_cost_center_parent" ON "mdm"."cost_center" ("parent_id");

CREATE UNIQUE INDEX "uq_party_company_code" ON "mdm"."party" ("company_id", "code");

CREATE UNIQUE INDEX "uq_party_company_tax_code" ON "mdm"."party" ("company_id", "tax_code");

CREATE INDEX "idx_party_name" ON "mdm"."party" ("company_id", "name");

CREATE INDEX "idx_party_default_currency_id" ON "mdm"."party" ("default_currency_id");

CREATE INDEX "idx_party_payment_term_id" ON "mdm"."party" ("payment_term_id");

CREATE INDEX "idx_party_address_type" ON "mdm"."party_address" ("party_id", "address_type");

CREATE UNIQUE INDEX "uq_bank_code" ON "mdm"."bank" ("code");

CREATE UNIQUE INDEX "uq_party_bank_account" ON "mdm"."party_bank_account" ("party_id", "account_number");

CREATE INDEX "idx_party_bank_account_bank_id" ON "mdm"."party_bank_account" ("bank_id");

CREATE UNIQUE INDEX "uq_item_category" ON "mdm"."item_category" ("company_id", "code");

CREATE INDEX "idx_item_category_parent" ON "mdm"."item_category" ("parent_id");

CREATE UNIQUE INDEX "uq_uom" ON "mdm"."unit_of_measure" ("company_id", "code");

CREATE UNIQUE INDEX "uq_item" ON "mdm"."item" ("company_id", "code");

CREATE INDEX "idx_item_category_status" ON "mdm"."item" ("company_id", "category_id", "status");

CREATE INDEX "idx_item_base_uom_id" ON "mdm"."item" ("base_uom_id");

CREATE INDEX "idx_item_category_id" ON "mdm"."item" ("category_id");

CREATE INDEX "idx_item_default_tax_rate_id" ON "mdm"."item" ("default_tax_rate_id");

CREATE UNIQUE INDEX "uq_item_uom_conversion" ON "mdm"."item_uom_conversion" ("item_id", "from_uom_id", "to_uom_id");

CREATE INDEX "idx_item_uom_conversion_from_uom_id" ON "mdm"."item_uom_conversion" ("from_uom_id");

CREATE INDEX "idx_item_uom_conversion_to_uom_id" ON "mdm"."item_uom_conversion" ("to_uom_id");

CREATE UNIQUE INDEX "uq_warehouse" ON "mdm"."warehouse" ("company_id", "code");

CREATE INDEX "idx_warehouse_branch_status" ON "mdm"."warehouse" ("branch_id", "status");

CREATE INDEX "idx_warehouse_keeper_employee_id" ON "mdm"."warehouse" ("keeper_employee_id");

CREATE UNIQUE INDEX "uq_inventory_location" ON "mdm"."inventory_location" ("warehouse_id", "code");

CREATE INDEX "idx_inventory_location_parent_id" ON "mdm"."inventory_location" ("parent_id");

CREATE UNIQUE INDEX "uq_company_bank_account" ON "mdm"."company_bank_account" ("company_id", "account_number");

CREATE INDEX "idx_company_bank_branch" ON "mdm"."company_bank_account" ("branch_id", "status");

CREATE INDEX "idx_company_bank_account_bank_id" ON "mdm"."company_bank_account" ("bank_id");

CREATE INDEX "idx_company_bank_account_currency_id" ON "mdm"."company_bank_account" ("currency_id");

CREATE INDEX "idx_company_bank_account_gl_account_id" ON "mdm"."company_bank_account" ("gl_account_id");

CREATE UNIQUE INDEX "uq_document_type_code" ON "mdm"."document_type" ("code");

CREATE INDEX "idx_document_type_module_class" ON "mdm"."document_type" ("module_code", "document_class", "status");

CREATE UNIQUE INDEX "uq_document_numbering_rule_code" ON "mdm"."document_numbering_rule" ("company_id", "code");

CREATE INDEX "idx_document_numbering_rule_scope" ON "mdm"."document_numbering_rule" ("company_id", "document_type_id", "branch_id", "effective_from");

CREATE INDEX "idx_document_numbering_rule_branch_id" ON "mdm"."document_numbering_rule" ("branch_id");

CREATE INDEX "idx_document_numbering_rule_document_type_id" ON "mdm"."document_numbering_rule" ("document_type_id");

CREATE INDEX "idx_party_contact_type" ON "mdm"."party_contact" ("party_id", "contact_type", "status");

CREATE INDEX "idx_customer_profile_receivable_account_id" ON "mdm"."customer_profile" ("receivable_account_id");

CREATE INDEX "idx_customer_profile_revenue_account_id" ON "mdm"."customer_profile" ("revenue_account_id");

CREATE INDEX "idx_vendor_profile_expense_account_id" ON "mdm"."vendor_profile" ("expense_account_id");

CREATE INDEX "idx_vendor_profile_payable_account_id" ON "mdm"."vendor_profile" ("payable_account_id");

CREATE INDEX "idx_vendor_profile_purchase_account_id" ON "mdm"."vendor_profile" ("purchase_account_id");

CREATE UNIQUE INDEX "uq_business_document_no" ON "core"."business_document" ("company_id", "branch_id", "document_type_id", "fiscal_year", "document_no");

CREATE INDEX "idx_business_document_type_date" ON "core"."business_document" ("company_id", "document_type_id", "document_date");

CREATE INDEX "idx_business_document_branch_status_date" ON "core"."business_document" ("company_id", "branch_id", "document_status", "document_date");

CREATE INDEX "idx_business_document_counterparty" ON "core"."business_document" ("counterparty_id");

CREATE INDEX "idx_business_document_posting_date" ON "core"."business_document" ("posting_date");

CREATE INDEX "idx_business_document_branch_id" ON "core"."business_document" ("branch_id");

CREATE INDEX "idx_business_document_cost_center_id" ON "core"."business_document" ("cost_center_id");

CREATE INDEX "idx_business_document_created_by_user_id" ON "core"."business_document" ("created_by_user_id");

CREATE INDEX "idx_business_document_currency_id" ON "core"."business_document" ("currency_id");

CREATE INDEX "idx_business_document_document_type_id" ON "core"."business_document" ("document_type_id");

CREATE INDEX "idx_business_document_project_id" ON "core"."business_document" ("project_id");

CREATE INDEX "idx_business_document_updated_by_user_id" ON "core"."business_document" ("updated_by_user_id");

CREATE INDEX "idx_document_status_history" ON "core"."document_status_history" ("document_id", "changed_at");

CREATE INDEX "idx_document_status_history_changed_by" ON "core"."document_status_history" ("changed_by");

CREATE UNIQUE INDEX "uq_document_link" ON "core"."document_link" ("source_document_id", "target_document_id", "link_type");

CREATE INDEX "idx_document_link_source" ON "core"."document_link" ("source_document_id");

CREATE INDEX "idx_document_link_target" ON "core"."document_link" ("target_document_id");

CREATE INDEX "idx_document_link_company_id" ON "core"."document_link" ("company_id");

CREATE INDEX "idx_document_link_created_by_user_id" ON "core"."document_link" ("created_by_user_id");

CREATE INDEX "idx_document_attachment" ON "core"."document_attachment" ("document_id", "uploaded_at");

CREATE INDEX "idx_document_attachment_uploaded_by" ON "core"."document_attachment" ("uploaded_by");

CREATE UNIQUE INDEX "uq_document_reference" ON "core"."document_reference" ("document_id", "reference_type", "reference_no");

CREATE INDEX "idx_document_signature" ON "core"."document_signature" ("document_id", "signed_at");

CREATE INDEX "idx_document_signature_rendered_output_id" ON "core"."document_signature" ("rendered_output_id");

CREATE INDEX "idx_document_signature_signer_user_id" ON "core"."document_signature" ("signer_user_id");

CREATE UNIQUE INDEX "uq_document_template_code" ON "core"."document_template" ("company_id", "code");

CREATE INDEX "idx_document_template_document_type_id" ON "core"."document_template" ("document_type_id");

CREATE UNIQUE INDEX "uq_document_template_version" ON "core"."document_template_version" ("template_id", "version_no");

CREATE UNIQUE INDEX "uq_document_lock_token" ON "core"."document_lock" ("lock_token");

CREATE INDEX "idx_document_lock_user" ON "core"."document_lock" ("locked_by_user_id", "expires_at");

CREATE UNIQUE INDEX "uq_configuration_definition_key" ON "core"."configuration_definition" ("configuration_key");

CREATE INDEX "idx_configuration_definition_group" ON "core"."configuration_definition" ("configuration_group", "status");

CREATE UNIQUE INDEX "uq_company_configuration_version" ON "core"."company_configuration_value" ("company_id", "configuration_scope_key", "configuration_definition_id", "effective_from");

CREATE INDEX "idx_company_configuration_active" ON "core"."company_configuration_value" ("company_id", "configuration_definition_id", "status");

CREATE INDEX "idx_company_configuration_value_branch_id" ON "core"."company_configuration_value" ("branch_id");

CREATE INDEX "idx_company_configuration_value_configuration_definition_id" ON "core"."company_configuration_value" ("configuration_definition_id");

CREATE INDEX "idx_company_configuration_value_created_by_user_id" ON "core"."company_configuration_value" ("created_by_user_id");

CREATE UNIQUE INDEX "uq_document_number_sequence_scope" ON "core"."document_number_sequence" ("company_id", "sequence_scope_key", "fiscal_year");

CREATE INDEX "idx_document_number_sequence_rule" ON "core"."document_number_sequence" ("numbering_rule_id", "fiscal_year");

CREATE INDEX "idx_document_number_sequence_branch_id" ON "core"."document_number_sequence" ("branch_id");

CREATE INDEX "idx_document_number_sequence_document_type_id" ON "core"."document_number_sequence" ("document_type_id");

CREATE INDEX "idx_document_note" ON "core"."document_note" ("document_id", "created_at");

CREATE INDEX "idx_document_note_created_by_user_id" ON "core"."document_note" ("created_by_user_id");

CREATE INDEX "idx_document_rendered_output_document" ON "core"."document_rendered_output" ("document_id", "generated_at");

CREATE INDEX "idx_document_rendered_output_checksum" ON "core"."document_rendered_output" ("checksum_sha256");

CREATE INDEX "idx_document_rendered_output_generated_by_user_id" ON "core"."document_rendered_output" ("generated_by_user_id");

CREATE INDEX "idx_document_rendered_output_template_version_id" ON "core"."document_rendered_output" ("template_version_id");

CREATE INDEX "idx_purchase_request_department_id" ON "pur"."purchase_request" ("department_id");

CREATE INDEX "idx_purchase_request_requester_employee_id" ON "pur"."purchase_request" ("requester_employee_id");

CREATE UNIQUE INDEX "uq_purchase_request_line" ON "pur"."purchase_request_line" ("purchase_request_id", "line_no");

CREATE INDEX "idx_purchase_request_line_cost_center_id" ON "pur"."purchase_request_line" ("cost_center_id");

CREATE INDEX "idx_purchase_request_line_item_id" ON "pur"."purchase_request_line" ("item_id");

CREATE INDEX "idx_purchase_request_line_project_id" ON "pur"."purchase_request_line" ("project_id");

CREATE INDEX "idx_purchase_request_line_uom_id" ON "pur"."purchase_request_line" ("uom_id");

CREATE INDEX "idx_purchase_request_line_warehouse_id" ON "pur"."purchase_request_line" ("warehouse_id");

CREATE INDEX "idx_purchase_order_buyer_employee_id" ON "pur"."purchase_order" ("buyer_employee_id");

CREATE INDEX "idx_purchase_order_payment_term_id" ON "pur"."purchase_order" ("payment_term_id");

CREATE INDEX "idx_purchase_order_vendor_id" ON "pur"."purchase_order" ("vendor_id");

CREATE UNIQUE INDEX "uq_purchase_order_line" ON "pur"."purchase_order_line" ("purchase_order_id", "line_no");

CREATE INDEX "idx_purchase_order_line_contract" ON "pur"."purchase_order_line" ("purchase_contract_line_id");

CREATE INDEX "idx_purchase_order_line_cost_center_id" ON "pur"."purchase_order_line" ("cost_center_id");

CREATE INDEX "idx_purchase_order_line_item_id" ON "pur"."purchase_order_line" ("item_id");

CREATE INDEX "idx_purchase_order_line_project_id" ON "pur"."purchase_order_line" ("project_id");

CREATE INDEX "idx_purchase_order_line_tax_rate_id" ON "pur"."purchase_order_line" ("tax_rate_id");

CREATE INDEX "idx_purchase_order_line_uom_id" ON "pur"."purchase_order_line" ("uom_id");

CREATE INDEX "idx_purchase_order_line_warehouse_id" ON "pur"."purchase_order_line" ("warehouse_id");

CREATE INDEX "idx_goods_receipt_received_by_employee_id" ON "pur"."goods_receipt" ("received_by_employee_id");

CREATE INDEX "idx_goods_receipt_vendor_id" ON "pur"."goods_receipt" ("vendor_id");

CREATE INDEX "idx_goods_receipt_warehouse_id" ON "pur"."goods_receipt" ("warehouse_id");

CREATE UNIQUE INDEX "uq_goods_receipt_line" ON "pur"."goods_receipt_line" ("goods_receipt_id", "line_no");

CREATE INDEX "idx_gr_line_po_line" ON "pur"."goods_receipt_line" ("purchase_order_line_id");

CREATE INDEX "idx_goods_receipt_line_item_id" ON "pur"."goods_receipt_line" ("item_id");

CREATE INDEX "idx_goods_receipt_line_location_id" ON "pur"."goods_receipt_line" ("location_id");

CREATE INDEX "idx_goods_receipt_line_lot_id" ON "pur"."goods_receipt_line" ("lot_id");

CREATE INDEX "idx_goods_receipt_line_uom_id" ON "pur"."goods_receipt_line" ("uom_id");

CREATE INDEX "idx_service_receipt_accepted_by_employee_id" ON "pur"."service_receipt" ("accepted_by_employee_id");

CREATE INDEX "idx_service_receipt_vendor_id" ON "pur"."service_receipt" ("vendor_id");

CREATE UNIQUE INDEX "uq_service_receipt_line" ON "pur"."service_receipt_line" ("service_receipt_id", "line_no");

CREATE INDEX "idx_service_receipt_line_cost_center_id" ON "pur"."service_receipt_line" ("cost_center_id");

CREATE INDEX "idx_service_receipt_line_expense_account_id" ON "pur"."service_receipt_line" ("expense_account_id");

CREATE INDEX "idx_service_receipt_line_project_id" ON "pur"."service_receipt_line" ("project_id");

CREATE INDEX "idx_service_receipt_line_purchase_order_line_id" ON "pur"."service_receipt_line" ("purchase_order_line_id");

CREATE INDEX "idx_purchase_invoice_payment_term_id" ON "pur"."purchase_invoice" ("payment_term_id");

CREATE INDEX "idx_purchase_invoice_vendor_id" ON "pur"."purchase_invoice" ("vendor_id");

CREATE UNIQUE INDEX "uq_purchase_invoice_line" ON "pur"."purchase_invoice_line" ("purchase_invoice_id", "line_no");

CREATE INDEX "idx_purchase_invoice_line_ap_account_id" ON "pur"."purchase_invoice_line" ("ap_account_id");

CREATE INDEX "idx_purchase_invoice_line_cost_center_id" ON "pur"."purchase_invoice_line" ("cost_center_id");

CREATE INDEX "idx_purchase_invoice_line_expense_or_inventory_account_id" ON "pur"."purchase_invoice_line" ("expense_or_inventory_account_id");

CREATE INDEX "idx_purchase_invoice_line_item_id" ON "pur"."purchase_invoice_line" ("item_id");

CREATE INDEX "idx_purchase_invoice_line_project_id" ON "pur"."purchase_invoice_line" ("project_id");

CREATE INDEX "idx_purchase_invoice_line_tax_rate_id" ON "pur"."purchase_invoice_line" ("tax_rate_id");

CREATE INDEX "idx_purchase_invoice_line_uom_id" ON "pur"."purchase_invoice_line" ("uom_id");

CREATE INDEX "idx_purchase_return_vendor_id" ON "pur"."purchase_return" ("vendor_id");

CREATE INDEX "idx_purchase_return_warehouse_id" ON "pur"."purchase_return" ("warehouse_id");

CREATE UNIQUE INDEX "uq_purchase_return_line" ON "pur"."purchase_return_line" ("purchase_return_id", "line_no");

CREATE INDEX "idx_purchase_return_line_item_id" ON "pur"."purchase_return_line" ("item_id");

CREATE INDEX "idx_purchase_return_line_original_invoice_line_id" ON "pur"."purchase_return_line" ("original_invoice_line_id");

CREATE INDEX "idx_purchase_return_line_original_receipt_line_id" ON "pur"."purchase_return_line" ("original_receipt_line_id");

CREATE INDEX "idx_purchase_return_line_tax_rate_id" ON "pur"."purchase_return_line" ("tax_rate_id");

CREATE INDEX "idx_purchase_return_line_uom_id" ON "pur"."purchase_return_line" ("uom_id");

CREATE UNIQUE INDEX "uq_landed_cost_line" ON "pur"."landed_cost_line" ("landed_cost_id", "line_no");

CREATE INDEX "idx_landed_cost_line_account_id" ON "pur"."landed_cost_line" ("account_id");

CREATE INDEX "idx_landed_cost_line_vendor_id" ON "pur"."landed_cost_line" ("vendor_id");

CREATE UNIQUE INDEX "uq_landed_cost_allocation" ON "pur"."landed_cost_allocation" ("landed_cost_line_id", "goods_receipt_line_id");

CREATE INDEX "idx_landed_cost_allocation_goods_receipt_line_id" ON "pur"."landed_cost_allocation" ("goods_receipt_line_id");

CREATE INDEX "idx_purchase_contract_vendor_no" ON "pur"."purchase_contract" ("vendor_id", "contract_no");

CREATE INDEX "idx_purchase_contract_currency_id" ON "pur"."purchase_contract" ("currency_id");

CREATE INDEX "idx_purchase_contract_payment_term_id" ON "pur"."purchase_contract" ("payment_term_id");

CREATE UNIQUE INDEX "uq_purchase_contract_line" ON "pur"."purchase_contract_line" ("purchase_contract_id", "line_no");

CREATE INDEX "idx_purchase_contract_line_cost_center_id" ON "pur"."purchase_contract_line" ("cost_center_id");

CREATE INDEX "idx_purchase_contract_line_item_id" ON "pur"."purchase_contract_line" ("item_id");

CREATE INDEX "idx_purchase_contract_line_project_id" ON "pur"."purchase_contract_line" ("project_id");

CREATE INDEX "idx_purchase_contract_line_tax_rate_id" ON "pur"."purchase_contract_line" ("tax_rate_id");

CREATE INDEX "idx_purchase_contract_line_uom_id" ON "pur"."purchase_contract_line" ("uom_id");

CREATE INDEX "idx_purchase_contract_line_warehouse_id" ON "pur"."purchase_contract_line" ("warehouse_id");

CREATE UNIQUE INDEX "uq_purchase_request_order_allocation" ON "pur"."purchase_request_order_allocation" ("purchase_request_line_id", "purchase_order_line_id");

CREATE INDEX "idx_purchase_request_order_allocation_purchase_order_line_id" ON "pur"."purchase_request_order_allocation" ("purchase_order_line_id");

CREATE UNIQUE INDEX "uq_purchase_invoice_order_allocation" ON "pur"."purchase_invoice_line_order_allocation" ("purchase_invoice_line_id", "purchase_order_line_id");

CREATE INDEX "idx_purchase_invoice_line_order_allocation_purchase_d41fac6f" ON "pur"."purchase_invoice_line_order_allocation" ("purchase_order_line_id");

CREATE UNIQUE INDEX "uq_purchase_invoice_goods_receipt_allocation" ON "pur"."purchase_invoice_line_goods_receipt_allocation" ("purchase_invoice_line_id", "goods_receipt_line_id");

CREATE INDEX "idx_purchase_invoice_line_goods_receipt_allocation__c13c8fa2" ON "pur"."purchase_invoice_line_goods_receipt_allocation" ("goods_receipt_line_id");

CREATE UNIQUE INDEX "uq_purchase_invoice_service_receipt_allocation" ON "pur"."purchase_invoice_line_service_receipt_allocation" ("purchase_invoice_line_id", "service_receipt_line_id");

CREATE INDEX "idx_purchase_invoice_line_service_receipt_allocatio_dbb1a552" ON "pur"."purchase_invoice_line_service_receipt_allocation" ("service_receipt_line_id");

CREATE INDEX "idx_ap_vendor_due_status" ON "ap"."payable_open_item" ("vendor_id", "due_date", "status");

CREATE UNIQUE INDEX "uq_ap_source_document" ON "ap"."payable_open_item" ("source_document_id");

CREATE INDEX "idx_ap_company_status" ON "ap"."payable_open_item" ("company_id", "status");

CREATE INDEX "idx_payable_open_item_account_id" ON "ap"."payable_open_item" ("account_id");

CREATE INDEX "idx_payable_open_item_branch_id" ON "ap"."payable_open_item" ("branch_id");

CREATE INDEX "idx_payable_open_item_currency_id" ON "ap"."payable_open_item" ("currency_id");

CREATE UNIQUE INDEX "uq_ap_schedule" ON "ap"."payable_schedule" ("open_item_id", "installment_no");

CREATE INDEX "idx_vendor_advance_status" ON "ap"."vendor_advance" ("vendor_id", "status");

CREATE UNIQUE INDEX "uq_vendor_advance_payment" ON "ap"."vendor_advance" ("payment_document_id");

CREATE INDEX "idx_vendor_advance_branch_id" ON "ap"."vendor_advance" ("branch_id");

CREATE INDEX "idx_vendor_advance_company_id" ON "ap"."vendor_advance" ("company_id");

CREATE INDEX "idx_vendor_advance_currency_id" ON "ap"."vendor_advance" ("currency_id");

CREATE UNIQUE INDEX "uq_ap_settlement_document" ON "ap"."payable_settlement" ("settlement_document_id");

CREATE INDEX "idx_ap_settlement_vendor" ON "ap"."payable_settlement" ("vendor_id", "settlement_date");

CREATE INDEX "idx_payable_settlement_company_id" ON "ap"."payable_settlement" ("company_id");

CREATE INDEX "idx_payable_settlement_currency_id" ON "ap"."payable_settlement" ("currency_id");

CREATE UNIQUE INDEX "uq_ap_settlement_line" ON "ap"."payable_settlement_line" ("settlement_id", "open_item_id", "schedule_id");

CREATE INDEX "idx_payable_settlement_line_open_item_id" ON "ap"."payable_settlement_line" ("open_item_id");

CREATE INDEX "idx_payable_settlement_line_schedule_id" ON "ap"."payable_settlement_line" ("schedule_id");

CREATE UNIQUE INDEX "uq_ap_offset_document" ON "ap"."payable_offset" ("document_id");

CREATE INDEX "idx_payable_offset_company_id" ON "ap"."payable_offset" ("company_id");

CREATE INDEX "idx_payable_offset_receivable_party_id" ON "ap"."payable_offset" ("receivable_party_id");

CREATE INDEX "idx_payable_offset_vendor_id" ON "ap"."payable_offset" ("vendor_id");

CREATE INDEX "idx_payable_adjustment_currency_id" ON "ap"."payable_adjustment" ("currency_id");

CREATE INDEX "idx_payable_adjustment_vendor_id" ON "ap"."payable_adjustment" ("vendor_id");

CREATE UNIQUE INDEX "uq_payable_adjustment_line" ON "ap"."payable_adjustment_line" ("payable_adjustment_id", "line_no");

CREATE INDEX "idx_payable_adjustment_line_account_id" ON "ap"."payable_adjustment_line" ("account_id");

CREATE INDEX "idx_payable_adjustment_line_payable_open_item_id" ON "ap"."payable_adjustment_line" ("payable_open_item_id");

CREATE INDEX "idx_vendor_advance_application" ON "ap"."vendor_advance_application" ("vendor_advance_id", "payable_open_item_id", "settlement_id");

CREATE INDEX "idx_vendor_advance_application_payable_open_item_id" ON "ap"."vendor_advance_application" ("payable_open_item_id");

CREATE INDEX "idx_vendor_advance_application_settlement_id" ON "ap"."vendor_advance_application" ("settlement_id");

CREATE UNIQUE INDEX "uq_payable_offset_line" ON "ap"."payable_offset_line" ("payable_offset_id", "payable_open_item_id", "receivable_open_item_id");

CREATE INDEX "idx_payable_offset_line_payable_open_item_id" ON "ap"."payable_offset_line" ("payable_open_item_id");

CREATE INDEX "idx_payable_offset_line_receivable_open_item_id" ON "ap"."payable_offset_line" ("receivable_open_item_id");

CREATE INDEX "idx_quotation_customer_id" ON "sal"."quotation" ("customer_id");

CREATE INDEX "idx_quotation_payment_term_id" ON "sal"."quotation" ("payment_term_id");

CREATE INDEX "idx_quotation_sales_employee_id" ON "sal"."quotation" ("sales_employee_id");

CREATE UNIQUE INDEX "uq_quotation_line" ON "sal"."quotation_line" ("quotation_id", "line_no");

CREATE INDEX "idx_quotation_line_item_id" ON "sal"."quotation_line" ("item_id");

CREATE INDEX "idx_quotation_line_tax_rate_id" ON "sal"."quotation_line" ("tax_rate_id");

CREATE INDEX "idx_quotation_line_uom_id" ON "sal"."quotation_line" ("uom_id");

CREATE INDEX "idx_sales_order_customer_id" ON "sal"."sales_order" ("customer_id");

CREATE INDEX "idx_sales_order_payment_term_id" ON "sal"."sales_order" ("payment_term_id");

CREATE INDEX "idx_sales_order_sales_employee_id" ON "sal"."sales_order" ("sales_employee_id");

CREATE UNIQUE INDEX "uq_sales_order_line" ON "sal"."sales_order_line" ("sales_order_id", "line_no");

CREATE INDEX "idx_sales_order_line_quotation" ON "sal"."sales_order_line" ("quotation_line_id");

CREATE INDEX "idx_sales_order_line_contract" ON "sal"."sales_order_line" ("sales_contract_line_id");

CREATE INDEX "idx_sales_order_line_item_id" ON "sal"."sales_order_line" ("item_id");

CREATE INDEX "idx_sales_order_line_tax_rate_id" ON "sal"."sales_order_line" ("tax_rate_id");

CREATE INDEX "idx_sales_order_line_uom_id" ON "sal"."sales_order_line" ("uom_id");

CREATE INDEX "idx_sales_order_line_warehouse_id" ON "sal"."sales_order_line" ("warehouse_id");

CREATE INDEX "idx_delivery_customer_id" ON "sal"."delivery" ("customer_id");

CREATE INDEX "idx_delivery_delivered_by_employee_id" ON "sal"."delivery" ("delivered_by_employee_id");

CREATE INDEX "idx_delivery_warehouse_id" ON "sal"."delivery" ("warehouse_id");

CREATE UNIQUE INDEX "uq_delivery_line" ON "sal"."delivery_line" ("delivery_id", "line_no");

CREATE INDEX "idx_delivery_line_so" ON "sal"."delivery_line" ("sales_order_line_id");

CREATE INDEX "idx_delivery_line_item_id" ON "sal"."delivery_line" ("item_id");

CREATE INDEX "idx_delivery_line_location_id" ON "sal"."delivery_line" ("location_id");

CREATE INDEX "idx_delivery_line_lot_id" ON "sal"."delivery_line" ("lot_id");

CREATE INDEX "idx_delivery_line_uom_id" ON "sal"."delivery_line" ("uom_id");

CREATE INDEX "idx_sales_invoice_customer_id" ON "sal"."sales_invoice" ("customer_id");

CREATE INDEX "idx_sales_invoice_payment_term_id" ON "sal"."sales_invoice" ("payment_term_id");

CREATE UNIQUE INDEX "uq_sales_invoice_line" ON "sal"."sales_invoice_line" ("sales_invoice_id", "line_no");

CREATE INDEX "idx_sales_invoice_line_ar_account_id" ON "sal"."sales_invoice_line" ("ar_account_id");

CREATE INDEX "idx_sales_invoice_line_cost_center_id" ON "sal"."sales_invoice_line" ("cost_center_id");

CREATE INDEX "idx_sales_invoice_line_item_id" ON "sal"."sales_invoice_line" ("item_id");

CREATE INDEX "idx_sales_invoice_line_project_id" ON "sal"."sales_invoice_line" ("project_id");

CREATE INDEX "idx_sales_invoice_line_revenue_account_id" ON "sal"."sales_invoice_line" ("revenue_account_id");

CREATE INDEX "idx_sales_invoice_line_tax_rate_id" ON "sal"."sales_invoice_line" ("tax_rate_id");

CREATE INDEX "idx_sales_invoice_line_uom_id" ON "sal"."sales_invoice_line" ("uom_id");

CREATE INDEX "idx_sales_return_customer_id" ON "sal"."sales_return" ("customer_id");

CREATE INDEX "idx_sales_return_warehouse_id" ON "sal"."sales_return" ("warehouse_id");

CREATE UNIQUE INDEX "uq_sales_return_line" ON "sal"."sales_return_line" ("sales_return_id", "line_no");

CREATE INDEX "idx_sales_return_line_item_id" ON "sal"."sales_return_line" ("item_id");

CREATE INDEX "idx_sales_return_line_original_delivery_line_id" ON "sal"."sales_return_line" ("original_delivery_line_id");

CREATE INDEX "idx_sales_return_line_original_invoice_line_id" ON "sal"."sales_return_line" ("original_invoice_line_id");

CREATE INDEX "idx_sales_return_line_tax_rate_id" ON "sal"."sales_return_line" ("tax_rate_id");

CREATE INDEX "idx_sales_return_line_uom_id" ON "sal"."sales_return_line" ("uom_id");

CREATE INDEX "idx_sales_contract_customer_no" ON "sal"."sales_contract" ("customer_id", "contract_no");

CREATE INDEX "idx_sales_contract_currency_id" ON "sal"."sales_contract" ("currency_id");

CREATE INDEX "idx_sales_contract_payment_term_id" ON "sal"."sales_contract" ("payment_term_id");

CREATE UNIQUE INDEX "uq_sales_contract_line" ON "sal"."sales_contract_line" ("sales_contract_id", "line_no");

CREATE INDEX "idx_sales_contract_line_item_id" ON "sal"."sales_contract_line" ("item_id");

CREATE INDEX "idx_sales_contract_line_tax_rate_id" ON "sal"."sales_contract_line" ("tax_rate_id");

CREATE INDEX "idx_sales_contract_line_uom_id" ON "sal"."sales_contract_line" ("uom_id");

CREATE INDEX "idx_sales_contract_line_warehouse_id" ON "sal"."sales_contract_line" ("warehouse_id");

CREATE UNIQUE INDEX "uq_sales_invoice_order_allocation" ON "sal"."sales_invoice_line_order_allocation" ("sales_invoice_line_id", "sales_order_line_id");

CREATE INDEX "idx_sales_invoice_line_order_allocation_sales_order_line_id" ON "sal"."sales_invoice_line_order_allocation" ("sales_order_line_id");

CREATE UNIQUE INDEX "uq_sales_invoice_delivery_allocation" ON "sal"."sales_invoice_line_delivery_allocation" ("sales_invoice_line_id", "delivery_line_id");

CREATE INDEX "idx_sales_invoice_line_delivery_allocation_delivery_line_id" ON "sal"."sales_invoice_line_delivery_allocation" ("delivery_line_id");

CREATE INDEX "idx_ar_customer_due_status" ON "ar"."receivable_open_item" ("customer_id", "due_date", "status");

CREATE UNIQUE INDEX "uq_ar_source_document" ON "ar"."receivable_open_item" ("source_document_id");

CREATE INDEX "idx_ar_company_status" ON "ar"."receivable_open_item" ("company_id", "status");

CREATE INDEX "idx_receivable_open_item_account_id" ON "ar"."receivable_open_item" ("account_id");

CREATE INDEX "idx_receivable_open_item_branch_id" ON "ar"."receivable_open_item" ("branch_id");

CREATE INDEX "idx_receivable_open_item_currency_id" ON "ar"."receivable_open_item" ("currency_id");

CREATE UNIQUE INDEX "uq_ar_schedule" ON "ar"."receivable_schedule" ("open_item_id", "installment_no");

CREATE INDEX "idx_customer_advance_status" ON "ar"."customer_advance" ("customer_id", "status");

CREATE UNIQUE INDEX "uq_customer_advance_receipt" ON "ar"."customer_advance" ("receipt_document_id");

CREATE INDEX "idx_customer_advance_branch_id" ON "ar"."customer_advance" ("branch_id");

CREATE INDEX "idx_customer_advance_company_id" ON "ar"."customer_advance" ("company_id");

CREATE INDEX "idx_customer_advance_currency_id" ON "ar"."customer_advance" ("currency_id");

CREATE UNIQUE INDEX "uq_ar_settlement_document" ON "ar"."receivable_settlement" ("settlement_document_id");

CREATE INDEX "idx_ar_settlement_customer" ON "ar"."receivable_settlement" ("customer_id", "settlement_date");

CREATE INDEX "idx_receivable_settlement_company_id" ON "ar"."receivable_settlement" ("company_id");

CREATE INDEX "idx_receivable_settlement_currency_id" ON "ar"."receivable_settlement" ("currency_id");

CREATE UNIQUE INDEX "uq_ar_settlement_line" ON "ar"."receivable_settlement_line" ("settlement_id", "open_item_id", "schedule_id");

CREATE INDEX "idx_receivable_settlement_line_open_item_id" ON "ar"."receivable_settlement_line" ("open_item_id");

CREATE INDEX "idx_receivable_settlement_line_schedule_id" ON "ar"."receivable_settlement_line" ("schedule_id");

CREATE UNIQUE INDEX "uq_ar_offset_document" ON "ar"."receivable_offset" ("document_id");

CREATE INDEX "idx_receivable_offset_company_id" ON "ar"."receivable_offset" ("company_id");

CREATE INDEX "idx_receivable_offset_customer_id" ON "ar"."receivable_offset" ("customer_id");

CREATE INDEX "idx_receivable_offset_payable_party_id" ON "ar"."receivable_offset" ("payable_party_id");

CREATE INDEX "idx_receivable_adjustment_currency_id" ON "ar"."receivable_adjustment" ("currency_id");

CREATE INDEX "idx_receivable_adjustment_customer_id" ON "ar"."receivable_adjustment" ("customer_id");

CREATE UNIQUE INDEX "uq_receivable_adjustment_line" ON "ar"."receivable_adjustment_line" ("receivable_adjustment_id", "line_no");

CREATE INDEX "idx_receivable_adjustment_line_account_id" ON "ar"."receivable_adjustment_line" ("account_id");

CREATE INDEX "idx_receivable_adjustment_line_receivable_open_item_id" ON "ar"."receivable_adjustment_line" ("receivable_open_item_id");

CREATE INDEX "idx_customer_advance_application" ON "ar"."customer_advance_application" ("customer_advance_id", "receivable_open_item_id", "settlement_id");

CREATE INDEX "idx_customer_advance_application_receivable_open_item_id" ON "ar"."customer_advance_application" ("receivable_open_item_id");

CREATE INDEX "idx_customer_advance_application_settlement_id" ON "ar"."customer_advance_application" ("settlement_id");

CREATE UNIQUE INDEX "uq_receivable_offset_line" ON "ar"."receivable_offset_line" ("receivable_offset_id", "receivable_open_item_id", "payable_open_item_id");

CREATE INDEX "idx_receivable_offset_line_payable_open_item_id" ON "ar"."receivable_offset_line" ("payable_open_item_id");

CREATE INDEX "idx_receivable_offset_line_receivable_open_item_id" ON "ar"."receivable_offset_line" ("receivable_open_item_id");

CREATE UNIQUE INDEX "uq_cash_fund" ON "cash"."cash_fund" ("company_id", "code");

CREATE INDEX "idx_cash_fund_branch_id" ON "cash"."cash_fund" ("branch_id");

CREATE INDEX "idx_cash_fund_cash_account_id" ON "cash"."cash_fund" ("cash_account_id");

CREATE INDEX "idx_cash_fund_cashier_employee_id" ON "cash"."cash_fund" ("cashier_employee_id");

CREATE INDEX "idx_cash_fund_currency_id" ON "cash"."cash_fund" ("currency_id");

CREATE INDEX "idx_cash_receipt_cash_fund_id" ON "cash"."cash_receipt" ("cash_fund_id");

CREATE INDEX "idx_cash_receipt_payer_party_id" ON "cash"."cash_receipt" ("payer_party_id");

CREATE UNIQUE INDEX "uq_cash_receipt_line" ON "cash"."cash_receipt_line" ("cash_receipt_id", "line_no");

CREATE INDEX "idx_cash_receipt_line_account_id" ON "cash"."cash_receipt_line" ("account_id");

CREATE INDEX "idx_cash_receipt_line_cost_center_id" ON "cash"."cash_receipt_line" ("cost_center_id");

CREATE INDEX "idx_cash_receipt_line_party_id" ON "cash"."cash_receipt_line" ("party_id");

CREATE INDEX "idx_cash_receipt_line_project_id" ON "cash"."cash_receipt_line" ("project_id");

CREATE INDEX "idx_cash_payment_cash_fund_id" ON "cash"."cash_payment" ("cash_fund_id");

CREATE INDEX "idx_cash_payment_payee_party_id" ON "cash"."cash_payment" ("payee_party_id");

CREATE UNIQUE INDEX "uq_cash_payment_line" ON "cash"."cash_payment_line" ("cash_payment_id", "line_no");

CREATE INDEX "idx_cash_payment_line_account_id" ON "cash"."cash_payment_line" ("account_id");

CREATE INDEX "idx_cash_payment_line_cost_center_id" ON "cash"."cash_payment_line" ("cost_center_id");

CREATE INDEX "idx_cash_payment_line_party_id" ON "cash"."cash_payment_line" ("party_id");

CREATE INDEX "idx_cash_payment_line_project_id" ON "cash"."cash_payment_line" ("project_id");

CREATE INDEX "idx_advance_request_employee_id" ON "cash"."advance_request" ("employee_id");

CREATE INDEX "idx_advance_settlement_advance_document_id" ON "cash"."advance_settlement" ("advance_document_id");

CREATE INDEX "idx_advance_settlement_employee_id" ON "cash"."advance_settlement" ("employee_id");

CREATE INDEX "idx_payment_request_payee_party_id" ON "cash"."payment_request" ("payee_party_id");

CREATE INDEX "idx_payment_request_requester_employee_id" ON "cash"."payment_request" ("requester_employee_id");

CREATE INDEX "idx_cash_count_cash_fund_id" ON "cash"."cash_count" ("cash_fund_id");

CREATE UNIQUE INDEX "uq_cash_book_entry_sequence" ON "cash"."cash_book_entry" ("cash_fund_id", "entry_date", "sequence_no");

CREATE INDEX "idx_cash_book_entry_source" ON "cash"."cash_book_entry" ("source_document_id");

CREATE INDEX "idx_cash_book_entry_branch_id" ON "cash"."cash_book_entry" ("branch_id");

CREATE INDEX "idx_cash_book_entry_company_id" ON "cash"."cash_book_entry" ("company_id");

CREATE INDEX "idx_bank_receipt_bank_account_id" ON "bank"."bank_receipt" ("bank_account_id");

CREATE INDEX "idx_bank_receipt_payer_party_id" ON "bank"."bank_receipt" ("payer_party_id");

CREATE UNIQUE INDEX "uq_bank_receipt_line" ON "bank"."bank_receipt_line" ("bank_receipt_id", "line_no");

CREATE INDEX "idx_bank_receipt_line_account_id" ON "bank"."bank_receipt_line" ("account_id");

CREATE INDEX "idx_bank_receipt_line_cost_center_id" ON "bank"."bank_receipt_line" ("cost_center_id");

CREATE INDEX "idx_bank_receipt_line_party_id" ON "bank"."bank_receipt_line" ("party_id");

CREATE INDEX "idx_bank_receipt_line_project_id" ON "bank"."bank_receipt_line" ("project_id");

CREATE INDEX "idx_bank_payment_bank_account_id" ON "bank"."bank_payment" ("bank_account_id");

CREATE INDEX "idx_bank_payment_payee_party_id" ON "bank"."bank_payment" ("payee_party_id");

CREATE UNIQUE INDEX "uq_bank_payment_line" ON "bank"."bank_payment_line" ("bank_payment_id", "line_no");

CREATE INDEX "idx_bank_payment_line_account_id" ON "bank"."bank_payment_line" ("account_id");

CREATE INDEX "idx_bank_payment_line_cost_center_id" ON "bank"."bank_payment_line" ("cost_center_id");

CREATE INDEX "idx_bank_payment_line_party_id" ON "bank"."bank_payment_line" ("party_id");

CREATE INDEX "idx_bank_payment_line_project_id" ON "bank"."bank_payment_line" ("project_id");

CREATE INDEX "idx_payment_order_bank_account_id" ON "bank"."payment_order" ("bank_account_id");

CREATE INDEX "idx_payment_order_beneficiary_party_id" ON "bank"."payment_order" ("beneficiary_party_id");

CREATE INDEX "idx_bank_transfer_from_bank_account_id" ON "bank"."bank_transfer" ("from_bank_account_id");

CREATE INDEX "idx_bank_transfer_to_bank_account_id" ON "bank"."bank_transfer" ("to_bank_account_id");

CREATE UNIQUE INDEX "uq_bank_statement_no" ON "bank"."statement" ("bank_account_id", "statement_no");

CREATE INDEX "idx_bank_statement_period" ON "bank"."statement" ("bank_account_id", "from_date", "to_date");

CREATE INDEX "idx_statement_company_id" ON "bank"."statement" ("company_id");

CREATE UNIQUE INDEX "uq_bank_statement_line" ON "bank"."statement_line" ("statement_id", "line_no");

CREATE INDEX "idx_bank_statement_line_ref" ON "bank"."statement_line" ("transaction_date", "reference_no");

CREATE UNIQUE INDEX "uq_bank_reconciliation_statement" ON "bank"."reconciliation" ("bank_account_id", "statement_id");

CREATE INDEX "idx_reconciliation_company_id" ON "bank"."reconciliation" ("company_id");

CREATE INDEX "idx_reconciliation_completed_by" ON "bank"."reconciliation" ("completed_by");

CREATE INDEX "idx_reconciliation_started_by" ON "bank"."reconciliation" ("started_by");

CREATE INDEX "idx_reconciliation_statement_id" ON "bank"."reconciliation" ("statement_id");

CREATE UNIQUE INDEX "uq_bank_reconciliation_line" ON "bank"."reconciliation_line" ("reconciliation_id", "statement_line_id");

CREATE INDEX "idx_reconciliation_line_matched_document_id" ON "bank"."reconciliation_line" ("matched_document_id");

CREATE INDEX "idx_reconciliation_line_statement_line_id" ON "bank"."reconciliation_line" ("statement_line_id");

CREATE UNIQUE INDEX "uq_bank_book_entry_sequence" ON "bank"."bank_book_entry" ("bank_account_id", "entry_date", "sequence_no");

CREATE INDEX "idx_bank_book_entry_source" ON "bank"."bank_book_entry" ("source_document_id");

CREATE INDEX "idx_bank_book_entry_branch_id" ON "bank"."bank_book_entry" ("branch_id");

CREATE INDEX "idx_bank_book_entry_company_id" ON "bank"."bank_book_entry" ("company_id");

CREATE INDEX "idx_stock_receipt_received_by_employee_id" ON "inv"."stock_receipt" ("received_by_employee_id");

CREATE INDEX "idx_stock_receipt_source_party_id" ON "inv"."stock_receipt" ("source_party_id");

CREATE INDEX "idx_stock_receipt_warehouse_id" ON "inv"."stock_receipt" ("warehouse_id");

CREATE UNIQUE INDEX "uq_stock_receipt_line" ON "inv"."stock_receipt_line" ("stock_receipt_id", "line_no");

CREATE INDEX "idx_stock_receipt_line_item_id" ON "inv"."stock_receipt_line" ("item_id");

CREATE INDEX "idx_stock_receipt_line_location_id" ON "inv"."stock_receipt_line" ("location_id");

CREATE INDEX "idx_stock_receipt_line_lot_id" ON "inv"."stock_receipt_line" ("lot_id");

CREATE INDEX "idx_stock_receipt_line_uom_id" ON "inv"."stock_receipt_line" ("uom_id");

CREATE INDEX "idx_stock_issue_issued_by_employee_id" ON "inv"."stock_issue" ("issued_by_employee_id");

CREATE INDEX "idx_stock_issue_recipient_party_id" ON "inv"."stock_issue" ("recipient_party_id");

CREATE INDEX "idx_stock_issue_warehouse_id" ON "inv"."stock_issue" ("warehouse_id");

CREATE UNIQUE INDEX "uq_stock_issue_line" ON "inv"."stock_issue_line" ("stock_issue_id", "line_no");

CREATE INDEX "idx_stock_issue_line_item_id" ON "inv"."stock_issue_line" ("item_id");

CREATE INDEX "idx_stock_issue_line_location_id" ON "inv"."stock_issue_line" ("location_id");

CREATE INDEX "idx_stock_issue_line_lot_id" ON "inv"."stock_issue_line" ("lot_id");

CREATE INDEX "idx_stock_issue_line_uom_id" ON "inv"."stock_issue_line" ("uom_id");

CREATE INDEX "idx_stock_transfer_from_warehouse_id" ON "inv"."stock_transfer" ("from_warehouse_id");

CREATE INDEX "idx_stock_transfer_to_warehouse_id" ON "inv"."stock_transfer" ("to_warehouse_id");

CREATE UNIQUE INDEX "uq_stock_transfer_line" ON "inv"."stock_transfer_line" ("stock_transfer_id", "line_no");

CREATE INDEX "idx_stock_transfer_line_from_location_id" ON "inv"."stock_transfer_line" ("from_location_id");

CREATE INDEX "idx_stock_transfer_line_item_id" ON "inv"."stock_transfer_line" ("item_id");

CREATE INDEX "idx_stock_transfer_line_lot_id" ON "inv"."stock_transfer_line" ("lot_id");

CREATE INDEX "idx_stock_transfer_line_to_location_id" ON "inv"."stock_transfer_line" ("to_location_id");

CREATE INDEX "idx_stock_transfer_line_uom_id" ON "inv"."stock_transfer_line" ("uom_id");

CREATE INDEX "idx_stock_adjustment_warehouse_id" ON "inv"."stock_adjustment" ("warehouse_id");

CREATE UNIQUE INDEX "uq_stock_adjustment_line" ON "inv"."stock_adjustment_line" ("stock_adjustment_id", "line_no");

CREATE INDEX "idx_stock_adjustment_line_item_id" ON "inv"."stock_adjustment_line" ("item_id");

CREATE INDEX "idx_stock_adjustment_line_location_id" ON "inv"."stock_adjustment_line" ("location_id");

CREATE INDEX "idx_stock_adjustment_line_lot_id" ON "inv"."stock_adjustment_line" ("lot_id");

CREATE INDEX "idx_stock_adjustment_line_uom_id" ON "inv"."stock_adjustment_line" ("uom_id");

CREATE INDEX "idx_stocktake_warehouse_id" ON "inv"."stocktake" ("warehouse_id");

CREATE UNIQUE INDEX "uq_stocktake_line" ON "inv"."stocktake_line" ("stocktake_id", "line_no");

CREATE INDEX "idx_stocktake_line_item_id" ON "inv"."stocktake_line" ("item_id");

CREATE INDEX "idx_stocktake_line_location_id" ON "inv"."stocktake_line" ("location_id");

CREATE INDEX "idx_stocktake_line_lot_id" ON "inv"."stocktake_line" ("lot_id");

CREATE UNIQUE INDEX "uq_inventory_lot" ON "inv"."lot" ("company_id", "item_id", "lot_no");

CREATE INDEX "idx_lot_item_id" ON "inv"."lot" ("item_id");

CREATE UNIQUE INDEX "uq_inventory_serial" ON "inv"."serial_number" ("company_id", "item_id", "serial_no");

CREATE INDEX "idx_serial_number_current_location_id" ON "inv"."serial_number" ("current_location_id");

CREATE INDEX "idx_serial_number_current_warehouse_id" ON "inv"."serial_number" ("current_warehouse_id");

CREATE INDEX "idx_serial_number_item_id" ON "inv"."serial_number" ("item_id");

CREATE INDEX "idx_stock_movement_item_date" ON "inv"."stock_movement" ("company_id", "warehouse_id", "item_id", "movement_date");

CREATE INDEX "idx_stock_movement_source" ON "inv"."stock_movement" ("source_document_id");

CREATE INDEX "idx_stock_movement_branch_id" ON "inv"."stock_movement" ("branch_id");

CREATE INDEX "idx_stock_movement_item_id" ON "inv"."stock_movement" ("item_id");

CREATE INDEX "idx_stock_movement_location_id" ON "inv"."stock_movement" ("location_id");

CREATE INDEX "idx_stock_movement_lot_id" ON "inv"."stock_movement" ("lot_id");

CREATE INDEX "idx_stock_movement_warehouse_id" ON "inv"."stock_movement" ("warehouse_id");

CREATE UNIQUE INDEX "uq_inventory_balance" ON "inv"."inventory_balance" ("company_id", "warehouse_id", "item_id", "as_of_date");

CREATE INDEX "idx_inventory_balance_item" ON "inv"."inventory_balance" ("company_id", "item_id", "as_of_date");

CREATE INDEX "idx_inventory_balance_item_id" ON "inv"."inventory_balance" ("item_id");

CREATE INDEX "idx_inventory_balance_warehouse_id" ON "inv"."inventory_balance" ("warehouse_id");

CREATE UNIQUE INDEX "uq_inventory_location_balance" ON "inv"."inventory_location_balance" ("company_id", "warehouse_id", "location_id", "item_id", "as_of_date");

CREATE INDEX "idx_inventory_location_balance_item_id" ON "inv"."inventory_location_balance" ("item_id");

CREATE INDEX "idx_inventory_location_balance_location_id" ON "inv"."inventory_location_balance" ("location_id");

CREATE INDEX "idx_inventory_location_balance_warehouse_id" ON "inv"."inventory_location_balance" ("warehouse_id");

CREATE UNIQUE INDEX "uq_inventory_lot_balance" ON "inv"."inventory_lot_balance" ("company_id", "warehouse_id", "item_id", "lot_id", "as_of_date");

CREATE INDEX "idx_inventory_lot_balance_item_id" ON "inv"."inventory_lot_balance" ("item_id");

CREATE INDEX "idx_inventory_lot_balance_lot_id" ON "inv"."inventory_lot_balance" ("lot_id");

CREATE INDEX "idx_inventory_lot_balance_warehouse_id" ON "inv"."inventory_lot_balance" ("warehouse_id");

CREATE INDEX "idx_inventory_inspection_supplier_id" ON "inv"."inventory_inspection" ("supplier_id");

CREATE INDEX "idx_inventory_inspection_warehouse_id" ON "inv"."inventory_inspection" ("warehouse_id");

CREATE UNIQUE INDEX "uq_inventory_inspection_line" ON "inv"."inventory_inspection_line" ("inventory_inspection_id", "line_no");

CREATE INDEX "idx_inventory_inspection_line_goods_receipt_line_id" ON "inv"."inventory_inspection_line" ("goods_receipt_line_id");

CREATE INDEX "idx_inventory_inspection_line_item_id" ON "inv"."inventory_inspection_line" ("item_id");

CREATE INDEX "idx_inventory_inspection_line_uom_id" ON "inv"."inventory_inspection_line" ("uom_id");

CREATE UNIQUE INDEX "uq_inventory_costing_run" ON "inv"."inventory_costing_run" ("company_id", "fiscal_period_id", "run_no");

CREATE INDEX "idx_inventory_costing_run_fiscal_period_id" ON "inv"."inventory_costing_run" ("fiscal_period_id");

CREATE INDEX "idx_inventory_costing_run_started_by_user_id" ON "inv"."inventory_costing_run" ("started_by_user_id");

CREATE INDEX "idx_inventory_costing_run_warehouse_id" ON "inv"."inventory_costing_run" ("warehouse_id");

CREATE INDEX "idx_inventory_cost_layer_open" ON "inv"."inventory_cost_layer" ("warehouse_id", "item_id", "layer_date", "layer_status");

CREATE INDEX "idx_inventory_cost_layer_source" ON "inv"."inventory_cost_layer" ("source_movement_id");

CREATE INDEX "idx_inventory_cost_layer_company_id" ON "inv"."inventory_cost_layer" ("company_id");

CREATE INDEX "idx_inventory_cost_layer_item_id" ON "inv"."inventory_cost_layer" ("item_id");

CREATE INDEX "idx_inventory_cost_layer_lot_id" ON "inv"."inventory_cost_layer" ("lot_id");

CREATE UNIQUE INDEX "uq_inventory_cost_allocation" ON "inv"."inventory_cost_allocation" ("outbound_movement_id", "cost_layer_id", "costing_run_id");

CREATE INDEX "idx_inventory_cost_allocation_cost_layer_id" ON "inv"."inventory_cost_allocation" ("cost_layer_id");

CREATE INDEX "idx_inventory_cost_allocation_costing_run_id" ON "inv"."inventory_cost_allocation" ("costing_run_id");

CREATE UNIQUE INDEX "uq_asset_category" ON "fa"."fixed_asset_category" ("company_id", "code");

CREATE UNIQUE INDEX "uq_depreciation_method" ON "fa"."depreciation_method" ("company_id", "code");

CREATE UNIQUE INDEX "uq_asset_code" ON "fa"."fixed_asset" ("company_id", "asset_code");

CREATE INDEX "idx_asset_org_status" ON "fa"."fixed_asset" ("branch_id", "department_id", "status");

CREATE INDEX "idx_fixed_asset_category_id" ON "fa"."fixed_asset" ("category_id");

CREATE INDEX "idx_fixed_asset_custodian_employee_id" ON "fa"."fixed_asset" ("custodian_employee_id");

CREATE INDEX "idx_fixed_asset_department_id" ON "fa"."fixed_asset" ("department_id");

CREATE INDEX "idx_fixed_asset_depreciation_method_id" ON "fa"."fixed_asset" ("depreciation_method_id");

CREATE INDEX "idx_fixed_asset_account_mapping_accum_depr_account_id" ON "fa"."fixed_asset_account_mapping" ("accum_depr_account_id");

CREATE INDEX "idx_fixed_asset_account_mapping_asset_account_id" ON "fa"."fixed_asset_account_mapping" ("asset_account_id");

CREATE INDEX "idx_fixed_asset_account_mapping_depreciation_expens_1c7c9eaf" ON "fa"."fixed_asset_account_mapping" ("depreciation_expense_account_id");

CREATE INDEX "idx_fixed_asset_acquisition_asset_id" ON "fa"."fixed_asset_acquisition" ("asset_id");

CREATE INDEX "idx_fixed_asset_acquisition_source_invoice_document_id" ON "fa"."fixed_asset_acquisition" ("source_invoice_document_id");

CREATE INDEX "idx_fixed_asset_transfer_asset_id" ON "fa"."fixed_asset_transfer" ("asset_id");

CREATE INDEX "idx_fixed_asset_transfer_from_branch_id" ON "fa"."fixed_asset_transfer" ("from_branch_id");

CREATE INDEX "idx_fixed_asset_transfer_from_department_id" ON "fa"."fixed_asset_transfer" ("from_department_id");

CREATE INDEX "idx_fixed_asset_transfer_to_branch_id" ON "fa"."fixed_asset_transfer" ("to_branch_id");

CREATE INDEX "idx_fixed_asset_transfer_to_department_id" ON "fa"."fixed_asset_transfer" ("to_department_id");

CREATE INDEX "idx_fixed_asset_revaluation_asset_id" ON "fa"."fixed_asset_revaluation" ("asset_id");

CREATE INDEX "idx_fixed_asset_disposal_asset_id" ON "fa"."fixed_asset_disposal" ("asset_id");

CREATE UNIQUE INDEX "uq_asset_depr_schedule" ON "fa"."depreciation_schedule" ("asset_id", "period_start");

CREATE UNIQUE INDEX "uq_depreciation_run" ON "fa"."depreciation_run" ("company_id", "fiscal_period_id", "run_no");

CREATE INDEX "idx_depreciation_run_created_by" ON "fa"."depreciation_run" ("created_by");

CREATE INDEX "idx_depreciation_run_fiscal_period_id" ON "fa"."depreciation_run" ("fiscal_period_id");

CREATE INDEX "idx_depreciation_run_journal_entry_id" ON "fa"."depreciation_run" ("journal_entry_id");

CREATE UNIQUE INDEX "uq_depreciation_run_asset" ON "fa"."depreciation_run_line" ("depreciation_run_id", "asset_id");

CREATE INDEX "idx_depreciation_run_line_accum_depr_account_id" ON "fa"."depreciation_run_line" ("accum_depr_account_id");

CREATE INDEX "idx_depreciation_run_line_asset_id" ON "fa"."depreciation_run_line" ("asset_id");

CREATE INDEX "idx_depreciation_run_line_expense_account_id" ON "fa"."depreciation_run_line" ("expense_account_id");

CREATE INDEX "idx_fixed_asset_maintenance_completion_fixed_asset_id" ON "fa"."fixed_asset_maintenance_completion" ("fixed_asset_id");

CREATE INDEX "idx_fixed_asset_maintenance_completion_vendor_id" ON "fa"."fixed_asset_maintenance_completion" ("vendor_id");

CREATE INDEX "idx_fixed_asset_inventory_branch_id" ON "fa"."fixed_asset_inventory" ("branch_id");

CREATE INDEX "idx_fixed_asset_inventory_department_id" ON "fa"."fixed_asset_inventory" ("department_id");

CREATE UNIQUE INDEX "uq_fixed_asset_inventory_line" ON "fa"."fixed_asset_inventory_line" ("fixed_asset_inventory_id", "line_no");

CREATE INDEX "idx_fixed_asset_inventory_line_fixed_asset_id" ON "fa"."fixed_asset_inventory_line" ("fixed_asset_id");

CREATE UNIQUE INDEX "uq_tool_category" ON "ccdc"."tool_category" ("company_id", "code");

CREATE UNIQUE INDEX "uq_tool_code" ON "ccdc"."tool" ("company_id", "code");

CREATE INDEX "idx_tool_branch_id" ON "ccdc"."tool" ("branch_id");

CREATE INDEX "idx_tool_category_id" ON "ccdc"."tool" ("category_id");

CREATE INDEX "idx_tool_custodian_employee_id" ON "ccdc"."tool" ("custodian_employee_id");

CREATE INDEX "idx_tool_department_id" ON "ccdc"."tool" ("department_id");

CREATE INDEX "idx_tool_issue_department_id" ON "ccdc"."tool_issue" ("department_id");

CREATE INDEX "idx_tool_issue_employee_id" ON "ccdc"."tool_issue" ("employee_id");

CREATE INDEX "idx_tool_issue_tool_id" ON "ccdc"."tool_issue" ("tool_id");

CREATE INDEX "idx_tool_transfer_from_department_id" ON "ccdc"."tool_transfer" ("from_department_id");

CREATE INDEX "idx_tool_transfer_from_employee_id" ON "ccdc"."tool_transfer" ("from_employee_id");

CREATE INDEX "idx_tool_transfer_to_department_id" ON "ccdc"."tool_transfer" ("to_department_id");

CREATE INDEX "idx_tool_transfer_to_employee_id" ON "ccdc"."tool_transfer" ("to_employee_id");

CREATE INDEX "idx_tool_transfer_tool_id" ON "ccdc"."tool_transfer" ("tool_id");

CREATE UNIQUE INDEX "uq_tool_allocation_schedule" ON "ccdc"."allocation_schedule" ("tool_id", "period_start");

CREATE INDEX "idx_allocation_schedule_expense_account_id" ON "ccdc"."allocation_schedule" ("expense_account_id");

CREATE UNIQUE INDEX "uq_tool_allocation_run" ON "ccdc"."allocation_run" ("company_id", "fiscal_period_id", "run_no");

CREATE INDEX "idx_allocation_run_created_by" ON "ccdc"."allocation_run" ("created_by");

CREATE INDEX "idx_allocation_run_fiscal_period_id" ON "ccdc"."allocation_run" ("fiscal_period_id");

CREATE INDEX "idx_allocation_run_journal_entry_id" ON "ccdc"."allocation_run" ("journal_entry_id");

CREATE UNIQUE INDEX "uq_tool_allocation_run_line" ON "ccdc"."allocation_run_line" ("allocation_run_id", "tool_id");

CREATE INDEX "idx_allocation_run_line_expense_account_id" ON "ccdc"."allocation_run_line" ("expense_account_id");

CREATE INDEX "idx_allocation_run_line_prepaid_account_id" ON "ccdc"."allocation_run_line" ("prepaid_account_id");

CREATE INDEX "idx_allocation_run_line_tool_id" ON "ccdc"."allocation_run_line" ("tool_id");

CREATE UNIQUE INDEX "uq_prepaid_expense_code" ON "ccdc"."prepaid_expense" ("company_id", "code");

CREATE INDEX "idx_prepaid_expense_branch_id" ON "ccdc"."prepaid_expense" ("branch_id");

CREATE INDEX "idx_prepaid_expense_expense_account_id" ON "ccdc"."prepaid_expense" ("expense_account_id");

CREATE INDEX "idx_prepaid_expense_prepaid_account_id" ON "ccdc"."prepaid_expense" ("prepaid_account_id");

CREATE INDEX "idx_prepaid_expense_source_document_id" ON "ccdc"."prepaid_expense" ("source_document_id");

CREATE UNIQUE INDEX "uq_prepaid_expense_schedule" ON "ccdc"."prepaid_expense_schedule" ("prepaid_expense_id", "period_start");

CREATE UNIQUE INDEX "uq_tax_service_provider" ON "tax"."tax_service_provider" ("company_id", "code");

CREATE INDEX "idx_tax_service_provider_type" ON "tax"."tax_service_provider" ("company_id", "provider_type", "status");

CREATE INDEX "idx_einvoice_raw_external" ON "tax"."einvoice_raw_payload" ("provider_id", "external_id");

CREATE INDEX "idx_einvoice_raw_time" ON "tax"."einvoice_raw_payload" ("company_id", "received_at");

CREATE UNIQUE INDEX "uq_tax_invoice_deduplication" ON "tax"."tax_invoice" ("company_id", "direction", "deduplication_key");

CREATE INDEX "idx_tax_invoice_provider_external" ON "tax"."tax_invoice" ("provider_id", "provider_invoice_id");

CREATE INDEX "idx_tax_invoice_processing" ON "tax"."tax_invoice" ("company_id", "invoice_date", "processing_status");

CREATE INDEX "idx_tax_invoice_seller" ON "tax"."tax_invoice" ("seller_tax_code", "invoice_date");

CREATE INDEX "idx_tax_invoice_currency_id" ON "tax"."tax_invoice" ("currency_id");

CREATE INDEX "idx_tax_invoice_raw_payload_id" ON "tax"."tax_invoice" ("raw_payload_id");

CREATE UNIQUE INDEX "uq_tax_invoice_line" ON "tax"."tax_invoice_line" ("tax_invoice_id", "line_no");

CREATE UNIQUE INDEX "uq_tax_invoice_link" ON "tax"."tax_invoice_link" ("source_tax_invoice_id", "target_tax_invoice_id", "link_type");

CREATE INDEX "idx_tax_invoice_link_target_tax_invoice_id" ON "tax"."tax_invoice_link" ("target_tax_invoice_id");

CREATE INDEX "idx_input_invoice_processing_linked_document_id" ON "tax"."input_invoice_processing" ("linked_document_id");

CREATE INDEX "idx_input_invoice_processing_reviewed_by" ON "tax"."input_invoice_processing" ("reviewed_by");

CREATE INDEX "idx_input_invoice_processing_vendor_id" ON "tax"."input_invoice_processing" ("vendor_id");

CREATE INDEX "idx_tax_invoice_validation" ON "tax"."invoice_validation_result" ("tax_invoice_id", "rule_code");

CREATE INDEX "idx_supplier_risk_check" ON "tax"."invoice_risk_check" ("supplier_tax_code", "checked_at");

CREATE INDEX "idx_invoice_risk_check_tax_invoice_id" ON "tax"."invoice_risk_check" ("tax_invoice_id");

CREATE INDEX "idx_vat_ledger_period" ON "tax"."vat_ledger" ("company_id", "tax_period_id", "direction");

CREATE INDEX "idx_vat_ledger_invoice" ON "tax"."vat_ledger" ("tax_invoice_id");

CREATE INDEX "idx_vat_ledger_source_document_id" ON "tax"."vat_ledger" ("source_document_id");

CREATE INDEX "idx_vat_ledger_tax_period_id" ON "tax"."vat_ledger" ("tax_period_id");

CREATE UNIQUE INDEX "uq_tax_period" ON "tax"."tax_period" ("company_id", "tax_type", "period_code");

CREATE INDEX "idx_tax_declaration_tax_form_version_id" ON "tax"."tax_declaration" ("tax_form_version_id");

CREATE INDEX "idx_tax_declaration_tax_period_id" ON "tax"."tax_declaration" ("tax_period_id");

CREATE UNIQUE INDEX "uq_tax_declaration_indicator" ON "tax"."tax_declaration_line" ("tax_declaration_id", "indicator_code");

CREATE INDEX "idx_tax_declaration_line_tax_form_indicator_id" ON "tax"."tax_declaration_line" ("tax_form_indicator_id");

CREATE INDEX "idx_tax_obligation_due" ON "tax"."tax_obligation" ("company_id", "tax_type", "due_date", "status");

CREATE INDEX "idx_tax_obligation_source_declaration_id" ON "tax"."tax_obligation" ("source_declaration_id");

CREATE INDEX "idx_tax_obligation_tax_period_id" ON "tax"."tax_obligation" ("tax_period_id");

CREATE INDEX "idx_tax_payment_bank_account_id" ON "tax"."tax_payment" ("bank_account_id");

CREATE INDEX "idx_tax_payment_tax_obligation_id" ON "tax"."tax_payment" ("tax_obligation_id");

CREATE INDEX "idx_tax_submission_declaration" ON "tax"."tax_submission" ("tax_declaration_id", "submitted_at");

CREATE INDEX "idx_tax_submission_company_id" ON "tax"."tax_submission" ("company_id");

CREATE INDEX "idx_tax_submission_provider_id" ON "tax"."tax_submission" ("provider_id");

CREATE INDEX "idx_tax_submission_submitted_by" ON "tax"."tax_submission" ("submitted_by");

CREATE INDEX "idx_tax_submission_response" ON "tax"."tax_submission_response" ("submission_id", "received_at");

CREATE INDEX "idx_einvoice_sync_batch" ON "tax"."einvoice_sync_batch" ("company_id", "provider_id", "started_at");

CREATE INDEX "idx_einvoice_sync_batch_provider_id" ON "tax"."einvoice_sync_batch" ("provider_id");

CREATE UNIQUE INDEX "uq_tax_invoice_document_link" ON "tax"."tax_invoice_document_link" ("tax_invoice_id", "document_id", "link_type");

CREATE INDEX "idx_tax_invoice_document_link_document" ON "tax"."tax_invoice_document_link" ("document_id");

CREATE UNIQUE INDEX "uq_tax_form_definition" ON "tax"."tax_form_definition" ("tax_type", "form_code");

CREATE UNIQUE INDEX "uq_tax_form_version" ON "tax"."tax_form_version" ("tax_form_definition_id", "version_no");

CREATE INDEX "idx_tax_form_version_effective" ON "tax"."tax_form_version" ("tax_form_definition_id", "version_status", "effective_from");

CREATE UNIQUE INDEX "uq_tax_form_indicator" ON "tax"."tax_form_indicator" ("tax_form_version_id", "indicator_code");

CREATE INDEX "idx_tax_form_indicator_order" ON "tax"."tax_form_indicator" ("tax_form_version_id", "display_order");

CREATE INDEX "idx_tax_form_indicator_parent_indicator_id" ON "tax"."tax_form_indicator" ("parent_indicator_id");

CREATE UNIQUE INDEX "uq_tax_calculation_rule_version" ON "tax"."tax_calculation_rule" ("tax_type", "rule_code", "rule_version");

CREATE INDEX "idx_tax_calculation_rule_effective" ON "tax"."tax_calculation_rule" ("tax_type", "status", "effective_from");

CREATE UNIQUE INDEX "uq_account_class" ON "gl"."account_class" ("company_id", "code");

CREATE UNIQUE INDEX "uq_gl_account_company_code" ON "gl"."account" ("company_id", "code");

CREATE INDEX "idx_gl_account_parent" ON "gl"."account" ("chart_of_accounts_id", "parent_account_id");

CREATE INDEX "idx_gl_account_statutory_code" ON "gl"."account" ("company_id", "statutory_account_code");

CREATE INDEX "idx_account_account_class_id" ON "gl"."account" ("account_class_id");

CREATE INDEX "idx_account_parent_account_id" ON "gl"."account" ("parent_account_id");

CREATE UNIQUE INDEX "uq_fiscal_year" ON "gl"."fiscal_year" ("company_id", "year_no");

CREATE UNIQUE INDEX "uq_fiscal_period" ON "gl"."fiscal_period" ("fiscal_year_id", "period_no");

CREATE UNIQUE INDEX "uq_period_lock" ON "gl"."period_lock" ("company_id", "fiscal_period_id", "module_code");

CREATE INDEX "idx_period_lock_fiscal_period_id" ON "gl"."period_lock" ("fiscal_period_id");

CREATE INDEX "idx_period_lock_locked_by" ON "gl"."period_lock" ("locked_by");

CREATE UNIQUE INDEX "uq_journal_entry_no" ON "gl"."journal_entry" ("company_id", "journal_no");

CREATE UNIQUE INDEX "uq_journal_entry_source_version" ON "gl"."journal_entry" ("source_document_id", "posting_version");

CREATE INDEX "idx_journal_entry_posting_date" ON "gl"."journal_entry" ("company_id", "posting_date", "journal_status");

CREATE INDEX "idx_journal_entry_source_document" ON "gl"."journal_entry" ("source_document_id");

CREATE INDEX "idx_journal_entry_base_currency_id" ON "gl"."journal_entry" ("base_currency_id");

CREATE INDEX "idx_journal_entry_branch_id" ON "gl"."journal_entry" ("branch_id");

CREATE INDEX "idx_journal_entry_created_by_user_id" ON "gl"."journal_entry" ("created_by_user_id");

CREATE INDEX "idx_journal_entry_fiscal_period_id" ON "gl"."journal_entry" ("fiscal_period_id");

CREATE INDEX "idx_journal_entry_posted_by_user_id" ON "gl"."journal_entry" ("posted_by_user_id");

CREATE INDEX "idx_journal_entry_posting_batch_id" ON "gl"."journal_entry" ("posting_batch_id");

CREATE INDEX "idx_journal_entry_reversal_of_journal_entry_id" ON "gl"."journal_entry" ("reversal_of_journal_entry_id");

CREATE UNIQUE INDEX "uq_journal_entry_line" ON "gl"."journal_entry_line" ("journal_entry_id", "line_no");

CREATE INDEX "idx_journal_entry_line_account" ON "gl"."journal_entry_line" ("account_id", "journal_entry_id");

CREATE INDEX "idx_journal_entry_line_party" ON "gl"."journal_entry_line" ("party_id");

CREATE INDEX "idx_journal_entry_line_project" ON "gl"."journal_entry_line" ("project_id");

CREATE INDEX "idx_journal_entry_line_cost_center_id" ON "gl"."journal_entry_line" ("cost_center_id");

CREATE INDEX "idx_journal_entry_line_tax_rate_id" ON "gl"."journal_entry_line" ("tax_rate_id");

CREATE INDEX "idx_journal_entry_line_transaction_currency_id" ON "gl"."journal_entry_line" ("transaction_currency_id");

CREATE INDEX "idx_journal_entry_line_warehouse_id" ON "gl"."journal_entry_line" ("warehouse_id");

CREATE UNIQUE INDEX "uq_posting_rule_code" ON "gl"."posting_rule" ("company_id", "code");

CREATE INDEX "idx_posting_rule_doc" ON "gl"."posting_rule" ("company_id", "document_type_id", "status", "priority");

CREATE INDEX "idx_posting_rule_document_type_id" ON "gl"."posting_rule" ("document_type_id");

CREATE UNIQUE INDEX "uq_posting_rule_line" ON "gl"."posting_rule_line" ("posting_rule_id", "line_no");

CREATE INDEX "idx_posting_rule_line_fixed_account_id" ON "gl"."posting_rule_line" ("fixed_account_id");

CREATE UNIQUE INDEX "uq_posting_batch" ON "gl"."posting_batch" ("company_id", "batch_no");

CREATE UNIQUE INDEX "uq_closing_run" ON "gl"."closing_run" ("company_id", "fiscal_period_id", "run_type");

CREATE INDEX "idx_closing_run_created_by" ON "gl"."closing_run" ("created_by");

CREATE INDEX "idx_closing_run_fiscal_period_id" ON "gl"."closing_run" ("fiscal_period_id");

CREATE INDEX "idx_closing_run_journal_entry_id" ON "gl"."closing_run" ("journal_entry_id");

CREATE UNIQUE INDEX "uq_closing_run_line" ON "gl"."closing_run_line" ("closing_run_id", "account_id");

CREATE INDEX "idx_closing_run_line_account_id" ON "gl"."closing_run_line" ("account_id");

CREATE UNIQUE INDEX "uq_chart_of_accounts_company_code" ON "gl"."chart_of_accounts" ("company_id", "code");

CREATE INDEX "idx_chart_of_accounts_default" ON "gl"."chart_of_accounts" ("company_id", "is_default", "status");

CREATE UNIQUE INDEX "uq_account_opening_balance" ON "gl"."account_opening_balance" ("company_id", "branch_id", "fiscal_year_id", "account_id", "currency_id", "dimension_key");

CREATE INDEX "idx_account_opening_balance_account" ON "gl"."account_opening_balance" ("account_id", "fiscal_year_id");

CREATE INDEX "idx_account_opening_balance_branch_id" ON "gl"."account_opening_balance" ("branch_id");

CREATE INDEX "idx_account_opening_balance_cost_center_id" ON "gl"."account_opening_balance" ("cost_center_id");

CREATE INDEX "idx_account_opening_balance_currency_id" ON "gl"."account_opening_balance" ("currency_id");

CREATE INDEX "idx_account_opening_balance_fiscal_year_id" ON "gl"."account_opening_balance" ("fiscal_year_id");

CREATE INDEX "idx_account_opening_balance_party_id" ON "gl"."account_opening_balance" ("party_id");

CREATE INDEX "idx_account_opening_balance_project_id" ON "gl"."account_opening_balance" ("project_id");

CREATE INDEX "idx_account_opening_balance_warehouse_id" ON "gl"."account_opening_balance" ("warehouse_id");

CREATE UNIQUE INDEX "uq_account_balance" ON "gl"."account_balance" ("company_id", "branch_id", "fiscal_period_id", "account_id");

CREATE INDEX "idx_account_balance_account_period" ON "gl"."account_balance" ("account_id", "fiscal_period_id");

CREATE INDEX "idx_account_balance_branch_id" ON "gl"."account_balance" ("branch_id");

CREATE INDEX "idx_account_balance_fiscal_period_id" ON "gl"."account_balance" ("fiscal_period_id");

CREATE UNIQUE INDEX "uq_account_dimension_balance" ON "gl"."account_dimension_balance" ("company_id", "branch_id", "fiscal_period_id", "account_id", "dimension_key");

CREATE INDEX "idx_account_dimension_balance_account_period" ON "gl"."account_dimension_balance" ("account_id", "fiscal_period_id");

CREATE INDEX "idx_account_dimension_balance_branch_id" ON "gl"."account_dimension_balance" ("branch_id");

CREATE INDEX "idx_account_dimension_balance_cost_center_id" ON "gl"."account_dimension_balance" ("cost_center_id");

CREATE INDEX "idx_account_dimension_balance_fiscal_period_id" ON "gl"."account_dimension_balance" ("fiscal_period_id");

CREATE INDEX "idx_account_dimension_balance_party_id" ON "gl"."account_dimension_balance" ("party_id");

CREATE INDEX "idx_account_dimension_balance_project_id" ON "gl"."account_dimension_balance" ("project_id");

CREATE INDEX "idx_account_dimension_balance_warehouse_id" ON "gl"."account_dimension_balance" ("warehouse_id");

CREATE UNIQUE INDEX "uq_foreign_currency_revaluation_run" ON "gl"."foreign_currency_revaluation_run" ("company_id", "fiscal_period_id", "run_no");

CREATE INDEX "idx_foreign_currency_revaluation_run_created_by_user_id" ON "gl"."foreign_currency_revaluation_run" ("created_by_user_id");

CREATE INDEX "idx_foreign_currency_revaluation_run_fiscal_period_id" ON "gl"."foreign_currency_revaluation_run" ("fiscal_period_id");

CREATE INDEX "idx_foreign_currency_revaluation_run_journal_entry_id" ON "gl"."foreign_currency_revaluation_run" ("journal_entry_id");

CREATE INDEX "idx_foreign_currency_revaluation_run_rate_type_id" ON "gl"."foreign_currency_revaluation_run" ("rate_type_id");

CREATE INDEX "idx_foreign_currency_revaluation_line" ON "gl"."foreign_currency_revaluation_line" ("revaluation_run_id", "account_id", "party_id", "currency_id");

CREATE INDEX "idx_foreign_currency_revaluation_line_account_id" ON "gl"."foreign_currency_revaluation_line" ("account_id");

CREATE INDEX "idx_foreign_currency_revaluation_line_currency_id" ON "gl"."foreign_currency_revaluation_line" ("currency_id");

CREATE INDEX "idx_foreign_currency_revaluation_line_party_id" ON "gl"."foreign_currency_revaluation_line" ("party_id");

CREATE UNIQUE INDEX "uq_report_definition_code" ON "report"."report_definition" ("code");

CREATE UNIQUE INDEX "uq_report_parameter" ON "report"."report_parameter" ("report_definition_id", "parameter_code");

CREATE UNIQUE INDEX "uq_saved_report" ON "report"."saved_report" ("user_id", "report_definition_id", "name");

CREATE INDEX "idx_saved_report_company_id" ON "report"."saved_report" ("company_id");

CREATE INDEX "idx_saved_report_report_definition_id" ON "report"."saved_report" ("report_definition_id");

CREATE UNIQUE INDEX "uq_financial_statement_template_code" ON "report"."financial_statement_template" ("code");

CREATE INDEX "idx_financial_statement_template_type" ON "report"."financial_statement_template" ("statement_type", "status");

CREATE UNIQUE INDEX "uq_financial_statement_template_version" ON "report"."financial_statement_template_version" ("template_id", "version_no");

CREATE INDEX "idx_financial_statement_template_effective" ON "report"."financial_statement_template_version" ("template_id", "version_status", "effective_from");

CREATE INDEX "idx_financial_statement_template_version_created_by_user_id" ON "report"."financial_statement_template_version" ("created_by_user_id");

CREATE UNIQUE INDEX "uq_financial_statement_line_indicator" ON "report"."financial_statement_line" ("template_version_id", "indicator_code");

CREATE INDEX "idx_financial_statement_line_order" ON "report"."financial_statement_line" ("template_version_id", "display_order");

CREATE INDEX "idx_financial_statement_line_parent_line_id" ON "report"."financial_statement_line" ("parent_line_id");

CREATE UNIQUE INDEX "uq_financial_statement_account_mapping" ON "report"."financial_statement_account_mapping" ("company_id", "statement_line_id", "account_id", "mapping_side", "effective_from");

CREATE INDEX "idx_financial_statement_mapping_account" ON "report"."financial_statement_account_mapping" ("company_id", "account_id");

CREATE INDEX "idx_financial_statement_account_mapping_account_id" ON "report"."financial_statement_account_mapping" ("account_id");

CREATE INDEX "idx_financial_statement_account_mapping_statement_line_id" ON "report"."financial_statement_account_mapping" ("statement_line_id");

CREATE INDEX "idx_financial_statement_run_scope" ON "report"."financial_statement_run" ("company_id", "template_version_id", "fiscal_period_id", "branch_id", "run_type");

CREATE INDEX "idx_financial_statement_run_approved_by_user_id" ON "report"."financial_statement_run" ("approved_by_user_id");

CREATE INDEX "idx_financial_statement_run_branch_id" ON "report"."financial_statement_run" ("branch_id");

CREATE INDEX "idx_financial_statement_run_fiscal_period_id" ON "report"."financial_statement_run" ("fiscal_period_id");

CREATE INDEX "idx_financial_statement_run_generated_by_user_id" ON "report"."financial_statement_run" ("generated_by_user_id");

CREATE INDEX "idx_financial_statement_run_reporting_currency_id" ON "report"."financial_statement_run" ("reporting_currency_id");

CREATE INDEX "idx_financial_statement_run_template_version_id" ON "report"."financial_statement_run" ("template_version_id");

CREATE UNIQUE INDEX "uq_financial_statement_value" ON "report"."financial_statement_value" ("statement_run_id", "statement_line_id");

CREATE INDEX "idx_financial_statement_value_statement_line_id" ON "report"."financial_statement_value" ("statement_line_id");

CREATE UNIQUE INDEX "uq_accounting_book_template_code" ON "report"."accounting_book_template" ("code");

CREATE INDEX "idx_accounting_book_template_type" ON "report"."accounting_book_template" ("book_type", "status");

CREATE UNIQUE INDEX "uq_accounting_book_template_version" ON "report"."accounting_book_template_version" ("accounting_book_template_id", "version_no");

CREATE INDEX "idx_accounting_book_template_version_created_by_user_id" ON "report"."accounting_book_template_version" ("created_by_user_id");

CREATE INDEX "idx_financial_statement_adjustment_line" ON "report"."financial_statement_adjustment" ("statement_run_id", "statement_line_id");

CREATE INDEX "idx_financial_statement_adjustment_approved_by_user_id" ON "report"."financial_statement_adjustment" ("approved_by_user_id");

CREATE INDEX "idx_financial_statement_adjustment_branch_id" ON "report"."financial_statement_adjustment" ("branch_id");

CREATE INDEX "idx_financial_statement_adjustment_created_by_user_id" ON "report"."financial_statement_adjustment" ("created_by_user_id");

CREATE INDEX "idx_financial_statement_adjustment_statement_line_id" ON "report"."financial_statement_adjustment" ("statement_line_id");

CREATE INDEX "idx_outbox_publish" ON "integration"."outbox_event" ("published_at", "occurred_at");

CREATE INDEX "idx_outbox_aggregate" ON "integration"."outbox_event" ("aggregate_type", "aggregate_id");

CREATE INDEX "idx_outbox_event_company_id" ON "integration"."outbox_event" ("company_id");

CREATE UNIQUE INDEX "uq_inbox_message" ON "integration"."inbox_message" ("source_system", "message_id");

CREATE UNIQUE INDEX "uq_api_client_code" ON "integration"."api_client" ("client_code");

CREATE INDEX "idx_api_client_company_id" ON "integration"."api_client" ("company_id");

CREATE UNIQUE INDEX "uq_webhook_delivery_attempt" ON "integration"."webhook_delivery" ("event_id", "webhook_subscription_id", "attempt_no");

CREATE INDEX "idx_webhook_delivery_retry" ON "integration"."webhook_delivery" ("webhook_subscription_id", "next_retry_at");

CREATE INDEX "idx_webhook_delivery_company_id" ON "integration"."webhook_delivery" ("company_id");

CREATE UNIQUE INDEX "uq_idempotency_key" ON "integration"."idempotency_key" ("client_id", "idempotency_key");

CREATE INDEX "idx_idempotency_key_company_id" ON "integration"."idempotency_key" ("company_id");

CREATE UNIQUE INDEX "uq_external_mapping_external" ON "integration"."external_mapping" ("company_id", "external_system", "entity_type", "external_id");

CREATE UNIQUE INDEX "uq_external_mapping_internal" ON "integration"."external_mapping" ("company_id", "external_system", "entity_type", "internal_id");

CREATE INDEX "idx_import_job_company_time" ON "integration"."import_job" ("company_id", "created_at");

CREATE INDEX "idx_import_job_created_by" ON "integration"."import_job" ("created_by");

CREATE INDEX "idx_import_row_error" ON "integration"."import_row_error" ("import_job_id", "row_no");

CREATE UNIQUE INDEX "uq_webhook_subscription" ON "integration"."webhook_subscription" ("company_id", "event_type", "target_url");

CREATE INDEX "idx_webhook_subscription_status" ON "integration"."webhook_subscription" ("company_id", "status");

CREATE UNIQUE INDEX "uq_sync_checkpoint" ON "integration"."sync_checkpoint" ("company_id", "external_system", "sync_scope");

COMMENT ON TABLE "org"."company" IS 'Danh mục Doanh nghiệp dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "org"."branch" IS 'Danh mục Chi nhánh dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "org"."department" IS 'Danh mục Phòng ban dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "org"."position" IS 'Danh mục Chức vụ dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "org"."employee" IS 'Danh mục Nhân viên dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "org"."employee_assignment" IS 'Danh mục Lịch sử phân công nhân viên dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "iam"."user_account" IS 'Cấu hình bảo mật/phân quyền cho Tài khoản người dùng; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."user_identity" IS 'Cấu hình bảo mật/phân quyền cho Định danh đăng nhập; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."user_session" IS 'Cấu hình bảo mật/phân quyền cho Phiên đăng nhập; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."role" IS 'Cấu hình bảo mật/phân quyền cho Vai trò; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."permission_resource" IS 'Cấu hình bảo mật/phân quyền cho Đối tượng phân quyền; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."permission_action" IS 'Cấu hình bảo mật/phân quyền cho Hành động quyền; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."permission" IS 'Cấu hình bảo mật/phân quyền cho Quyền chi tiết; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."role_permission" IS 'Cấu hình bảo mật/phân quyền cho Quyền của vai trò; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."user_role_assignment" IS 'Gán một Role cho một thành viên doanh nghiệp theo khoảng hiệu lực và Data Scope cụ thể. Quyền hiệu lực phải tính theo từng assignment, không gộp scope giữa các role.';

COMMENT ON TABLE "iam"."permission_bundle" IS 'Cấu hình/danh mục cho Gói quyền. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "iam"."permission_bundle_item" IS 'Cấu hình bảo mật/phân quyền cho Quyền trong gói; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."role_permission_bundle" IS 'Cấu hình/danh mục cho Gói quyền của vai trò. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "iam"."company_membership" IS 'Cấu hình bảo mật/phân quyền cho Thành viên doanh nghiệp; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."data_scope_set" IS 'Header của một bộ phạm vi dữ liệu. Scope chi tiết được tách sang bảng branch/department/warehouse/bank/project/cost center để có FK vật lý.';

COMMENT ON TABLE "iam"."data_scope_branch" IS 'Cấu hình bảo mật/phân quyền cho Phạm vi chi nhánh; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."data_scope_department" IS 'Cấu hình bảo mật/phân quyền cho Phạm vi phòng ban; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."data_scope_warehouse" IS 'Cấu hình bảo mật/phân quyền cho Phạm vi kho; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."data_scope_bank_account" IS 'Cấu hình bảo mật/phân quyền cho Phạm vi tài khoản ngân hàng; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."data_scope_project" IS 'Cấu hình bảo mật/phân quyền cho Phạm vi dự án; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."data_scope_cost_center" IS 'Cấu hình bảo mật/phân quyền cho Phạm vi trung tâm chi phí; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "iam"."segregation_of_duties_rule" IS 'Cấu hình/danh mục cho Quy tắc phân tách nhiệm vụ. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "iam"."segregation_of_duties_violation" IS 'Cấu hình bảo mật/phân quyền cho Vi phạm phân tách nhiệm vụ; mọi thay đổi phải có quyền quản trị phù hợp và được Audit Log.';

COMMENT ON TABLE "workflow"."approval_workflow" IS 'Dữ liệu workflow cho Workflow phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.';

COMMENT ON TABLE "workflow"."approval_workflow_version" IS 'Snapshot phiên bản workflow. Sau khi publish và có giao dịch sử dụng thì không sửa nội dung; thay đổi phải tạo version mới.';

COMMENT ON TABLE "workflow"."approval_step" IS 'Dữ liệu workflow cho Bước phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.';

COMMENT ON TABLE "workflow"."approval_step_assignee" IS 'Dữ liệu workflow cho Người hoặc vai trò phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.';

COMMENT ON TABLE "workflow"."approval_condition" IS 'Dữ liệu workflow cho Điều kiện workflow; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.';

COMMENT ON TABLE "workflow"."approval_instance" IS 'Dữ liệu workflow cho Phiên phê duyệt chứng từ; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.';

COMMENT ON TABLE "workflow"."approval_task" IS 'Dữ liệu workflow cho Nhiệm vụ phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.';

COMMENT ON TABLE "workflow"."approval_action_log" IS 'Lưu Nhật ký hành động phê duyệt theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.';

COMMENT ON TABLE "workflow"."approval_delegation" IS 'Dữ liệu workflow cho Ủy quyền phê duyệt; chỉ WorkflowService ghi và chứng từ nghiệp vụ chỉ tham chiếu/đọc kết quả.';

COMMENT ON TABLE "audit"."audit_log" IS 'Nhật ký hành động cấp cao dạng append-only: ai, lúc nào, thao tác gì, trên đối tượng nào. Chi tiết giá trị cũ/mới nằm ở audit_change.';

COMMENT ON TABLE "audit"."audit_change" IS 'Lưu Chi tiết thay đổi dữ liệu theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.';

COMMENT ON TABLE "audit"."login_log" IS 'Lưu Nhật ký đăng nhập theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.';

COMMENT ON TABLE "audit"."data_export_log" IS 'Lưu Nhật ký xuất dữ liệu theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.';

COMMENT ON TABLE "audit"."security_event" IS 'Lưu Sự kiện bảo mật theo mô hình append-only phục vụ truy vết, kiểm toán và điều tra sự cố; UI nghiệp vụ không được UPDATE/DELETE.';

COMMENT ON TABLE "mdm"."currency" IS 'Danh mục Tiền tệ dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."exchange_rate_type" IS 'Danh mục Loại tỷ giá dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."exchange_rate" IS 'Danh mục Tỷ giá dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."payment_term" IS 'Danh mục Điều khoản thanh toán dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."tax_rate" IS 'Danh mục Thuế suất dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."project" IS 'Danh mục Dự án dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."cost_center" IS 'Danh mục Trung tâm chi phí dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."party" IS 'Danh mục Đối tượng khách hàng/NCC dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."party_role" IS 'Danh mục Vai trò của đối tượng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."party_address" IS 'Danh mục Địa chỉ đối tượng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."bank" IS 'Danh mục Ngân hàng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."party_bank_account" IS 'Danh mục Tài khoản ngân hàng đối tượng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."item_category" IS 'Danh mục Nhóm vật tư/hàng hóa dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."unit_of_measure" IS 'Danh mục Đơn vị tính dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."item" IS 'Danh mục Vật tư/hàng hóa/dịch vụ dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."item_uom_conversion" IS 'Danh mục Quy đổi đơn vị tính dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."warehouse" IS 'Danh mục Kho dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."inventory_location" IS 'Danh mục Vị trí trong kho dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."company_bank_account" IS 'Danh mục Tài khoản ngân hàng doanh nghiệp dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."document_type" IS 'Registry loại chứng từ. Lưu phân hệ, lớp chứng từ, mã mẫu pháp lý, cờ workflow/posting/kho/công nợ/thuế; không hard-code mã mẫu TT99 vào tên bảng.';

COMMENT ON TABLE "mdm"."document_numbering_rule" IS 'Cấu hình/danh mục cho Quy tắc đánh số chứng từ. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "mdm"."party_contact" IS 'Danh mục Người liên hệ đối tượng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."customer_profile" IS 'Danh mục Hồ sơ khách hàng dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "mdm"."vendor_profile" IS 'Danh mục Hồ sơ nhà cung cấp dùng chung trong doanh nghiệp. Dữ liệu đã được giao dịch tham chiếu nên chuyển INACTIVE thay vì xóa vật lý.';

COMMENT ON TABLE "core"."business_document" IS 'Header chuẩn dùng chung cho mọi chứng từ nghiệp vụ: số chứng từ, ngày, tiền tệ, trạng thái, workflow, tổng tiền và người tạo/sửa. Các bảng chứng từ chuyên ngành mở rộng 1:1 từ bảng này.';

COMMENT ON TABLE "core"."document_status_history" IS 'Lưu dữ liệu Lịch sử trạng thái chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.';

COMMENT ON TABLE "core"."document_link" IS 'Bảng quan hệ/ánh xạ cho Liên kết chuỗi chứng từ; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.';

COMMENT ON TABLE "core"."document_attachment" IS 'Lưu dữ liệu Tệp đính kèm chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.';

COMMENT ON TABLE "core"."document_reference" IS 'Lưu dữ liệu Tham chiếu ngoài của chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.';

COMMENT ON TABLE "core"."document_signature" IS 'Lưu dữ liệu Chữ ký chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.';

COMMENT ON TABLE "core"."document_template" IS 'Cấu hình/danh mục cho Mẫu in chứng từ. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "core"."document_template_version" IS 'Phiên bản hóa Phiên bản mẫu in. Khi version đã được publish/được chứng từ tham chiếu thì giữ bất biến và tạo version mới khi thay đổi.';

COMMENT ON TABLE "core"."document_lock" IS 'Phần mở rộng nghiệp vụ cho Khóa chỉnh sửa chứng từ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "core"."configuration_definition" IS 'Cấu hình/danh mục cho Định nghĩa cấu hình. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "core"."company_configuration_value" IS 'Lưu dữ liệu Giá trị cấu hình doanh nghiệp thuộc phân hệ Lõi chứng từ và cấu hình.';

COMMENT ON TABLE "core"."document_number_sequence" IS 'Bộ đếm số chứng từ theo scope/năm tài chính. Khi cấp số phải khóa hàng hoặc dùng UPDATE ... RETURNING; tuyệt đối không dùng MAX(document_no)+1.';

COMMENT ON TABLE "core"."document_note" IS 'Lưu dữ liệu Ghi chú chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.';

COMMENT ON TABLE "core"."document_rendered_output" IS 'Lưu dữ liệu Bản kết xuất chứng từ thuộc phân hệ Lõi chứng từ và cấu hình.';

COMMENT ON TABLE "pur"."purchase_request" IS 'Phần mở rộng nghiệp vụ cho Yêu cầu mua hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "pur"."purchase_request_line" IS 'Lưu chi tiết dòng của Chi tiết yêu cầu mua hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "pur"."purchase_order" IS 'Phần mở rộng nghiệp vụ cho Đơn mua hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "pur"."purchase_order_line" IS 'Lưu chi tiết dòng của Chi tiết đơn mua hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "pur"."goods_receipt" IS 'Phần mở rộng nghiệp vụ cho Nhận hàng mua. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "pur"."goods_receipt_line" IS 'Lưu chi tiết dòng của Chi tiết nhận hàng mua. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "pur"."service_receipt" IS 'Phần mở rộng nghiệp vụ cho Nghiệm thu dịch vụ mua. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "pur"."service_receipt_line" IS 'Lưu chi tiết dòng của Chi tiết nghiệm thu dịch vụ. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "pur"."purchase_invoice" IS 'Phần mở rộng nghiệp vụ cho Chứng từ hóa đơn mua. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "pur"."purchase_invoice_line" IS 'Lưu chi tiết dòng của Chi tiết chứng từ hóa đơn mua. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "pur"."purchase_return" IS 'Phần mở rộng nghiệp vụ cho Trả lại hàng mua. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "pur"."purchase_return_line" IS 'Lưu chi tiết dòng của Chi tiết trả lại hàng mua. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "pur"."landed_cost" IS 'Phần mở rộng nghiệp vụ cho Chi phí mua hàng phân bổ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "pur"."landed_cost_line" IS 'Lưu chi tiết dòng của Chi tiết chi phí mua hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "pur"."landed_cost_allocation" IS 'Bảng phân bổ/đối chiếu phục vụ Phân bổ chi phí mua hàng. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "pur"."purchase_contract" IS 'Phần mở rộng nghiệp vụ cho Hợp đồng mua hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "pur"."purchase_contract_line" IS 'Lưu chi tiết dòng của Chi tiết hợp đồng mua. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "pur"."purchase_request_order_allocation" IS 'Bảng phân bổ/đối chiếu phục vụ Phân bổ yêu cầu mua vào đơn mua. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "pur"."purchase_invoice_line_order_allocation" IS 'Bảng phân bổ/đối chiếu phục vụ Đối chiếu dòng hóa đơn mua với đơn mua. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "pur"."purchase_invoice_line_goods_receipt_allocation" IS 'Bảng phân bổ/đối chiếu phục vụ Đối chiếu hóa đơn mua với nhận hàng. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "pur"."purchase_invoice_line_service_receipt_allocation" IS 'Bảng phân bổ/đối chiếu phục vụ Đối chiếu hóa đơn mua với nghiệm thu dịch vụ. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "ap"."payable_open_item" IS 'Khoản công nợ phải trả còn mở phát sinh từ chứng từ đã POST; thanh toán/điều chỉnh/bù trừ cập nhật thông qua settlement, không sửa trực tiếp số gốc.';

COMMENT ON TABLE "ap"."payable_schedule" IS 'Lịch chi tiết cho Lịch đến hạn phải trả, dùng chia khoản phải thu/phải trả/khấu hao/phân bổ theo kỳ và làm căn cứ settlement/run.';

COMMENT ON TABLE "ap"."vendor_advance" IS 'Lưu dữ liệu Tạm ứng nhà cung cấp thuộc phân hệ Công nợ phải trả.';

COMMENT ON TABLE "ap"."payable_settlement" IS 'Lưu dữ liệu Thanh toán công nợ phải trả thuộc phân hệ Công nợ phải trả.';

COMMENT ON TABLE "ap"."payable_settlement_line" IS 'Lưu chi tiết dòng của Chi tiết thanh toán phải trả. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "ap"."payable_offset" IS 'Lưu dữ liệu Bù trừ công nợ phải trả thuộc phân hệ Công nợ phải trả.';

COMMENT ON TABLE "ap"."payable_adjustment" IS 'Phần mở rộng nghiệp vụ cho Điều chỉnh công nợ phải trả. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "ap"."payable_adjustment_line" IS 'Lưu chi tiết dòng của Chi tiết điều chỉnh phải trả. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "ap"."vendor_advance_application" IS 'Bảng quan hệ/ánh xạ cho Cấn trừ tạm ứng nhà cung cấp; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.';

COMMENT ON TABLE "ap"."payable_offset_line" IS 'Lưu chi tiết dòng của Chi tiết bù trừ phải trả. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "sal"."quotation" IS 'Phần mở rộng nghiệp vụ cho Báo giá. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "sal"."quotation_line" IS 'Lưu chi tiết dòng của Chi tiết báo giá. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "sal"."sales_order" IS 'Phần mở rộng nghiệp vụ cho Đơn bán hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "sal"."sales_order_line" IS 'Lưu chi tiết dòng của Chi tiết đơn bán. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "sal"."delivery" IS 'Phần mở rộng nghiệp vụ cho Giao hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "sal"."delivery_line" IS 'Lưu chi tiết dòng của Chi tiết giao hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "sal"."sales_invoice" IS 'Phần mở rộng nghiệp vụ cho Chứng từ hóa đơn bán. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "sal"."sales_invoice_line" IS 'Lưu chi tiết dòng của Chi tiết chứng từ hóa đơn bán. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "sal"."sales_return" IS 'Phần mở rộng nghiệp vụ cho Hàng bán bị trả lại. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "sal"."sales_return_line" IS 'Lưu chi tiết dòng của Chi tiết hàng bán bị trả lại. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "sal"."sales_contract" IS 'Phần mở rộng nghiệp vụ cho Hợp đồng bán hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "sal"."sales_contract_line" IS 'Lưu chi tiết dòng của Chi tiết hợp đồng bán. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "sal"."sales_invoice_line_order_allocation" IS 'Bảng phân bổ/đối chiếu phục vụ Đối chiếu hóa đơn bán với đơn bán. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "sal"."sales_invoice_line_delivery_allocation" IS 'Bảng phân bổ/đối chiếu phục vụ Đối chiếu hóa đơn bán với giao hàng. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "ar"."receivable_open_item" IS 'Khoản công nợ phải thu còn mở phát sinh từ chứng từ đã POST; thu tiền/điều chỉnh/bù trừ cập nhật thông qua settlement, không sửa trực tiếp số gốc.';

COMMENT ON TABLE "ar"."receivable_schedule" IS 'Lịch chi tiết cho Lịch đến hạn phải thu, dùng chia khoản phải thu/phải trả/khấu hao/phân bổ theo kỳ và làm căn cứ settlement/run.';

COMMENT ON TABLE "ar"."customer_advance" IS 'Lưu dữ liệu Khách hàng trả trước thuộc phân hệ Công nợ phải thu.';

COMMENT ON TABLE "ar"."receivable_settlement" IS 'Lưu dữ liệu Thu/cấn trừ công nợ phải thu thuộc phân hệ Công nợ phải thu.';

COMMENT ON TABLE "ar"."receivable_settlement_line" IS 'Lưu chi tiết dòng của Chi tiết tất toán phải thu. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "ar"."receivable_offset" IS 'Lưu dữ liệu Bù trừ công nợ phải thu thuộc phân hệ Công nợ phải thu.';

COMMENT ON TABLE "ar"."receivable_adjustment" IS 'Phần mở rộng nghiệp vụ cho Điều chỉnh công nợ phải thu. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "ar"."receivable_adjustment_line" IS 'Lưu chi tiết dòng của Chi tiết điều chỉnh phải thu. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "ar"."customer_advance_application" IS 'Bảng quan hệ/ánh xạ cho Cấn trừ tiền khách hàng trả trước; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.';

COMMENT ON TABLE "ar"."receivable_offset_line" IS 'Lưu chi tiết dòng của Chi tiết bù trừ phải thu. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "cash"."cash_fund" IS 'Lưu dữ liệu Quỹ tiền mặt thuộc phân hệ Tiền mặt.';

COMMENT ON TABLE "cash"."cash_receipt" IS 'Phần mở rộng nghiệp vụ cho Phiếu thu. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "cash"."cash_receipt_line" IS 'Lưu chi tiết dòng của Chi tiết phiếu thu. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "cash"."cash_payment" IS 'Phần mở rộng nghiệp vụ cho Phiếu chi. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "cash"."cash_payment_line" IS 'Lưu chi tiết dòng của Chi tiết phiếu chi. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "cash"."advance_request" IS 'Phần mở rộng nghiệp vụ cho Giấy đề nghị tạm ứng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "cash"."advance_settlement" IS 'Phần mở rộng nghiệp vụ cho Giấy thanh toán tạm ứng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "cash"."payment_request" IS 'Phần mở rộng nghiệp vụ cho Giấy đề nghị thanh toán. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "cash"."cash_count" IS 'Phần mở rộng nghiệp vụ cho Kiểm kê quỹ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "cash"."cash_book_entry" IS 'Lưu dữ liệu Dòng sổ quỹ tiền mặt thuộc phân hệ Tiền mặt.';

COMMENT ON TABLE "bank"."bank_receipt" IS 'Phần mở rộng nghiệp vụ cho Thu tiền qua ngân hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "bank"."bank_receipt_line" IS 'Lưu chi tiết dòng của Chi tiết thu ngân hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "bank"."bank_payment" IS 'Phần mở rộng nghiệp vụ cho Chi tiền qua ngân hàng. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "bank"."bank_payment_line" IS 'Lưu chi tiết dòng của Chi tiết chi ngân hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "bank"."payment_order" IS 'Phần mở rộng nghiệp vụ cho Ủy nhiệm chi/Lệnh thanh toán. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "bank"."bank_transfer" IS 'Phần mở rộng nghiệp vụ cho Chuyển tiền giữa tài khoản. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "bank"."statement" IS 'Lưu dữ liệu Sao kê ngân hàng thuộc phân hệ Ngân hàng.';

COMMENT ON TABLE "bank"."statement_line" IS 'Lưu chi tiết dòng của Dòng sao kê. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "bank"."reconciliation" IS 'Lưu dữ liệu Đối chiếu ngân hàng thuộc phân hệ Ngân hàng.';

COMMENT ON TABLE "bank"."reconciliation_line" IS 'Lưu chi tiết dòng của Chi tiết đối chiếu ngân hàng. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "bank"."bank_book_entry" IS 'Lưu dữ liệu Dòng sổ tiền gửi ngân hàng thuộc phân hệ Ngân hàng.';

COMMENT ON TABLE "inv"."stock_receipt" IS 'Phần mở rộng nghiệp vụ cho Phiếu nhập kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "inv"."stock_receipt_line" IS 'Lưu chi tiết dòng của Chi tiết phiếu nhập kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "inv"."stock_issue" IS 'Phần mở rộng nghiệp vụ cho Phiếu xuất kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "inv"."stock_issue_line" IS 'Lưu chi tiết dòng của Chi tiết phiếu xuất kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "inv"."stock_transfer" IS 'Phần mở rộng nghiệp vụ cho Điều chuyển kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "inv"."stock_transfer_line" IS 'Lưu chi tiết dòng của Chi tiết điều chuyển kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "inv"."stock_adjustment" IS 'Phần mở rộng nghiệp vụ cho Điều chỉnh tồn kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "inv"."stock_adjustment_line" IS 'Lưu chi tiết dòng của Chi tiết điều chỉnh tồn kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "inv"."stocktake" IS 'Phần mở rộng nghiệp vụ cho Kiểm kê kho. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "inv"."stocktake_line" IS 'Lưu chi tiết dòng của Chi tiết kiểm kê kho. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "inv"."lot" IS 'Lưu dữ liệu Lô hàng thuộc phân hệ Kho và giá vốn.';

COMMENT ON TABLE "inv"."serial_number" IS 'Lưu dữ liệu Số sê-ri thuộc phân hệ Kho và giá vốn.';

COMMENT ON TABLE "inv"."stock_movement" IS 'Sổ phát sinh nhập-xuất tồn bất biến sau POST. Balance và costing được tính/tái dựng từ các movement này.';

COMMENT ON TABLE "inv"."inventory_balance" IS 'Bảng số dư dẫn xuất cho Số dư tồn kho theo kho. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.';

COMMENT ON TABLE "inv"."inventory_location_balance" IS 'Bảng số dư dẫn xuất cho Số dư tồn theo vị trí. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.';

COMMENT ON TABLE "inv"."inventory_lot_balance" IS 'Bảng số dư dẫn xuất cho Số dư tồn theo lô. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.';

COMMENT ON TABLE "inv"."inventory_inspection" IS 'Phần mở rộng nghiệp vụ cho Biên bản kiểm nghiệm vật tư/hàng hóa. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "inv"."inventory_inspection_line" IS 'Lưu chi tiết dòng của Chi tiết kiểm nghiệm. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "inv"."inventory_costing_run" IS 'Header của một lần xử lý Lần tính giá xuất kho. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.';

COMMENT ON TABLE "inv"."inventory_cost_layer" IS 'Lưu dữ liệu Lớp giá tồn kho thuộc phân hệ Kho và giá vốn.';

COMMENT ON TABLE "inv"."inventory_cost_allocation" IS 'Bảng phân bổ/đối chiếu phục vụ Phân bổ lớp giá cho xuất kho. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "fa"."fixed_asset_category" IS 'Lưu dữ liệu Nhóm tài sản cố định thuộc phân hệ Tài sản cố định.';

COMMENT ON TABLE "fa"."depreciation_method" IS 'Lưu dữ liệu Phương pháp khấu hao thuộc phân hệ Tài sản cố định.';

COMMENT ON TABLE "fa"."fixed_asset" IS 'Lưu dữ liệu Tài sản cố định thuộc phân hệ Tài sản cố định.';

COMMENT ON TABLE "fa"."fixed_asset_account_mapping" IS 'Bảng quan hệ/ánh xạ cho Tài khoản hạch toán của TSCĐ; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.';

COMMENT ON TABLE "fa"."fixed_asset_acquisition" IS 'Phần mở rộng nghiệp vụ cho Ghi tăng/Giao nhận TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "fa"."fixed_asset_transfer" IS 'Phần mở rộng nghiệp vụ cho Điều chuyển TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "fa"."fixed_asset_revaluation" IS 'Phần mở rộng nghiệp vụ cho Đánh giá lại TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "fa"."fixed_asset_disposal" IS 'Phần mở rộng nghiệp vụ cho Thanh lý/nhượng bán TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "fa"."depreciation_schedule" IS 'Lịch chi tiết cho Lịch khấu hao, dùng chia khoản phải thu/phải trả/khấu hao/phân bổ theo kỳ và làm căn cứ settlement/run.';

COMMENT ON TABLE "fa"."depreciation_run" IS 'Header của một lần xử lý Lần tính khấu hao. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.';

COMMENT ON TABLE "fa"."depreciation_run_line" IS 'Lưu chi tiết dòng của Chi tiết tính khấu hao. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "fa"."fixed_asset_maintenance_completion" IS 'Phần mở rộng nghiệp vụ cho Nghiệm thu sửa chữa/nâng cấp TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "fa"."fixed_asset_inventory" IS 'Phần mở rộng nghiệp vụ cho Kiểm kê TSCĐ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "fa"."fixed_asset_inventory_line" IS 'Lưu chi tiết dòng của Chi tiết kiểm kê TSCĐ. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "ccdc"."tool_category" IS 'Lưu dữ liệu Nhóm công cụ dụng cụ thuộc phân hệ Công cụ dụng cụ và chi phí trả trước.';

COMMENT ON TABLE "ccdc"."tool" IS 'Lưu dữ liệu Công cụ dụng cụ thuộc phân hệ Công cụ dụng cụ và chi phí trả trước.';

COMMENT ON TABLE "ccdc"."tool_issue" IS 'Phần mở rộng nghiệp vụ cho Xuất dùng công cụ dụng cụ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "ccdc"."tool_transfer" IS 'Phần mở rộng nghiệp vụ cho Điều chuyển công cụ dụng cụ. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "ccdc"."allocation_schedule" IS 'Bảng phân bổ/đối chiếu phục vụ Lịch phân bổ CCDC. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "ccdc"."allocation_run" IS 'Bảng phân bổ/đối chiếu phục vụ Lần phân bổ CCDC. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "ccdc"."allocation_run_line" IS 'Bảng phân bổ/đối chiếu phục vụ Chi tiết phân bổ CCDC. Dùng để truy vết quan hệ nhiều-nhiều theo số lượng hoặc giá trị, tránh FK polymorphic không kiểm soát.';

COMMENT ON TABLE "ccdc"."prepaid_expense" IS 'Lưu dữ liệu Chi phí trả trước thuộc phân hệ Công cụ dụng cụ và chi phí trả trước.';

COMMENT ON TABLE "ccdc"."prepaid_expense_schedule" IS 'Lịch chi tiết cho Lịch phân bổ chi phí trả trước, dùng chia khoản phải thu/phải trả/khấu hao/phân bổ theo kỳ và làm căn cứ settlement/run.';

COMMENT ON TABLE "tax"."tax_service_provider" IS 'Lưu dữ liệu Nhà cung cấp dịch vụ thuế/HĐĐT thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."einvoice_raw_payload" IS 'Lưu dữ liệu Dữ liệu HĐĐT thô thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."tax_invoice" IS 'Bản chuẩn hóa hóa đơn thuế/hóa đơn điện tử tách biệt với chứng từ kế toán. Dùng để kiểm tra hợp lệ, khấu trừ/kê khai và liên kết với chứng từ mua/bán.';

COMMENT ON TABLE "tax"."tax_invoice_line" IS 'Lưu chi tiết dòng của Chi tiết hóa đơn thuế. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "tax"."tax_invoice_link" IS 'Bảng quan hệ/ánh xạ cho Quan hệ điều chỉnh/thay thế hóa đơn; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.';

COMMENT ON TABLE "tax"."input_invoice_processing" IS 'Lưu dữ liệu Xử lý hóa đơn đầu vào thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."invoice_validation_result" IS 'Lưu dữ liệu Kết quả kiểm tra hóa đơn thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."invoice_risk_check" IS 'Lưu dữ liệu Kết quả kiểm tra rủi ro NCC thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."vat_ledger" IS 'Lưu dữ liệu Sổ VAT thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."tax_period" IS 'Lưu dữ liệu Kỳ thuế thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."tax_declaration" IS 'Phần mở rộng nghiệp vụ cho Tờ khai thuế. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "tax"."tax_declaration_line" IS 'Lưu chi tiết dòng của Chỉ tiêu tờ khai thuế. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "tax"."tax_obligation" IS 'Lưu dữ liệu Nghĩa vụ thuế phải nộp thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."tax_payment" IS 'Phần mở rộng nghiệp vụ cho Nộp thuế. Dùng chung PK `document_id` với `core.business_document`; dữ liệu header chung không lặp lại ở bảng này.';

COMMENT ON TABLE "tax"."tax_submission" IS 'Lưu dữ liệu Lần gửi tờ khai thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."tax_submission_response" IS 'Lưu dữ liệu Phản hồi nộp tờ khai thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."einvoice_sync_batch" IS 'Header của một lần xử lý Lần đồng bộ HĐĐT. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.';

COMMENT ON TABLE "tax"."tax_invoice_document_link" IS 'Bảng quan hệ/ánh xạ cho Liên kết hóa đơn thuế với chứng từ kế toán; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.';

COMMENT ON TABLE "tax"."tax_form_definition" IS 'Cấu hình/danh mục cho Định nghĩa mẫu tờ khai. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "tax"."tax_form_version" IS 'Phiên bản hóa Phiên bản mẫu tờ khai. Khi version đã được publish/được chứng từ tham chiếu thì giữ bất biến và tạo version mới khi thay đổi.';

COMMENT ON TABLE "tax"."tax_form_indicator" IS 'Lưu dữ liệu Chỉ tiêu mẫu tờ khai thuộc phân hệ Thuế và hóa đơn điện tử.';

COMMENT ON TABLE "tax"."tax_calculation_rule" IS 'Cấu hình/danh mục cho Phiên bản quy tắc tính thuế. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "gl"."account_class" IS 'Lưu dữ liệu Loại tài khoản kế toán thuộc phân hệ Kế toán tổng hợp.';

COMMENT ON TABLE "gl"."account" IS 'Danh mục tài khoản kế toán thực tế dùng ghi sổ, hỗ trợ cây cha-con, mã theo chế độ, tài khoản chi tiết và yêu cầu đối tượng theo dõi.';

COMMENT ON TABLE "gl"."fiscal_year" IS 'Lưu dữ liệu Năm tài chính thuộc phân hệ Kế toán tổng hợp.';

COMMENT ON TABLE "gl"."fiscal_period" IS 'Lưu dữ liệu Kỳ kế toán thuộc phân hệ Kế toán tổng hợp.';

COMMENT ON TABLE "gl"."period_lock" IS 'Lưu dữ liệu Khóa kỳ thuộc phân hệ Kế toán tổng hợp.';

COMMENT ON TABLE "gl"."journal_entry" IS 'Header bút toán ghi sổ. Chỉ PostingService/GLService được tạo khi POST chứng từ; không cho controller nghiệp vụ ghi trực tiếp.';

COMMENT ON TABLE "gl"."journal_entry_line" IS 'Các dòng Nợ/Có của bút toán. Là nguồn sự thật cho sổ cái, số dư tài khoản và BCTC; tổng Nợ phải bằng tổng Có ở cấp journal.';

COMMENT ON TABLE "gl"."posting_rule" IS 'Cấu hình/danh mục cho Quy tắc hạch toán tự động. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "gl"."posting_rule_line" IS 'Lưu chi tiết dòng của Dòng quy tắc hạch toán. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "gl"."posting_batch" IS 'Header của một lần xử lý Lô ghi sổ. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.';

COMMENT ON TABLE "gl"."closing_run" IS 'Header của một lần xử lý Lần kết chuyển/khóa sổ. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.';

COMMENT ON TABLE "gl"."closing_run_line" IS 'Lưu chi tiết dòng của Chi tiết kết chuyển. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "gl"."chart_of_accounts" IS 'Phiên bản hệ thống tài khoản theo doanh nghiệp/chế độ kế toán. Dùng làm container cho tài khoản TT99 và tài khoản chi tiết doanh nghiệp mở thêm.';

COMMENT ON TABLE "gl"."account_opening_balance" IS 'Bảng số dư dẫn xuất cho Số dư đầu kỳ tài khoản. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.';

COMMENT ON TABLE "gl"."account_balance" IS 'Bảng số dư dẫn xuất cho Số dư tài khoản theo kỳ. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.';

COMMENT ON TABLE "gl"."account_dimension_balance" IS 'Bảng số dư dẫn xuất cho Số dư tài khoản theo đối tượng. Không nhập tay; được cập nhật/rebuild từ subledger hoặc journal đã POST và có thể dùng tối ưu báo cáo.';

COMMENT ON TABLE "gl"."foreign_currency_revaluation_run" IS 'Header của một lần xử lý Lần đánh giá lại ngoại tệ. Dùng quản lý trạng thái chạy, kỳ, người thực hiện, idempotency và liên kết kết quả.';

COMMENT ON TABLE "gl"."foreign_currency_revaluation_line" IS 'Lưu chi tiết dòng của Chi tiết đánh giá lại ngoại tệ. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "report"."report_definition" IS 'Cấu hình/danh mục cho Định nghĩa báo cáo. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "report"."report_parameter" IS 'Phục vụ Tham số báo cáo; ReportingService đọc dữ liệu đã POST/subledger để sinh báo cáo và không ghi ngược vào nghiệp vụ nguồn.';

COMMENT ON TABLE "report"."saved_report" IS 'Phục vụ Mẫu lọc báo cáo đã lưu; ReportingService đọc dữ liệu đã POST/subledger để sinh báo cáo và không ghi ngược vào nghiệp vụ nguồn.';

COMMENT ON TABLE "report"."financial_statement_template" IS 'Định nghĩa loại BCTC pháp lý như B01-DN, B02-DN, B03-DN, B09-DN; cấu trúc thực tế nằm ở phiên bản và các chỉ tiêu.';

COMMENT ON TABLE "report"."financial_statement_template_version" IS 'Phiên bản hóa Phiên bản mẫu BCTC. Khi version đã được publish/được chứng từ tham chiếu thì giữ bất biến và tạo version mới khi thay đổi.';

COMMENT ON TABLE "report"."financial_statement_line" IS 'Lưu chi tiết dòng của Chỉ tiêu BCTC. Dòng chỉ được thay đổi khi chứng từ nguồn còn ở trạng thái cho phép; sau POST phải sửa bằng nghiệp vụ điều chỉnh/đảo.';

COMMENT ON TABLE "report"."financial_statement_account_mapping" IS 'Bảng quan hệ/ánh xạ cho Ánh xạ tài khoản vào chỉ tiêu BCTC; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.';

COMMENT ON TABLE "report"."financial_statement_run" IS 'Một lần lập BCTC cho kỳ và phạm vi báo cáo; lưu trạng thái draft/approved và người lập/duyệt, không thay thế sổ cái.';

COMMENT ON TABLE "report"."financial_statement_value" IS 'Phục vụ Giá trị chỉ tiêu BCTC; ReportingService đọc dữ liệu đã POST/subledger để sinh báo cáo và không ghi ngược vào nghiệp vụ nguồn.';

COMMENT ON TABLE "report"."accounting_book_template" IS 'Cấu hình/danh mục cho Mẫu sổ kế toán. Thay đổi phải qua permission CONFIGURE và Audit Log; không chỉnh dữ liệu lịch sử đã phát sinh.';

COMMENT ON TABLE "report"."accounting_book_template_version" IS 'Phiên bản hóa Phiên bản mẫu sổ kế toán. Khi version đã được publish/được chứng từ tham chiếu thì giữ bất biến và tạo version mới khi thay đổi.';

COMMENT ON TABLE "report"."financial_statement_adjustment" IS 'Phục vụ Điều chỉnh/loại trừ khi lập BCTC; ReportingService đọc dữ liệu đã POST/subledger để sinh báo cáo và không ghi ngược vào nghiệp vụ nguồn.';

COMMENT ON TABLE "integration"."outbox_event" IS 'Hạ tầng tích hợp cho Sự kiện Outbox. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.';

COMMENT ON TABLE "integration"."inbox_message" IS 'Hạ tầng tích hợp cho Thông điệp Inbox. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.';

COMMENT ON TABLE "integration"."api_client" IS 'Lưu dữ liệu Ứng dụng/API client thuộc phân hệ Tích hợp hệ thống.';

COMMENT ON TABLE "integration"."webhook_delivery" IS 'Hạ tầng tích hợp cho Lần gửi webhook. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.';

COMMENT ON TABLE "integration"."idempotency_key" IS 'Lưu dữ liệu Khóa chống xử lý lặp thuộc phân hệ Tích hợp hệ thống.';

COMMENT ON TABLE "integration"."external_mapping" IS 'Bảng quan hệ/ánh xạ cho Ánh xạ ID hệ thống ngoài; không phải chứng từ độc lập, dùng giữ FK vật lý và truy vết nguồn-đích.';

COMMENT ON TABLE "integration"."import_job" IS 'Hạ tầng tích hợp cho Lần nhập dữ liệu. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.';

COMMENT ON TABLE "integration"."import_row_error" IS 'Hạ tầng tích hợp cho Lỗi từng dòng import. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.';

COMMENT ON TABLE "integration"."webhook_subscription" IS 'Lưu dữ liệu Cấu hình webhook nhận sự kiện thuộc phân hệ Tích hợp hệ thống.';

COMMENT ON TABLE "integration"."sync_checkpoint" IS 'Hạ tầng tích hợp cho Mốc đồng bộ hệ thống ngoài. Dùng đảm bảo đồng bộ, retry, idempotency và truy vết dữ liệu giữa hệ thống với dịch vụ ngoài.';

ALTER TABLE "org"."branch" ADD CONSTRAINT "fk_0001" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."branch" ADD CONSTRAINT "fk_0002" FOREIGN KEY ("parent_branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."company" ADD CONSTRAINT "fk_0003" FOREIGN KEY ("accounting_currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."company" ADD CONSTRAINT "fk_0004" FOREIGN KEY ("legal_reporting_currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."department" ADD CONSTRAINT "fk_0005" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."department" ADD CONSTRAINT "fk_0006" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."department" ADD CONSTRAINT "fk_0007" FOREIGN KEY ("manager_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."department" ADD CONSTRAINT "fk_0008" FOREIGN KEY ("parent_department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."employee" ADD CONSTRAINT "fk_0009" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."employee" ADD CONSTRAINT "fk_0010" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."employee" ADD CONSTRAINT "fk_0011" FOREIGN KEY ("department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."employee" ADD CONSTRAINT "fk_0012" FOREIGN KEY ("position_id") REFERENCES "org"."position" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."employee_assignment" ADD CONSTRAINT "fk_0013" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."employee_assignment" ADD CONSTRAINT "fk_0014" FOREIGN KEY ("department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."employee_assignment" ADD CONSTRAINT "fk_0015" FOREIGN KEY ("employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."employee_assignment" ADD CONSTRAINT "fk_0016" FOREIGN KEY ("position_id") REFERENCES "org"."position" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "org"."position" ADD CONSTRAINT "fk_0017" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."company_membership" ADD CONSTRAINT "fk_0018" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."company_membership" ADD CONSTRAINT "fk_0019" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."company_membership" ADD CONSTRAINT "fk_0020" FOREIGN KEY ("employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."company_membership" ADD CONSTRAINT "fk_0021" FOREIGN KEY ("user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_bank_account" ADD CONSTRAINT "fk_0022" FOREIGN KEY ("company_bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_bank_account" ADD CONSTRAINT "fk_0023" FOREIGN KEY ("data_scope_set_id") REFERENCES "iam"."data_scope_set" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_branch" ADD CONSTRAINT "fk_0024" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_branch" ADD CONSTRAINT "fk_0025" FOREIGN KEY ("data_scope_set_id") REFERENCES "iam"."data_scope_set" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_cost_center" ADD CONSTRAINT "fk_0026" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_cost_center" ADD CONSTRAINT "fk_0027" FOREIGN KEY ("data_scope_set_id") REFERENCES "iam"."data_scope_set" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_department" ADD CONSTRAINT "fk_0028" FOREIGN KEY ("data_scope_set_id") REFERENCES "iam"."data_scope_set" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_department" ADD CONSTRAINT "fk_0029" FOREIGN KEY ("department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_project" ADD CONSTRAINT "fk_0030" FOREIGN KEY ("data_scope_set_id") REFERENCES "iam"."data_scope_set" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_project" ADD CONSTRAINT "fk_0031" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_set" ADD CONSTRAINT "fk_0032" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_set" ADD CONSTRAINT "fk_0033" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_warehouse" ADD CONSTRAINT "fk_0034" FOREIGN KEY ("data_scope_set_id") REFERENCES "iam"."data_scope_set" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."data_scope_warehouse" ADD CONSTRAINT "fk_0035" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."permission" ADD CONSTRAINT "fk_0036" FOREIGN KEY ("action_id") REFERENCES "iam"."permission_action" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."permission" ADD CONSTRAINT "fk_0037" FOREIGN KEY ("resource_id") REFERENCES "iam"."permission_resource" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."permission_bundle_item" ADD CONSTRAINT "fk_0038" FOREIGN KEY ("bundle_id") REFERENCES "iam"."permission_bundle" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."permission_bundle_item" ADD CONSTRAINT "fk_0039" FOREIGN KEY ("permission_id") REFERENCES "iam"."permission" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."role" ADD CONSTRAINT "fk_0040" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."role_permission" ADD CONSTRAINT "fk_0041" FOREIGN KEY ("permission_id") REFERENCES "iam"."permission" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."role_permission" ADD CONSTRAINT "fk_0042" FOREIGN KEY ("role_id") REFERENCES "iam"."role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."role_permission_bundle" ADD CONSTRAINT "fk_0043" FOREIGN KEY ("bundle_id") REFERENCES "iam"."permission_bundle" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."role_permission_bundle" ADD CONSTRAINT "fk_0044" FOREIGN KEY ("role_id") REFERENCES "iam"."role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."segregation_of_duties_rule" ADD CONSTRAINT "fk_0045" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."segregation_of_duties_rule" ADD CONSTRAINT "fk_0046" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."segregation_of_duties_violation" ADD CONSTRAINT "fk_0047" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."segregation_of_duties_violation" ADD CONSTRAINT "fk_0048" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."segregation_of_duties_violation" ADD CONSTRAINT "fk_0049" FOREIGN KEY ("overridden_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."segregation_of_duties_violation" ADD CONSTRAINT "fk_0050" FOREIGN KEY ("rule_id") REFERENCES "iam"."segregation_of_duties_rule" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."segregation_of_duties_violation" ADD CONSTRAINT "fk_0051" FOREIGN KEY ("user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."user_identity" ADD CONSTRAINT "fk_0052" FOREIGN KEY ("user_id") REFERENCES "iam"."user_account" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."user_role_assignment" ADD CONSTRAINT "fk_0053" FOREIGN KEY ("assigned_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."user_role_assignment" ADD CONSTRAINT "fk_0054" FOREIGN KEY ("company_membership_id") REFERENCES "iam"."company_membership" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."user_role_assignment" ADD CONSTRAINT "fk_0055" FOREIGN KEY ("data_scope_set_id") REFERENCES "iam"."data_scope_set" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."user_role_assignment" ADD CONSTRAINT "fk_0056" FOREIGN KEY ("revoked_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."user_role_assignment" ADD CONSTRAINT "fk_0057" FOREIGN KEY ("role_id") REFERENCES "iam"."role" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "iam"."user_session" ADD CONSTRAINT "fk_0058" FOREIGN KEY ("user_id") REFERENCES "iam"."user_account" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_action_log" ADD CONSTRAINT "fk_0059" FOREIGN KEY ("actor_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_action_log" ADD CONSTRAINT "fk_0060" FOREIGN KEY ("approval_instance_id") REFERENCES "workflow"."approval_instance" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_action_log" ADD CONSTRAINT "fk_0061" FOREIGN KEY ("approval_task_id") REFERENCES "workflow"."approval_task" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_condition" ADD CONSTRAINT "fk_0062" FOREIGN KEY ("approval_workflow_version_id") REFERENCES "workflow"."approval_workflow_version" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_delegation" ADD CONSTRAINT "fk_0063" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_delegation" ADD CONSTRAINT "fk_0064" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_delegation" ADD CONSTRAINT "fk_0065" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_delegation" ADD CONSTRAINT "fk_0066" FOREIGN KEY ("delegate_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_delegation" ADD CONSTRAINT "fk_0067" FOREIGN KEY ("delegator_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_delegation" ADD CONSTRAINT "fk_0068" FOREIGN KEY ("document_type_id") REFERENCES "mdm"."document_type" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_instance" ADD CONSTRAINT "fk_0069" FOREIGN KEY ("approval_workflow_version_id") REFERENCES "workflow"."approval_workflow_version" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_instance" ADD CONSTRAINT "fk_0070" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_instance" ADD CONSTRAINT "fk_0071" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_instance" ADD CONSTRAINT "fk_0072" FOREIGN KEY ("submitted_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_step" ADD CONSTRAINT "fk_0073" FOREIGN KEY ("approval_workflow_version_id") REFERENCES "workflow"."approval_workflow_version" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_step_assignee" ADD CONSTRAINT "fk_0074" FOREIGN KEY ("approval_step_id") REFERENCES "workflow"."approval_step" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_step_assignee" ADD CONSTRAINT "fk_0075" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_step_assignee" ADD CONSTRAINT "fk_0076" FOREIGN KEY ("role_id") REFERENCES "iam"."role" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_step_assignee" ADD CONSTRAINT "fk_0077" FOREIGN KEY ("user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_task" ADD CONSTRAINT "fk_0078" FOREIGN KEY ("acted_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_task" ADD CONSTRAINT "fk_0079" FOREIGN KEY ("approval_instance_id") REFERENCES "workflow"."approval_instance" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_task" ADD CONSTRAINT "fk_0080" FOREIGN KEY ("approval_step_id") REFERENCES "workflow"."approval_step" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_task" ADD CONSTRAINT "fk_0081" FOREIGN KEY ("assigned_role_id") REFERENCES "iam"."role" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_task" ADD CONSTRAINT "fk_0082" FOREIGN KEY ("assigned_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_workflow" ADD CONSTRAINT "fk_0083" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_workflow" ADD CONSTRAINT "fk_0084" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_workflow" ADD CONSTRAINT "fk_0085" FOREIGN KEY ("document_type_id") REFERENCES "mdm"."document_type" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_workflow" ADD CONSTRAINT "fk_0086" FOREIGN KEY ("updated_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_workflow_version" ADD CONSTRAINT "fk_0087" FOREIGN KEY ("approval_workflow_id") REFERENCES "workflow"."approval_workflow" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_workflow_version" ADD CONSTRAINT "fk_0088" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "workflow"."approval_workflow_version" ADD CONSTRAINT "fk_0089" FOREIGN KEY ("published_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."audit_change" ADD CONSTRAINT "fk_0090" FOREIGN KEY ("audit_log_id") REFERENCES "audit"."audit_log" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "fk_0091" FOREIGN KEY ("actor_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "fk_0092" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "fk_0093" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "fk_0094" FOREIGN KEY ("role_assignment_id") REFERENCES "iam"."user_role_assignment" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."data_export_log" ADD CONSTRAINT "fk_0095" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."data_export_log" ADD CONSTRAINT "fk_0096" FOREIGN KEY ("user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."login_log" ADD CONSTRAINT "fk_0097" FOREIGN KEY ("user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."security_event" ADD CONSTRAINT "fk_0098" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "audit"."security_event" ADD CONSTRAINT "fk_0099" FOREIGN KEY ("user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."company_bank_account" ADD CONSTRAINT "fk_0100" FOREIGN KEY ("bank_id") REFERENCES "mdm"."bank" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."company_bank_account" ADD CONSTRAINT "fk_0101" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."company_bank_account" ADD CONSTRAINT "fk_0102" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."company_bank_account" ADD CONSTRAINT "fk_0103" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."company_bank_account" ADD CONSTRAINT "fk_0104" FOREIGN KEY ("gl_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."cost_center" ADD CONSTRAINT "fk_0105" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."cost_center" ADD CONSTRAINT "fk_0106" FOREIGN KEY ("parent_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."customer_profile" ADD CONSTRAINT "fk_0107" FOREIGN KEY ("receivable_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."customer_profile" ADD CONSTRAINT "fk_0108" FOREIGN KEY ("revenue_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."customer_profile" ADD CONSTRAINT "fk_0109" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."document_numbering_rule" ADD CONSTRAINT "fk_0110" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."document_numbering_rule" ADD CONSTRAINT "fk_0111" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."document_numbering_rule" ADD CONSTRAINT "fk_0112" FOREIGN KEY ("document_type_id") REFERENCES "mdm"."document_type" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."exchange_rate" ADD CONSTRAINT "fk_0113" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."exchange_rate" ADD CONSTRAINT "fk_0114" FOREIGN KEY ("from_currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."exchange_rate" ADD CONSTRAINT "fk_0115" FOREIGN KEY ("rate_type_id") REFERENCES "mdm"."exchange_rate_type" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."exchange_rate" ADD CONSTRAINT "fk_0116" FOREIGN KEY ("source_bank_id") REFERENCES "mdm"."bank" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."exchange_rate" ADD CONSTRAINT "fk_0117" FOREIGN KEY ("to_currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."exchange_rate_type" ADD CONSTRAINT "fk_0118" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."inventory_location" ADD CONSTRAINT "fk_0119" FOREIGN KEY ("parent_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."inventory_location" ADD CONSTRAINT "fk_0120" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."item" ADD CONSTRAINT "fk_0121" FOREIGN KEY ("base_uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."item" ADD CONSTRAINT "fk_0122" FOREIGN KEY ("category_id") REFERENCES "mdm"."item_category" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."item" ADD CONSTRAINT "fk_0123" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."item" ADD CONSTRAINT "fk_0124" FOREIGN KEY ("default_tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."item_category" ADD CONSTRAINT "fk_0125" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."item_category" ADD CONSTRAINT "fk_0126" FOREIGN KEY ("parent_id") REFERENCES "mdm"."item_category" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."item_uom_conversion" ADD CONSTRAINT "fk_0127" FOREIGN KEY ("from_uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."item_uom_conversion" ADD CONSTRAINT "fk_0128" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."item_uom_conversion" ADD CONSTRAINT "fk_0129" FOREIGN KEY ("to_uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."party" ADD CONSTRAINT "fk_0130" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."party" ADD CONSTRAINT "fk_0131" FOREIGN KEY ("default_currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."party" ADD CONSTRAINT "fk_0132" FOREIGN KEY ("payment_term_id") REFERENCES "mdm"."payment_term" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."party_address" ADD CONSTRAINT "fk_0133" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."party_bank_account" ADD CONSTRAINT "fk_0134" FOREIGN KEY ("bank_id") REFERENCES "mdm"."bank" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."party_bank_account" ADD CONSTRAINT "fk_0135" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."party_contact" ADD CONSTRAINT "fk_0136" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."party_role" ADD CONSTRAINT "fk_0137" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."payment_term" ADD CONSTRAINT "fk_0138" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."project" ADD CONSTRAINT "fk_0139" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."tax_rate" ADD CONSTRAINT "fk_0140" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."unit_of_measure" ADD CONSTRAINT "fk_0141" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."vendor_profile" ADD CONSTRAINT "fk_0142" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."vendor_profile" ADD CONSTRAINT "fk_0143" FOREIGN KEY ("expense_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."vendor_profile" ADD CONSTRAINT "fk_0144" FOREIGN KEY ("payable_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."vendor_profile" ADD CONSTRAINT "fk_0145" FOREIGN KEY ("purchase_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."warehouse" ADD CONSTRAINT "fk_0146" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."warehouse" ADD CONSTRAINT "fk_0147" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "mdm"."warehouse" ADD CONSTRAINT "fk_0148" FOREIGN KEY ("keeper_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."business_document" ADD CONSTRAINT "fk_0149" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."business_document" ADD CONSTRAINT "fk_0150" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."business_document" ADD CONSTRAINT "fk_0151" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."business_document" ADD CONSTRAINT "fk_0152" FOREIGN KEY ("counterparty_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."business_document" ADD CONSTRAINT "fk_0153" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."business_document" ADD CONSTRAINT "fk_0154" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."business_document" ADD CONSTRAINT "fk_0155" FOREIGN KEY ("document_type_id") REFERENCES "mdm"."document_type" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."business_document" ADD CONSTRAINT "fk_0156" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."business_document" ADD CONSTRAINT "fk_0157" FOREIGN KEY ("updated_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."company_configuration_value" ADD CONSTRAINT "fk_0158" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."company_configuration_value" ADD CONSTRAINT "fk_0159" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."company_configuration_value" ADD CONSTRAINT "fk_0160" FOREIGN KEY ("configuration_definition_id") REFERENCES "core"."configuration_definition" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."company_configuration_value" ADD CONSTRAINT "fk_0161" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_attachment" ADD CONSTRAINT "fk_0162" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_attachment" ADD CONSTRAINT "fk_0163" FOREIGN KEY ("uploaded_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_link" ADD CONSTRAINT "fk_0164" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_link" ADD CONSTRAINT "fk_0165" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_link" ADD CONSTRAINT "fk_0166" FOREIGN KEY ("source_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_link" ADD CONSTRAINT "fk_0167" FOREIGN KEY ("target_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_lock" ADD CONSTRAINT "fk_0168" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_lock" ADD CONSTRAINT "fk_0169" FOREIGN KEY ("locked_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_note" ADD CONSTRAINT "fk_0170" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_note" ADD CONSTRAINT "fk_0171" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_number_sequence" ADD CONSTRAINT "fk_0172" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_number_sequence" ADD CONSTRAINT "fk_0173" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_number_sequence" ADD CONSTRAINT "fk_0174" FOREIGN KEY ("document_type_id") REFERENCES "mdm"."document_type" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_number_sequence" ADD CONSTRAINT "fk_0175" FOREIGN KEY ("numbering_rule_id") REFERENCES "mdm"."document_numbering_rule" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_reference" ADD CONSTRAINT "fk_0176" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_rendered_output" ADD CONSTRAINT "fk_0177" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_rendered_output" ADD CONSTRAINT "fk_0178" FOREIGN KEY ("generated_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_rendered_output" ADD CONSTRAINT "fk_0179" FOREIGN KEY ("template_version_id") REFERENCES "core"."document_template_version" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_signature" ADD CONSTRAINT "fk_0180" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_signature" ADD CONSTRAINT "fk_0181" FOREIGN KEY ("rendered_output_id") REFERENCES "core"."document_rendered_output" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_signature" ADD CONSTRAINT "fk_0182" FOREIGN KEY ("signer_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_status_history" ADD CONSTRAINT "fk_0183" FOREIGN KEY ("changed_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_status_history" ADD CONSTRAINT "fk_0184" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_template" ADD CONSTRAINT "fk_0185" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_template" ADD CONSTRAINT "fk_0186" FOREIGN KEY ("document_type_id") REFERENCES "mdm"."document_type" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "core"."document_template_version" ADD CONSTRAINT "fk_0187" FOREIGN KEY ("template_id") REFERENCES "core"."document_template" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt" ADD CONSTRAINT "fk_0188" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt" ADD CONSTRAINT "fk_0189" FOREIGN KEY ("received_by_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt" ADD CONSTRAINT "fk_0190" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt" ADD CONSTRAINT "fk_0191" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt_line" ADD CONSTRAINT "fk_0192" FOREIGN KEY ("goods_receipt_id") REFERENCES "pur"."goods_receipt" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt_line" ADD CONSTRAINT "fk_0193" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt_line" ADD CONSTRAINT "fk_0194" FOREIGN KEY ("location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt_line" ADD CONSTRAINT "fk_0195" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt_line" ADD CONSTRAINT "fk_0196" FOREIGN KEY ("purchase_order_line_id") REFERENCES "pur"."purchase_order_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."goods_receipt_line" ADD CONSTRAINT "fk_0197" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."landed_cost" ADD CONSTRAINT "fk_0198" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."landed_cost_allocation" ADD CONSTRAINT "fk_0199" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "pur"."goods_receipt_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."landed_cost_allocation" ADD CONSTRAINT "fk_0200" FOREIGN KEY ("landed_cost_line_id") REFERENCES "pur"."landed_cost_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."landed_cost_line" ADD CONSTRAINT "fk_0201" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."landed_cost_line" ADD CONSTRAINT "fk_0202" FOREIGN KEY ("landed_cost_id") REFERENCES "pur"."landed_cost" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."landed_cost_line" ADD CONSTRAINT "fk_0203" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract" ADD CONSTRAINT "fk_0204" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract" ADD CONSTRAINT "fk_0205" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract" ADD CONSTRAINT "fk_0206" FOREIGN KEY ("payment_term_id") REFERENCES "mdm"."payment_term" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract" ADD CONSTRAINT "fk_0207" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract_line" ADD CONSTRAINT "fk_0208" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract_line" ADD CONSTRAINT "fk_0209" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract_line" ADD CONSTRAINT "fk_0210" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract_line" ADD CONSTRAINT "fk_0211" FOREIGN KEY ("purchase_contract_id") REFERENCES "pur"."purchase_contract" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract_line" ADD CONSTRAINT "fk_0212" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract_line" ADD CONSTRAINT "fk_0213" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_contract_line" ADD CONSTRAINT "fk_0214" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice" ADD CONSTRAINT "fk_0215" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice" ADD CONSTRAINT "fk_0216" FOREIGN KEY ("payment_term_id") REFERENCES "mdm"."payment_term" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice" ADD CONSTRAINT "fk_0217" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line" ADD CONSTRAINT "fk_0218" FOREIGN KEY ("ap_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line" ADD CONSTRAINT "fk_0219" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line" ADD CONSTRAINT "fk_0220" FOREIGN KEY ("expense_or_inventory_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line" ADD CONSTRAINT "fk_0221" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line" ADD CONSTRAINT "fk_0222" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line" ADD CONSTRAINT "fk_0223" FOREIGN KEY ("purchase_invoice_id") REFERENCES "pur"."purchase_invoice" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line" ADD CONSTRAINT "fk_0224" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line" ADD CONSTRAINT "fk_0225" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line_goods_receipt_allocation" ADD CONSTRAINT "fk_0226" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "pur"."goods_receipt_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line_goods_receipt_allocation" ADD CONSTRAINT "fk_0227" FOREIGN KEY ("purchase_invoice_line_id") REFERENCES "pur"."purchase_invoice_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line_order_allocation" ADD CONSTRAINT "fk_0228" FOREIGN KEY ("purchase_invoice_line_id") REFERENCES "pur"."purchase_invoice_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line_order_allocation" ADD CONSTRAINT "fk_0229" FOREIGN KEY ("purchase_order_line_id") REFERENCES "pur"."purchase_order_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line_service_receipt_allocation" ADD CONSTRAINT "fk_0230" FOREIGN KEY ("purchase_invoice_line_id") REFERENCES "pur"."purchase_invoice_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_invoice_line_service_receipt_allocation" ADD CONSTRAINT "fk_0231" FOREIGN KEY ("service_receipt_line_id") REFERENCES "pur"."service_receipt_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order" ADD CONSTRAINT "fk_0232" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order" ADD CONSTRAINT "fk_0233" FOREIGN KEY ("buyer_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order" ADD CONSTRAINT "fk_0234" FOREIGN KEY ("payment_term_id") REFERENCES "mdm"."payment_term" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order" ADD CONSTRAINT "fk_0235" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order_line" ADD CONSTRAINT "fk_0236" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order_line" ADD CONSTRAINT "fk_0237" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order_line" ADD CONSTRAINT "fk_0238" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order_line" ADD CONSTRAINT "fk_0239" FOREIGN KEY ("purchase_contract_line_id") REFERENCES "pur"."purchase_contract_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order_line" ADD CONSTRAINT "fk_0240" FOREIGN KEY ("purchase_order_id") REFERENCES "pur"."purchase_order" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order_line" ADD CONSTRAINT "fk_0241" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order_line" ADD CONSTRAINT "fk_0242" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_order_line" ADD CONSTRAINT "fk_0243" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request" ADD CONSTRAINT "fk_0244" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request" ADD CONSTRAINT "fk_0245" FOREIGN KEY ("department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request" ADD CONSTRAINT "fk_0246" FOREIGN KEY ("requester_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request_line" ADD CONSTRAINT "fk_0247" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request_line" ADD CONSTRAINT "fk_0248" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request_line" ADD CONSTRAINT "fk_0249" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request_line" ADD CONSTRAINT "fk_0250" FOREIGN KEY ("purchase_request_id") REFERENCES "pur"."purchase_request" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request_line" ADD CONSTRAINT "fk_0251" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request_line" ADD CONSTRAINT "fk_0252" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request_order_allocation" ADD CONSTRAINT "fk_0253" FOREIGN KEY ("purchase_order_line_id") REFERENCES "pur"."purchase_order_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_request_order_allocation" ADD CONSTRAINT "fk_0254" FOREIGN KEY ("purchase_request_line_id") REFERENCES "pur"."purchase_request_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_return" ADD CONSTRAINT "fk_0255" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_return" ADD CONSTRAINT "fk_0256" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_return" ADD CONSTRAINT "fk_0257" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_return_line" ADD CONSTRAINT "fk_0258" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_return_line" ADD CONSTRAINT "fk_0259" FOREIGN KEY ("original_invoice_line_id") REFERENCES "pur"."purchase_invoice_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_return_line" ADD CONSTRAINT "fk_0260" FOREIGN KEY ("original_receipt_line_id") REFERENCES "pur"."goods_receipt_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_return_line" ADD CONSTRAINT "fk_0261" FOREIGN KEY ("purchase_return_id") REFERENCES "pur"."purchase_return" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_return_line" ADD CONSTRAINT "fk_0262" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."purchase_return_line" ADD CONSTRAINT "fk_0263" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."service_receipt" ADD CONSTRAINT "fk_0264" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."service_receipt" ADD CONSTRAINT "fk_0265" FOREIGN KEY ("accepted_by_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."service_receipt" ADD CONSTRAINT "fk_0266" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."service_receipt_line" ADD CONSTRAINT "fk_0267" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."service_receipt_line" ADD CONSTRAINT "fk_0268" FOREIGN KEY ("expense_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."service_receipt_line" ADD CONSTRAINT "fk_0269" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."service_receipt_line" ADD CONSTRAINT "fk_0270" FOREIGN KEY ("purchase_order_line_id") REFERENCES "pur"."purchase_order_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "pur"."service_receipt_line" ADD CONSTRAINT "fk_0271" FOREIGN KEY ("service_receipt_id") REFERENCES "pur"."service_receipt" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_adjustment" ADD CONSTRAINT "fk_0272" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_adjustment" ADD CONSTRAINT "fk_0273" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_adjustment" ADD CONSTRAINT "fk_0274" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_adjustment_line" ADD CONSTRAINT "fk_0275" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_adjustment_line" ADD CONSTRAINT "fk_0276" FOREIGN KEY ("payable_adjustment_id") REFERENCES "ap"."payable_adjustment" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_adjustment_line" ADD CONSTRAINT "fk_0277" FOREIGN KEY ("payable_open_item_id") REFERENCES "ap"."payable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_offset" ADD CONSTRAINT "fk_0278" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_offset" ADD CONSTRAINT "fk_0279" FOREIGN KEY ("receivable_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_offset" ADD CONSTRAINT "fk_0280" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_offset" ADD CONSTRAINT "fk_0281" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_offset_line" ADD CONSTRAINT "fk_0282" FOREIGN KEY ("payable_offset_id") REFERENCES "ap"."payable_offset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_offset_line" ADD CONSTRAINT "fk_0283" FOREIGN KEY ("payable_open_item_id") REFERENCES "ap"."payable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_offset_line" ADD CONSTRAINT "fk_0284" FOREIGN KEY ("receivable_open_item_id") REFERENCES "ar"."receivable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_open_item" ADD CONSTRAINT "fk_0285" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_open_item" ADD CONSTRAINT "fk_0286" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_open_item" ADD CONSTRAINT "fk_0287" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_open_item" ADD CONSTRAINT "fk_0288" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_open_item" ADD CONSTRAINT "fk_0289" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_open_item" ADD CONSTRAINT "fk_0290" FOREIGN KEY ("source_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_schedule" ADD CONSTRAINT "fk_0291" FOREIGN KEY ("open_item_id") REFERENCES "ap"."payable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_settlement" ADD CONSTRAINT "fk_0292" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_settlement" ADD CONSTRAINT "fk_0293" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_settlement" ADD CONSTRAINT "fk_0294" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_settlement" ADD CONSTRAINT "fk_0295" FOREIGN KEY ("settlement_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_settlement_line" ADD CONSTRAINT "fk_0296" FOREIGN KEY ("open_item_id") REFERENCES "ap"."payable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_settlement_line" ADD CONSTRAINT "fk_0297" FOREIGN KEY ("schedule_id") REFERENCES "ap"."payable_schedule" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."payable_settlement_line" ADD CONSTRAINT "fk_0298" FOREIGN KEY ("settlement_id") REFERENCES "ap"."payable_settlement" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."vendor_advance" ADD CONSTRAINT "fk_0299" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."vendor_advance" ADD CONSTRAINT "fk_0300" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."vendor_advance" ADD CONSTRAINT "fk_0301" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."vendor_advance" ADD CONSTRAINT "fk_0302" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."vendor_advance" ADD CONSTRAINT "fk_0303" FOREIGN KEY ("payment_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."vendor_advance_application" ADD CONSTRAINT "fk_0304" FOREIGN KEY ("payable_open_item_id") REFERENCES "ap"."payable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."vendor_advance_application" ADD CONSTRAINT "fk_0305" FOREIGN KEY ("settlement_id") REFERENCES "ap"."payable_settlement" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ap"."vendor_advance_application" ADD CONSTRAINT "fk_0306" FOREIGN KEY ("vendor_advance_id") REFERENCES "ap"."vendor_advance" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery" ADD CONSTRAINT "fk_0307" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery" ADD CONSTRAINT "fk_0308" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery" ADD CONSTRAINT "fk_0309" FOREIGN KEY ("delivered_by_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery" ADD CONSTRAINT "fk_0310" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery_line" ADD CONSTRAINT "fk_0311" FOREIGN KEY ("delivery_id") REFERENCES "sal"."delivery" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery_line" ADD CONSTRAINT "fk_0312" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery_line" ADD CONSTRAINT "fk_0313" FOREIGN KEY ("location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery_line" ADD CONSTRAINT "fk_0314" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery_line" ADD CONSTRAINT "fk_0315" FOREIGN KEY ("sales_order_line_id") REFERENCES "sal"."sales_order_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."delivery_line" ADD CONSTRAINT "fk_0316" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."quotation" ADD CONSTRAINT "fk_0317" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."quotation" ADD CONSTRAINT "fk_0318" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."quotation" ADD CONSTRAINT "fk_0319" FOREIGN KEY ("payment_term_id") REFERENCES "mdm"."payment_term" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."quotation" ADD CONSTRAINT "fk_0320" FOREIGN KEY ("sales_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."quotation_line" ADD CONSTRAINT "fk_0321" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."quotation_line" ADD CONSTRAINT "fk_0322" FOREIGN KEY ("quotation_id") REFERENCES "sal"."quotation" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."quotation_line" ADD CONSTRAINT "fk_0323" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."quotation_line" ADD CONSTRAINT "fk_0324" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_contract" ADD CONSTRAINT "fk_0325" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_contract" ADD CONSTRAINT "fk_0326" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_contract" ADD CONSTRAINT "fk_0327" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_contract" ADD CONSTRAINT "fk_0328" FOREIGN KEY ("payment_term_id") REFERENCES "mdm"."payment_term" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_contract_line" ADD CONSTRAINT "fk_0329" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_contract_line" ADD CONSTRAINT "fk_0330" FOREIGN KEY ("sales_contract_id") REFERENCES "sal"."sales_contract" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_contract_line" ADD CONSTRAINT "fk_0331" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_contract_line" ADD CONSTRAINT "fk_0332" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_contract_line" ADD CONSTRAINT "fk_0333" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice" ADD CONSTRAINT "fk_0334" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice" ADD CONSTRAINT "fk_0335" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice" ADD CONSTRAINT "fk_0336" FOREIGN KEY ("payment_term_id") REFERENCES "mdm"."payment_term" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line" ADD CONSTRAINT "fk_0337" FOREIGN KEY ("ar_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line" ADD CONSTRAINT "fk_0338" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line" ADD CONSTRAINT "fk_0339" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line" ADD CONSTRAINT "fk_0340" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line" ADD CONSTRAINT "fk_0341" FOREIGN KEY ("revenue_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line" ADD CONSTRAINT "fk_0342" FOREIGN KEY ("sales_invoice_id") REFERENCES "sal"."sales_invoice" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line" ADD CONSTRAINT "fk_0343" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line" ADD CONSTRAINT "fk_0344" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line_delivery_allocation" ADD CONSTRAINT "fk_0345" FOREIGN KEY ("delivery_line_id") REFERENCES "sal"."delivery_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line_delivery_allocation" ADD CONSTRAINT "fk_0346" FOREIGN KEY ("sales_invoice_line_id") REFERENCES "sal"."sales_invoice_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line_order_allocation" ADD CONSTRAINT "fk_0347" FOREIGN KEY ("sales_invoice_line_id") REFERENCES "sal"."sales_invoice_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_invoice_line_order_allocation" ADD CONSTRAINT "fk_0348" FOREIGN KEY ("sales_order_line_id") REFERENCES "sal"."sales_order_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order" ADD CONSTRAINT "fk_0349" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order" ADD CONSTRAINT "fk_0350" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order" ADD CONSTRAINT "fk_0351" FOREIGN KEY ("payment_term_id") REFERENCES "mdm"."payment_term" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order" ADD CONSTRAINT "fk_0352" FOREIGN KEY ("sales_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order_line" ADD CONSTRAINT "fk_0353" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order_line" ADD CONSTRAINT "fk_0354" FOREIGN KEY ("quotation_line_id") REFERENCES "sal"."quotation_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order_line" ADD CONSTRAINT "fk_0355" FOREIGN KEY ("sales_contract_line_id") REFERENCES "sal"."sales_contract_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order_line" ADD CONSTRAINT "fk_0356" FOREIGN KEY ("sales_order_id") REFERENCES "sal"."sales_order" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order_line" ADD CONSTRAINT "fk_0357" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order_line" ADD CONSTRAINT "fk_0358" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_order_line" ADD CONSTRAINT "fk_0359" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_return" ADD CONSTRAINT "fk_0360" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_return" ADD CONSTRAINT "fk_0361" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_return" ADD CONSTRAINT "fk_0362" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_return_line" ADD CONSTRAINT "fk_0363" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_return_line" ADD CONSTRAINT "fk_0364" FOREIGN KEY ("original_delivery_line_id") REFERENCES "sal"."delivery_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_return_line" ADD CONSTRAINT "fk_0365" FOREIGN KEY ("original_invoice_line_id") REFERENCES "sal"."sales_invoice_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_return_line" ADD CONSTRAINT "fk_0366" FOREIGN KEY ("sales_return_id") REFERENCES "sal"."sales_return" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_return_line" ADD CONSTRAINT "fk_0367" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "sal"."sales_return_line" ADD CONSTRAINT "fk_0368" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."customer_advance" ADD CONSTRAINT "fk_0369" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."customer_advance" ADD CONSTRAINT "fk_0370" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."customer_advance" ADD CONSTRAINT "fk_0371" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."customer_advance" ADD CONSTRAINT "fk_0372" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."customer_advance" ADD CONSTRAINT "fk_0373" FOREIGN KEY ("receipt_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."customer_advance_application" ADD CONSTRAINT "fk_0374" FOREIGN KEY ("customer_advance_id") REFERENCES "ar"."customer_advance" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."customer_advance_application" ADD CONSTRAINT "fk_0375" FOREIGN KEY ("receivable_open_item_id") REFERENCES "ar"."receivable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."customer_advance_application" ADD CONSTRAINT "fk_0376" FOREIGN KEY ("settlement_id") REFERENCES "ar"."receivable_settlement" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_adjustment" ADD CONSTRAINT "fk_0377" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_adjustment" ADD CONSTRAINT "fk_0378" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_adjustment" ADD CONSTRAINT "fk_0379" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_adjustment_line" ADD CONSTRAINT "fk_0380" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_adjustment_line" ADD CONSTRAINT "fk_0381" FOREIGN KEY ("receivable_adjustment_id") REFERENCES "ar"."receivable_adjustment" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_adjustment_line" ADD CONSTRAINT "fk_0382" FOREIGN KEY ("receivable_open_item_id") REFERENCES "ar"."receivable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_offset" ADD CONSTRAINT "fk_0383" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_offset" ADD CONSTRAINT "fk_0384" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_offset" ADD CONSTRAINT "fk_0385" FOREIGN KEY ("payable_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_offset" ADD CONSTRAINT "fk_0386" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_offset_line" ADD CONSTRAINT "fk_0387" FOREIGN KEY ("payable_open_item_id") REFERENCES "ap"."payable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_offset_line" ADD CONSTRAINT "fk_0388" FOREIGN KEY ("receivable_offset_id") REFERENCES "ar"."receivable_offset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_offset_line" ADD CONSTRAINT "fk_0389" FOREIGN KEY ("receivable_open_item_id") REFERENCES "ar"."receivable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_open_item" ADD CONSTRAINT "fk_0390" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_open_item" ADD CONSTRAINT "fk_0391" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_open_item" ADD CONSTRAINT "fk_0392" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_open_item" ADD CONSTRAINT "fk_0393" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_open_item" ADD CONSTRAINT "fk_0394" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_open_item" ADD CONSTRAINT "fk_0395" FOREIGN KEY ("source_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_schedule" ADD CONSTRAINT "fk_0396" FOREIGN KEY ("open_item_id") REFERENCES "ar"."receivable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_settlement" ADD CONSTRAINT "fk_0397" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_settlement" ADD CONSTRAINT "fk_0398" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_settlement" ADD CONSTRAINT "fk_0399" FOREIGN KEY ("customer_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_settlement" ADD CONSTRAINT "fk_0400" FOREIGN KEY ("settlement_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_settlement_line" ADD CONSTRAINT "fk_0401" FOREIGN KEY ("open_item_id") REFERENCES "ar"."receivable_open_item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_settlement_line" ADD CONSTRAINT "fk_0402" FOREIGN KEY ("schedule_id") REFERENCES "ar"."receivable_schedule" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ar"."receivable_settlement_line" ADD CONSTRAINT "fk_0403" FOREIGN KEY ("settlement_id") REFERENCES "ar"."receivable_settlement" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."advance_request" ADD CONSTRAINT "fk_0404" FOREIGN KEY ("employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."advance_request" ADD CONSTRAINT "fk_0405" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."advance_settlement" ADD CONSTRAINT "fk_0406" FOREIGN KEY ("advance_document_id") REFERENCES "cash"."advance_request" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."advance_settlement" ADD CONSTRAINT "fk_0407" FOREIGN KEY ("employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."advance_settlement" ADD CONSTRAINT "fk_0408" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_book_entry" ADD CONSTRAINT "fk_0409" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_book_entry" ADD CONSTRAINT "fk_0410" FOREIGN KEY ("cash_fund_id") REFERENCES "cash"."cash_fund" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_book_entry" ADD CONSTRAINT "fk_0411" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_book_entry" ADD CONSTRAINT "fk_0412" FOREIGN KEY ("source_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_count" ADD CONSTRAINT "fk_0413" FOREIGN KEY ("cash_fund_id") REFERENCES "cash"."cash_fund" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_count" ADD CONSTRAINT "fk_0414" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_fund" ADD CONSTRAINT "fk_0415" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_fund" ADD CONSTRAINT "fk_0416" FOREIGN KEY ("cash_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_fund" ADD CONSTRAINT "fk_0417" FOREIGN KEY ("cashier_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_fund" ADD CONSTRAINT "fk_0418" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_fund" ADD CONSTRAINT "fk_0419" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_payment" ADD CONSTRAINT "fk_0420" FOREIGN KEY ("cash_fund_id") REFERENCES "cash"."cash_fund" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_payment" ADD CONSTRAINT "fk_0421" FOREIGN KEY ("payee_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_payment" ADD CONSTRAINT "fk_0422" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_payment_line" ADD CONSTRAINT "fk_0423" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_payment_line" ADD CONSTRAINT "fk_0424" FOREIGN KEY ("cash_payment_id") REFERENCES "cash"."cash_payment" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_payment_line" ADD CONSTRAINT "fk_0425" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_payment_line" ADD CONSTRAINT "fk_0426" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_payment_line" ADD CONSTRAINT "fk_0427" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_receipt" ADD CONSTRAINT "fk_0428" FOREIGN KEY ("cash_fund_id") REFERENCES "cash"."cash_fund" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_receipt" ADD CONSTRAINT "fk_0429" FOREIGN KEY ("payer_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_receipt" ADD CONSTRAINT "fk_0430" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_receipt_line" ADD CONSTRAINT "fk_0431" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_receipt_line" ADD CONSTRAINT "fk_0432" FOREIGN KEY ("cash_receipt_id") REFERENCES "cash"."cash_receipt" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_receipt_line" ADD CONSTRAINT "fk_0433" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_receipt_line" ADD CONSTRAINT "fk_0434" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."cash_receipt_line" ADD CONSTRAINT "fk_0435" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."payment_request" ADD CONSTRAINT "fk_0436" FOREIGN KEY ("payee_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."payment_request" ADD CONSTRAINT "fk_0437" FOREIGN KEY ("requester_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "cash"."payment_request" ADD CONSTRAINT "fk_0438" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_book_entry" ADD CONSTRAINT "fk_0439" FOREIGN KEY ("bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_book_entry" ADD CONSTRAINT "fk_0440" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_book_entry" ADD CONSTRAINT "fk_0441" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_book_entry" ADD CONSTRAINT "fk_0442" FOREIGN KEY ("source_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_payment" ADD CONSTRAINT "fk_0443" FOREIGN KEY ("bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_payment" ADD CONSTRAINT "fk_0444" FOREIGN KEY ("payee_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_payment" ADD CONSTRAINT "fk_0445" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_payment_line" ADD CONSTRAINT "fk_0446" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_payment_line" ADD CONSTRAINT "fk_0447" FOREIGN KEY ("bank_payment_id") REFERENCES "bank"."bank_payment" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_payment_line" ADD CONSTRAINT "fk_0448" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_payment_line" ADD CONSTRAINT "fk_0449" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_payment_line" ADD CONSTRAINT "fk_0450" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_receipt" ADD CONSTRAINT "fk_0451" FOREIGN KEY ("bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_receipt" ADD CONSTRAINT "fk_0452" FOREIGN KEY ("payer_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_receipt" ADD CONSTRAINT "fk_0453" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_receipt_line" ADD CONSTRAINT "fk_0454" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_receipt_line" ADD CONSTRAINT "fk_0455" FOREIGN KEY ("bank_receipt_id") REFERENCES "bank"."bank_receipt" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_receipt_line" ADD CONSTRAINT "fk_0456" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_receipt_line" ADD CONSTRAINT "fk_0457" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_receipt_line" ADD CONSTRAINT "fk_0458" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_transfer" ADD CONSTRAINT "fk_0459" FOREIGN KEY ("from_bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_transfer" ADD CONSTRAINT "fk_0460" FOREIGN KEY ("to_bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."bank_transfer" ADD CONSTRAINT "fk_0461" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."payment_order" ADD CONSTRAINT "fk_0462" FOREIGN KEY ("bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."payment_order" ADD CONSTRAINT "fk_0463" FOREIGN KEY ("beneficiary_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."payment_order" ADD CONSTRAINT "fk_0464" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."reconciliation" ADD CONSTRAINT "fk_0465" FOREIGN KEY ("bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."reconciliation" ADD CONSTRAINT "fk_0466" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."reconciliation" ADD CONSTRAINT "fk_0467" FOREIGN KEY ("completed_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."reconciliation" ADD CONSTRAINT "fk_0468" FOREIGN KEY ("started_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."reconciliation" ADD CONSTRAINT "fk_0469" FOREIGN KEY ("statement_id") REFERENCES "bank"."statement" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."reconciliation_line" ADD CONSTRAINT "fk_0470" FOREIGN KEY ("matched_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."reconciliation_line" ADD CONSTRAINT "fk_0471" FOREIGN KEY ("reconciliation_id") REFERENCES "bank"."reconciliation" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."reconciliation_line" ADD CONSTRAINT "fk_0472" FOREIGN KEY ("statement_line_id") REFERENCES "bank"."statement_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."statement" ADD CONSTRAINT "fk_0473" FOREIGN KEY ("bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."statement" ADD CONSTRAINT "fk_0474" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "bank"."statement_line" ADD CONSTRAINT "fk_0475" FOREIGN KEY ("statement_id") REFERENCES "bank"."statement" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_balance" ADD CONSTRAINT "fk_0476" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_balance" ADD CONSTRAINT "fk_0477" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_balance" ADD CONSTRAINT "fk_0478" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_cost_allocation" ADD CONSTRAINT "fk_0479" FOREIGN KEY ("cost_layer_id") REFERENCES "inv"."inventory_cost_layer" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_cost_allocation" ADD CONSTRAINT "fk_0480" FOREIGN KEY ("costing_run_id") REFERENCES "inv"."inventory_costing_run" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_cost_allocation" ADD CONSTRAINT "fk_0481" FOREIGN KEY ("outbound_movement_id") REFERENCES "inv"."stock_movement" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_cost_layer" ADD CONSTRAINT "fk_0482" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_cost_layer" ADD CONSTRAINT "fk_0483" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_cost_layer" ADD CONSTRAINT "fk_0484" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_cost_layer" ADD CONSTRAINT "fk_0485" FOREIGN KEY ("source_movement_id") REFERENCES "inv"."stock_movement" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_cost_layer" ADD CONSTRAINT "fk_0486" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_costing_run" ADD CONSTRAINT "fk_0487" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_costing_run" ADD CONSTRAINT "fk_0488" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_costing_run" ADD CONSTRAINT "fk_0489" FOREIGN KEY ("started_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_costing_run" ADD CONSTRAINT "fk_0490" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_inspection" ADD CONSTRAINT "fk_0491" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_inspection" ADD CONSTRAINT "fk_0492" FOREIGN KEY ("supplier_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_inspection" ADD CONSTRAINT "fk_0493" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_inspection_line" ADD CONSTRAINT "fk_0494" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "pur"."goods_receipt_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_inspection_line" ADD CONSTRAINT "fk_0495" FOREIGN KEY ("inventory_inspection_id") REFERENCES "inv"."inventory_inspection" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_inspection_line" ADD CONSTRAINT "fk_0496" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_inspection_line" ADD CONSTRAINT "fk_0497" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_location_balance" ADD CONSTRAINT "fk_0498" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_location_balance" ADD CONSTRAINT "fk_0499" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_location_balance" ADD CONSTRAINT "fk_0500" FOREIGN KEY ("location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_location_balance" ADD CONSTRAINT "fk_0501" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_lot_balance" ADD CONSTRAINT "fk_0502" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_lot_balance" ADD CONSTRAINT "fk_0503" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_lot_balance" ADD CONSTRAINT "fk_0504" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."inventory_lot_balance" ADD CONSTRAINT "fk_0505" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."lot" ADD CONSTRAINT "fk_0506" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."lot" ADD CONSTRAINT "fk_0507" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."serial_number" ADD CONSTRAINT "fk_0508" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."serial_number" ADD CONSTRAINT "fk_0509" FOREIGN KEY ("current_location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."serial_number" ADD CONSTRAINT "fk_0510" FOREIGN KEY ("current_warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."serial_number" ADD CONSTRAINT "fk_0511" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_adjustment" ADD CONSTRAINT "fk_0512" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_adjustment" ADD CONSTRAINT "fk_0513" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_adjustment_line" ADD CONSTRAINT "fk_0514" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_adjustment_line" ADD CONSTRAINT "fk_0515" FOREIGN KEY ("location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_adjustment_line" ADD CONSTRAINT "fk_0516" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_adjustment_line" ADD CONSTRAINT "fk_0517" FOREIGN KEY ("stock_adjustment_id") REFERENCES "inv"."stock_adjustment" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_adjustment_line" ADD CONSTRAINT "fk_0518" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_issue" ADD CONSTRAINT "fk_0519" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_issue" ADD CONSTRAINT "fk_0520" FOREIGN KEY ("issued_by_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_issue" ADD CONSTRAINT "fk_0521" FOREIGN KEY ("recipient_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_issue" ADD CONSTRAINT "fk_0522" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_issue_line" ADD CONSTRAINT "fk_0523" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_issue_line" ADD CONSTRAINT "fk_0524" FOREIGN KEY ("location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_issue_line" ADD CONSTRAINT "fk_0525" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_issue_line" ADD CONSTRAINT "fk_0526" FOREIGN KEY ("stock_issue_id") REFERENCES "inv"."stock_issue" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_issue_line" ADD CONSTRAINT "fk_0527" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_movement" ADD CONSTRAINT "fk_0528" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_movement" ADD CONSTRAINT "fk_0529" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_movement" ADD CONSTRAINT "fk_0530" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_movement" ADD CONSTRAINT "fk_0531" FOREIGN KEY ("location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_movement" ADD CONSTRAINT "fk_0532" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_movement" ADD CONSTRAINT "fk_0533" FOREIGN KEY ("source_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_movement" ADD CONSTRAINT "fk_0534" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_receipt" ADD CONSTRAINT "fk_0535" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_receipt" ADD CONSTRAINT "fk_0536" FOREIGN KEY ("received_by_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_receipt" ADD CONSTRAINT "fk_0537" FOREIGN KEY ("source_party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_receipt" ADD CONSTRAINT "fk_0538" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_receipt_line" ADD CONSTRAINT "fk_0539" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_receipt_line" ADD CONSTRAINT "fk_0540" FOREIGN KEY ("location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_receipt_line" ADD CONSTRAINT "fk_0541" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_receipt_line" ADD CONSTRAINT "fk_0542" FOREIGN KEY ("stock_receipt_id") REFERENCES "inv"."stock_receipt" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_receipt_line" ADD CONSTRAINT "fk_0543" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_transfer" ADD CONSTRAINT "fk_0544" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_transfer" ADD CONSTRAINT "fk_0545" FOREIGN KEY ("from_warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_transfer" ADD CONSTRAINT "fk_0546" FOREIGN KEY ("to_warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_transfer_line" ADD CONSTRAINT "fk_0547" FOREIGN KEY ("from_location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_transfer_line" ADD CONSTRAINT "fk_0548" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_transfer_line" ADD CONSTRAINT "fk_0549" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_transfer_line" ADD CONSTRAINT "fk_0550" FOREIGN KEY ("stock_transfer_id") REFERENCES "inv"."stock_transfer" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_transfer_line" ADD CONSTRAINT "fk_0551" FOREIGN KEY ("to_location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stock_transfer_line" ADD CONSTRAINT "fk_0552" FOREIGN KEY ("uom_id") REFERENCES "mdm"."unit_of_measure" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stocktake" ADD CONSTRAINT "fk_0553" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stocktake" ADD CONSTRAINT "fk_0554" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stocktake_line" ADD CONSTRAINT "fk_0555" FOREIGN KEY ("item_id") REFERENCES "mdm"."item" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stocktake_line" ADD CONSTRAINT "fk_0556" FOREIGN KEY ("location_id") REFERENCES "mdm"."inventory_location" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stocktake_line" ADD CONSTRAINT "fk_0557" FOREIGN KEY ("lot_id") REFERENCES "inv"."lot" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "inv"."stocktake_line" ADD CONSTRAINT "fk_0558" FOREIGN KEY ("stocktake_id") REFERENCES "inv"."stocktake" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_method" ADD CONSTRAINT "fk_0559" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_run" ADD CONSTRAINT "fk_0560" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_run" ADD CONSTRAINT "fk_0561" FOREIGN KEY ("created_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_run" ADD CONSTRAINT "fk_0562" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_run" ADD CONSTRAINT "fk_0563" FOREIGN KEY ("journal_entry_id") REFERENCES "gl"."journal_entry" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_run_line" ADD CONSTRAINT "fk_0564" FOREIGN KEY ("accum_depr_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_run_line" ADD CONSTRAINT "fk_0565" FOREIGN KEY ("asset_id") REFERENCES "fa"."fixed_asset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_run_line" ADD CONSTRAINT "fk_0566" FOREIGN KEY ("depreciation_run_id") REFERENCES "fa"."depreciation_run" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_run_line" ADD CONSTRAINT "fk_0567" FOREIGN KEY ("expense_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."depreciation_schedule" ADD CONSTRAINT "fk_0568" FOREIGN KEY ("asset_id") REFERENCES "fa"."fixed_asset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset" ADD CONSTRAINT "fk_0569" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset" ADD CONSTRAINT "fk_0570" FOREIGN KEY ("category_id") REFERENCES "fa"."fixed_asset_category" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset" ADD CONSTRAINT "fk_0571" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset" ADD CONSTRAINT "fk_0572" FOREIGN KEY ("custodian_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset" ADD CONSTRAINT "fk_0573" FOREIGN KEY ("department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset" ADD CONSTRAINT "fk_0574" FOREIGN KEY ("depreciation_method_id") REFERENCES "fa"."depreciation_method" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_account_mapping" ADD CONSTRAINT "fk_0575" FOREIGN KEY ("asset_id") REFERENCES "fa"."fixed_asset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_account_mapping" ADD CONSTRAINT "fk_0576" FOREIGN KEY ("accum_depr_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_account_mapping" ADD CONSTRAINT "fk_0577" FOREIGN KEY ("asset_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_account_mapping" ADD CONSTRAINT "fk_0578" FOREIGN KEY ("depreciation_expense_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_acquisition" ADD CONSTRAINT "fk_0579" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_acquisition" ADD CONSTRAINT "fk_0580" FOREIGN KEY ("asset_id") REFERENCES "fa"."fixed_asset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_acquisition" ADD CONSTRAINT "fk_0581" FOREIGN KEY ("source_invoice_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_category" ADD CONSTRAINT "fk_0582" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_disposal" ADD CONSTRAINT "fk_0583" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_disposal" ADD CONSTRAINT "fk_0584" FOREIGN KEY ("asset_id") REFERENCES "fa"."fixed_asset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_inventory" ADD CONSTRAINT "fk_0585" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_inventory" ADD CONSTRAINT "fk_0586" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_inventory" ADD CONSTRAINT "fk_0587" FOREIGN KEY ("department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_inventory_line" ADD CONSTRAINT "fk_0588" FOREIGN KEY ("fixed_asset_id") REFERENCES "fa"."fixed_asset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_inventory_line" ADD CONSTRAINT "fk_0589" FOREIGN KEY ("fixed_asset_inventory_id") REFERENCES "fa"."fixed_asset_inventory" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_maintenance_completion" ADD CONSTRAINT "fk_0590" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_maintenance_completion" ADD CONSTRAINT "fk_0591" FOREIGN KEY ("fixed_asset_id") REFERENCES "fa"."fixed_asset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_maintenance_completion" ADD CONSTRAINT "fk_0592" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_revaluation" ADD CONSTRAINT "fk_0593" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_revaluation" ADD CONSTRAINT "fk_0594" FOREIGN KEY ("asset_id") REFERENCES "fa"."fixed_asset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_transfer" ADD CONSTRAINT "fk_0595" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_transfer" ADD CONSTRAINT "fk_0596" FOREIGN KEY ("asset_id") REFERENCES "fa"."fixed_asset" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_transfer" ADD CONSTRAINT "fk_0597" FOREIGN KEY ("from_branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_transfer" ADD CONSTRAINT "fk_0598" FOREIGN KEY ("from_department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_transfer" ADD CONSTRAINT "fk_0599" FOREIGN KEY ("to_branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "fa"."fixed_asset_transfer" ADD CONSTRAINT "fk_0600" FOREIGN KEY ("to_department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_run" ADD CONSTRAINT "fk_0601" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_run" ADD CONSTRAINT "fk_0602" FOREIGN KEY ("created_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_run" ADD CONSTRAINT "fk_0603" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_run" ADD CONSTRAINT "fk_0604" FOREIGN KEY ("journal_entry_id") REFERENCES "gl"."journal_entry" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_run_line" ADD CONSTRAINT "fk_0605" FOREIGN KEY ("allocation_run_id") REFERENCES "ccdc"."allocation_run" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_run_line" ADD CONSTRAINT "fk_0606" FOREIGN KEY ("expense_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_run_line" ADD CONSTRAINT "fk_0607" FOREIGN KEY ("prepaid_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_run_line" ADD CONSTRAINT "fk_0608" FOREIGN KEY ("tool_id") REFERENCES "ccdc"."tool" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_schedule" ADD CONSTRAINT "fk_0609" FOREIGN KEY ("expense_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."allocation_schedule" ADD CONSTRAINT "fk_0610" FOREIGN KEY ("tool_id") REFERENCES "ccdc"."tool" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."prepaid_expense" ADD CONSTRAINT "fk_0611" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."prepaid_expense" ADD CONSTRAINT "fk_0612" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."prepaid_expense" ADD CONSTRAINT "fk_0613" FOREIGN KEY ("expense_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."prepaid_expense" ADD CONSTRAINT "fk_0614" FOREIGN KEY ("prepaid_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."prepaid_expense" ADD CONSTRAINT "fk_0615" FOREIGN KEY ("source_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."prepaid_expense_schedule" ADD CONSTRAINT "fk_0616" FOREIGN KEY ("prepaid_expense_id") REFERENCES "ccdc"."prepaid_expense" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool" ADD CONSTRAINT "fk_0617" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool" ADD CONSTRAINT "fk_0618" FOREIGN KEY ("category_id") REFERENCES "ccdc"."tool_category" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool" ADD CONSTRAINT "fk_0619" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool" ADD CONSTRAINT "fk_0620" FOREIGN KEY ("custodian_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool" ADD CONSTRAINT "fk_0621" FOREIGN KEY ("department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_category" ADD CONSTRAINT "fk_0622" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_issue" ADD CONSTRAINT "fk_0623" FOREIGN KEY ("department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_issue" ADD CONSTRAINT "fk_0624" FOREIGN KEY ("employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_issue" ADD CONSTRAINT "fk_0625" FOREIGN KEY ("tool_id") REFERENCES "ccdc"."tool" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_issue" ADD CONSTRAINT "fk_0626" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_transfer" ADD CONSTRAINT "fk_0627" FOREIGN KEY ("from_department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_transfer" ADD CONSTRAINT "fk_0628" FOREIGN KEY ("from_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_transfer" ADD CONSTRAINT "fk_0629" FOREIGN KEY ("to_department_id") REFERENCES "org"."department" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_transfer" ADD CONSTRAINT "fk_0630" FOREIGN KEY ("to_employee_id") REFERENCES "org"."employee" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_transfer" ADD CONSTRAINT "fk_0631" FOREIGN KEY ("tool_id") REFERENCES "ccdc"."tool" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ccdc"."tool_transfer" ADD CONSTRAINT "fk_0632" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."einvoice_raw_payload" ADD CONSTRAINT "fk_0633" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."einvoice_raw_payload" ADD CONSTRAINT "fk_0634" FOREIGN KEY ("provider_id") REFERENCES "tax"."tax_service_provider" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."einvoice_sync_batch" ADD CONSTRAINT "fk_0635" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."einvoice_sync_batch" ADD CONSTRAINT "fk_0636" FOREIGN KEY ("provider_id") REFERENCES "tax"."tax_service_provider" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."input_invoice_processing" ADD CONSTRAINT "fk_0637" FOREIGN KEY ("linked_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."input_invoice_processing" ADD CONSTRAINT "fk_0638" FOREIGN KEY ("reviewed_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."input_invoice_processing" ADD CONSTRAINT "fk_0639" FOREIGN KEY ("vendor_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."input_invoice_processing" ADD CONSTRAINT "fk_0640" FOREIGN KEY ("tax_invoice_id") REFERENCES "tax"."tax_invoice" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."invoice_risk_check" ADD CONSTRAINT "fk_0641" FOREIGN KEY ("tax_invoice_id") REFERENCES "tax"."tax_invoice" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."invoice_validation_result" ADD CONSTRAINT "fk_0642" FOREIGN KEY ("tax_invoice_id") REFERENCES "tax"."tax_invoice" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_declaration" ADD CONSTRAINT "fk_0643" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_declaration" ADD CONSTRAINT "fk_0644" FOREIGN KEY ("tax_form_version_id") REFERENCES "tax"."tax_form_version" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_declaration" ADD CONSTRAINT "fk_0645" FOREIGN KEY ("tax_period_id") REFERENCES "tax"."tax_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_declaration_line" ADD CONSTRAINT "fk_0646" FOREIGN KEY ("tax_declaration_id") REFERENCES "tax"."tax_declaration" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_declaration_line" ADD CONSTRAINT "fk_0647" FOREIGN KEY ("tax_form_indicator_id") REFERENCES "tax"."tax_form_indicator" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_form_indicator" ADD CONSTRAINT "fk_0648" FOREIGN KEY ("parent_indicator_id") REFERENCES "tax"."tax_form_indicator" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_form_indicator" ADD CONSTRAINT "fk_0649" FOREIGN KEY ("tax_form_version_id") REFERENCES "tax"."tax_form_version" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_form_version" ADD CONSTRAINT "fk_0650" FOREIGN KEY ("tax_form_definition_id") REFERENCES "tax"."tax_form_definition" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_invoice" ADD CONSTRAINT "fk_0651" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_invoice" ADD CONSTRAINT "fk_0652" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_invoice" ADD CONSTRAINT "fk_0653" FOREIGN KEY ("provider_id") REFERENCES "tax"."tax_service_provider" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_invoice" ADD CONSTRAINT "fk_0654" FOREIGN KEY ("raw_payload_id") REFERENCES "tax"."einvoice_raw_payload" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_invoice_document_link" ADD CONSTRAINT "fk_0655" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_invoice_document_link" ADD CONSTRAINT "fk_0656" FOREIGN KEY ("tax_invoice_id") REFERENCES "tax"."tax_invoice" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_invoice_line" ADD CONSTRAINT "fk_0657" FOREIGN KEY ("tax_invoice_id") REFERENCES "tax"."tax_invoice" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_invoice_link" ADD CONSTRAINT "fk_0658" FOREIGN KEY ("source_tax_invoice_id") REFERENCES "tax"."tax_invoice" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_invoice_link" ADD CONSTRAINT "fk_0659" FOREIGN KEY ("target_tax_invoice_id") REFERENCES "tax"."tax_invoice" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_obligation" ADD CONSTRAINT "fk_0660" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_obligation" ADD CONSTRAINT "fk_0661" FOREIGN KEY ("source_declaration_id") REFERENCES "tax"."tax_declaration" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_obligation" ADD CONSTRAINT "fk_0662" FOREIGN KEY ("tax_period_id") REFERENCES "tax"."tax_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_payment" ADD CONSTRAINT "fk_0663" FOREIGN KEY ("document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_payment" ADD CONSTRAINT "fk_0664" FOREIGN KEY ("bank_account_id") REFERENCES "mdm"."company_bank_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_payment" ADD CONSTRAINT "fk_0665" FOREIGN KEY ("tax_obligation_id") REFERENCES "tax"."tax_obligation" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_period" ADD CONSTRAINT "fk_0666" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_service_provider" ADD CONSTRAINT "fk_0667" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_submission" ADD CONSTRAINT "fk_0668" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_submission" ADD CONSTRAINT "fk_0669" FOREIGN KEY ("provider_id") REFERENCES "tax"."tax_service_provider" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_submission" ADD CONSTRAINT "fk_0670" FOREIGN KEY ("submitted_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_submission" ADD CONSTRAINT "fk_0671" FOREIGN KEY ("tax_declaration_id") REFERENCES "tax"."tax_declaration" ("document_id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."tax_submission_response" ADD CONSTRAINT "fk_0672" FOREIGN KEY ("submission_id") REFERENCES "tax"."tax_submission" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."vat_ledger" ADD CONSTRAINT "fk_0673" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."vat_ledger" ADD CONSTRAINT "fk_0674" FOREIGN KEY ("source_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."vat_ledger" ADD CONSTRAINT "fk_0675" FOREIGN KEY ("tax_invoice_id") REFERENCES "tax"."tax_invoice" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tax"."vat_ledger" ADD CONSTRAINT "fk_0676" FOREIGN KEY ("tax_period_id") REFERENCES "tax"."tax_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account" ADD CONSTRAINT "fk_0677" FOREIGN KEY ("account_class_id") REFERENCES "gl"."account_class" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account" ADD CONSTRAINT "fk_0678" FOREIGN KEY ("chart_of_accounts_id") REFERENCES "gl"."chart_of_accounts" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account" ADD CONSTRAINT "fk_0679" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account" ADD CONSTRAINT "fk_0680" FOREIGN KEY ("parent_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_balance" ADD CONSTRAINT "fk_0681" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_balance" ADD CONSTRAINT "fk_0682" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_balance" ADD CONSTRAINT "fk_0683" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_balance" ADD CONSTRAINT "fk_0684" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_class" ADD CONSTRAINT "fk_0685" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_dimension_balance" ADD CONSTRAINT "fk_0686" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_dimension_balance" ADD CONSTRAINT "fk_0687" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_dimension_balance" ADD CONSTRAINT "fk_0688" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_dimension_balance" ADD CONSTRAINT "fk_0689" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_dimension_balance" ADD CONSTRAINT "fk_0690" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_dimension_balance" ADD CONSTRAINT "fk_0691" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_dimension_balance" ADD CONSTRAINT "fk_0692" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_dimension_balance" ADD CONSTRAINT "fk_0693" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_opening_balance" ADD CONSTRAINT "fk_0694" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_opening_balance" ADD CONSTRAINT "fk_0695" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_opening_balance" ADD CONSTRAINT "fk_0696" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_opening_balance" ADD CONSTRAINT "fk_0697" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_opening_balance" ADD CONSTRAINT "fk_0698" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_opening_balance" ADD CONSTRAINT "fk_0699" FOREIGN KEY ("fiscal_year_id") REFERENCES "gl"."fiscal_year" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_opening_balance" ADD CONSTRAINT "fk_0700" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_opening_balance" ADD CONSTRAINT "fk_0701" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."account_opening_balance" ADD CONSTRAINT "fk_0702" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."chart_of_accounts" ADD CONSTRAINT "fk_0703" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."closing_run" ADD CONSTRAINT "fk_0704" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."closing_run" ADD CONSTRAINT "fk_0705" FOREIGN KEY ("created_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."closing_run" ADD CONSTRAINT "fk_0706" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."closing_run" ADD CONSTRAINT "fk_0707" FOREIGN KEY ("journal_entry_id") REFERENCES "gl"."journal_entry" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."closing_run_line" ADD CONSTRAINT "fk_0708" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."closing_run_line" ADD CONSTRAINT "fk_0709" FOREIGN KEY ("closing_run_id") REFERENCES "gl"."closing_run" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."fiscal_period" ADD CONSTRAINT "fk_0710" FOREIGN KEY ("fiscal_year_id") REFERENCES "gl"."fiscal_year" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."fiscal_year" ADD CONSTRAINT "fk_0711" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."foreign_currency_revaluation_line" ADD CONSTRAINT "fk_0712" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."foreign_currency_revaluation_line" ADD CONSTRAINT "fk_0713" FOREIGN KEY ("currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."foreign_currency_revaluation_line" ADD CONSTRAINT "fk_0714" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."foreign_currency_revaluation_line" ADD CONSTRAINT "fk_0715" FOREIGN KEY ("revaluation_run_id") REFERENCES "gl"."foreign_currency_revaluation_run" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."foreign_currency_revaluation_run" ADD CONSTRAINT "fk_0716" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."foreign_currency_revaluation_run" ADD CONSTRAINT "fk_0717" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."foreign_currency_revaluation_run" ADD CONSTRAINT "fk_0718" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."foreign_currency_revaluation_run" ADD CONSTRAINT "fk_0719" FOREIGN KEY ("journal_entry_id") REFERENCES "gl"."journal_entry" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."foreign_currency_revaluation_run" ADD CONSTRAINT "fk_0720" FOREIGN KEY ("rate_type_id") REFERENCES "mdm"."exchange_rate_type" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry" ADD CONSTRAINT "fk_0721" FOREIGN KEY ("base_currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry" ADD CONSTRAINT "fk_0722" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry" ADD CONSTRAINT "fk_0723" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry" ADD CONSTRAINT "fk_0724" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry" ADD CONSTRAINT "fk_0725" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry" ADD CONSTRAINT "fk_0726" FOREIGN KEY ("posted_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry" ADD CONSTRAINT "fk_0727" FOREIGN KEY ("posting_batch_id") REFERENCES "gl"."posting_batch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry" ADD CONSTRAINT "fk_0728" FOREIGN KEY ("reversal_of_journal_entry_id") REFERENCES "gl"."journal_entry" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry" ADD CONSTRAINT "fk_0729" FOREIGN KEY ("source_document_id") REFERENCES "core"."business_document" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry_line" ADD CONSTRAINT "fk_0730" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry_line" ADD CONSTRAINT "fk_0731" FOREIGN KEY ("cost_center_id") REFERENCES "mdm"."cost_center" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry_line" ADD CONSTRAINT "fk_0732" FOREIGN KEY ("journal_entry_id") REFERENCES "gl"."journal_entry" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry_line" ADD CONSTRAINT "fk_0733" FOREIGN KEY ("party_id") REFERENCES "mdm"."party" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry_line" ADD CONSTRAINT "fk_0734" FOREIGN KEY ("project_id") REFERENCES "mdm"."project" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry_line" ADD CONSTRAINT "fk_0735" FOREIGN KEY ("tax_rate_id") REFERENCES "mdm"."tax_rate" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry_line" ADD CONSTRAINT "fk_0736" FOREIGN KEY ("transaction_currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."journal_entry_line" ADD CONSTRAINT "fk_0737" FOREIGN KEY ("warehouse_id") REFERENCES "mdm"."warehouse" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."period_lock" ADD CONSTRAINT "fk_0738" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."period_lock" ADD CONSTRAINT "fk_0739" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."period_lock" ADD CONSTRAINT "fk_0740" FOREIGN KEY ("locked_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."posting_batch" ADD CONSTRAINT "fk_0741" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."posting_rule" ADD CONSTRAINT "fk_0742" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."posting_rule" ADD CONSTRAINT "fk_0743" FOREIGN KEY ("document_type_id") REFERENCES "mdm"."document_type" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."posting_rule_line" ADD CONSTRAINT "fk_0744" FOREIGN KEY ("fixed_account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "gl"."posting_rule_line" ADD CONSTRAINT "fk_0745" FOREIGN KEY ("posting_rule_id") REFERENCES "gl"."posting_rule" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."accounting_book_template_version" ADD CONSTRAINT "fk_0746" FOREIGN KEY ("accounting_book_template_id") REFERENCES "report"."accounting_book_template" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."accounting_book_template_version" ADD CONSTRAINT "fk_0747" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_account_mapping" ADD CONSTRAINT "fk_0748" FOREIGN KEY ("account_id") REFERENCES "gl"."account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_account_mapping" ADD CONSTRAINT "fk_0749" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_account_mapping" ADD CONSTRAINT "fk_0750" FOREIGN KEY ("statement_line_id") REFERENCES "report"."financial_statement_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_adjustment" ADD CONSTRAINT "fk_0751" FOREIGN KEY ("approved_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_adjustment" ADD CONSTRAINT "fk_0752" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_adjustment" ADD CONSTRAINT "fk_0753" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_adjustment" ADD CONSTRAINT "fk_0754" FOREIGN KEY ("statement_line_id") REFERENCES "report"."financial_statement_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_adjustment" ADD CONSTRAINT "fk_0755" FOREIGN KEY ("statement_run_id") REFERENCES "report"."financial_statement_run" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_line" ADD CONSTRAINT "fk_0756" FOREIGN KEY ("parent_line_id") REFERENCES "report"."financial_statement_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_line" ADD CONSTRAINT "fk_0757" FOREIGN KEY ("template_version_id") REFERENCES "report"."financial_statement_template_version" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_run" ADD CONSTRAINT "fk_0758" FOREIGN KEY ("approved_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_run" ADD CONSTRAINT "fk_0759" FOREIGN KEY ("branch_id") REFERENCES "org"."branch" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_run" ADD CONSTRAINT "fk_0760" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_run" ADD CONSTRAINT "fk_0761" FOREIGN KEY ("fiscal_period_id") REFERENCES "gl"."fiscal_period" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_run" ADD CONSTRAINT "fk_0762" FOREIGN KEY ("generated_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_run" ADD CONSTRAINT "fk_0763" FOREIGN KEY ("reporting_currency_id") REFERENCES "mdm"."currency" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_run" ADD CONSTRAINT "fk_0764" FOREIGN KEY ("template_version_id") REFERENCES "report"."financial_statement_template_version" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_template_version" ADD CONSTRAINT "fk_0765" FOREIGN KEY ("created_by_user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_template_version" ADD CONSTRAINT "fk_0766" FOREIGN KEY ("template_id") REFERENCES "report"."financial_statement_template" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_value" ADD CONSTRAINT "fk_0767" FOREIGN KEY ("statement_line_id") REFERENCES "report"."financial_statement_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."financial_statement_value" ADD CONSTRAINT "fk_0768" FOREIGN KEY ("statement_run_id") REFERENCES "report"."financial_statement_run" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."report_parameter" ADD CONSTRAINT "fk_0769" FOREIGN KEY ("report_definition_id") REFERENCES "report"."report_definition" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."saved_report" ADD CONSTRAINT "fk_0770" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."saved_report" ADD CONSTRAINT "fk_0771" FOREIGN KEY ("report_definition_id") REFERENCES "report"."report_definition" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "report"."saved_report" ADD CONSTRAINT "fk_0772" FOREIGN KEY ("user_id") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."api_client" ADD CONSTRAINT "fk_0773" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."external_mapping" ADD CONSTRAINT "fk_0774" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."idempotency_key" ADD CONSTRAINT "fk_0775" FOREIGN KEY ("client_id") REFERENCES "integration"."api_client" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."idempotency_key" ADD CONSTRAINT "fk_0776" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."import_job" ADD CONSTRAINT "fk_0777" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."import_job" ADD CONSTRAINT "fk_0778" FOREIGN KEY ("created_by") REFERENCES "iam"."user_account" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."import_row_error" ADD CONSTRAINT "fk_0779" FOREIGN KEY ("import_job_id") REFERENCES "integration"."import_job" ("id") ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."outbox_event" ADD CONSTRAINT "fk_0780" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."sync_checkpoint" ADD CONSTRAINT "fk_0781" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."webhook_delivery" ADD CONSTRAINT "fk_0782" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."webhook_delivery" ADD CONSTRAINT "fk_0783" FOREIGN KEY ("event_id") REFERENCES "integration"."outbox_event" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."webhook_delivery" ADD CONSTRAINT "fk_0784" FOREIGN KEY ("webhook_subscription_id") REFERENCES "integration"."webhook_subscription" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "integration"."webhook_subscription" ADD CONSTRAINT "fk_0785" FOREIGN KEY ("company_id") REFERENCES "org"."company" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;
