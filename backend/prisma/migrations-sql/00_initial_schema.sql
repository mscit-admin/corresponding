-- =====================================================================
-- نظام الأرشفة الإلكترونية الذكي - Database Schema
-- Government Smart Document Management System (GSDMS)
-- MySQL 8.0+ | InnoDB | utf8mb4
-- Version: 1.0
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- MODULE 1: IDENTITY & ACCESS
-- =====================================================================

-- Departments (with self-referential hierarchy)
CREATE TABLE departments (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50) UNIQUE NOT NULL,
  parent_id       BIGINT NULL,
  manager_id      BIGINT NULL,
  level           INT UNSIGNED NOT NULL DEFAULT 1,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE RESTRICT,
  INDEX idx_parent (parent_id),
  INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles
CREATE TABLE roles (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(100) UNIQUE NOT NULL,
  name_ar         VARCHAR(100) NOT NULL,
  description     TEXT,
  is_system       BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Cannot be deleted',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions
CREATE TABLE permissions (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  code            VARCHAR(150) UNIQUE NOT NULL COMMENT 'e.g., correspondence.create',
  name_ar         VARCHAR(255) NOT NULL,
  module          VARCHAR(50) NOT NULL,
  action          VARCHAR(50) NOT NULL,
  description     TEXT,
  INDEX idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Role-Permission junction
CREATE TABLE role_permissions (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_id         BIGINT NOT NULL,
  permission_id   BIGINT NOT NULL,
  granted_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by      BIGINT,
  UNIQUE KEY uk_role_permission (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users
CREATE TABLE users (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  username        VARCHAR(100) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  full_name_ar    VARCHAR(255),
  job_title       VARCHAR(150),
  phone           VARCHAR(20),
  role_id         BIGINT NOT NULL,
  department_id   BIGINT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret      VARCHAR(255),
  last_login_at   DATETIME,
  password_changed_at DATETIME,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_department (department_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Now add the manager_id FK for departments (circular - had to wait for users table)
ALTER TABLE departments
  ADD FOREIGN KEY fk_dept_manager (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- =====================================================================
-- MODULE 2: CORRESPONDENCE CORE
-- =====================================================================

-- External entities (other government agencies, companies, individuals)
CREATE TABLE external_entities (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(255) NOT NULL,
  name_ar         VARCHAR(255) NOT NULL,
  type            ENUM('government','private_sector','individual','international','ngo') NOT NULL,
  contact_email   VARCHAR(255),
  phone           VARCHAR(50),
  fax             VARCHAR(50),
  address         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name_ar (name_ar),
  INDEX idx_type (type),
  FULLTEXT idx_search (name, name_ar, address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories (hierarchical correspondence classification)
CREATE TABLE categories (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT,
  name              VARCHAR(150) NOT NULL,
  parent_id         BIGINT NULL,
  retention_years   INT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'How long to keep records',
  default_priority  ENUM('normal','urgent','top_secret') DEFAULT 'normal',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT,
  INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Incoming correspondence
CREATE TABLE incoming_correspondence (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  serial_no             VARCHAR(50) UNIQUE NOT NULL,
  received_at           DATETIME NOT NULL,
  sender_entity_id      BIGINT NOT NULL,
  sender_ref_no         VARCHAR(100) COMMENT 'Reference number at sender side',
  original_date         DATE,
  subject               TEXT NOT NULL,
  priority              ENUM('normal','urgent','top_secret') NOT NULL DEFAULT 'normal',
  category_id           BIGINT,
  current_owner_id      BIGINT,
  status                ENUM('new','in_progress','responded','closed','archived') NOT NULL DEFAULT 'new',
  due_date              DATETIME,
  created_by            BIGINT NOT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_entity_id) REFERENCES external_entities(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (current_owner_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_serial (serial_no),
  INDEX idx_received_at (received_at),
  INDEX idx_status (status),
  INDEX idx_current_owner (current_owner_id),
  INDEX idx_priority (priority),
  FULLTEXT idx_subject (subject)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Outgoing correspondence
CREATE TABLE outgoing_correspondence (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  serial_no             VARCHAR(50) UNIQUE NOT NULL,
  sent_at               DATETIME,
  recipient_entity_id   BIGINT NOT NULL,
  subject               TEXT NOT NULL,
  body                  LONGTEXT NOT NULL,
  priority              ENUM('normal','urgent','top_secret') NOT NULL DEFAULT 'normal',
  category_id           BIGINT,
  reply_to_id           BIGINT NULL COMMENT 'FK to incoming if this is a reply',
  current_owner_id      BIGINT,
  status                ENUM('draft','pending_review','pending_approval','approved','sent','archived') NOT NULL DEFAULT 'draft',
  approved_by           BIGINT NULL,
  approved_at           DATETIME NULL,
  created_by            BIGINT NOT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_entity_id) REFERENCES external_entities(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (reply_to_id) REFERENCES incoming_correspondence(id),
  FOREIGN KEY (current_owner_id) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_serial (serial_no),
  INDEX idx_sent_at (sent_at),
  INDEX idx_status (status),
  INDEX idx_reply_to (reply_to_id),
  FULLTEXT idx_search (subject, body)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attachments (polymorphic to incoming/outgoing)
CREATE TABLE attachments (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  correspondence_type   ENUM('incoming','outgoing') NOT NULL,
  correspondence_id     BIGINT NOT NULL,
  file_name             VARCHAR(500) NOT NULL,
  file_path             VARCHAR(1000) NOT NULL COMMENT 'Path in MinIO',
  file_size             BIGINT NOT NULL,
  mime_type             VARCHAR(150) NOT NULL,
  file_hash             VARCHAR(64) COMMENT 'SHA-256',
  ocr_text              LONGTEXT,
  ocr_status            ENUM('pending','processing','completed','failed','not_applicable') DEFAULT 'pending',
  ocr_confidence        DECIMAL(5,2),
  uploaded_by           BIGINT NOT NULL,
  uploaded_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_correspondence (correspondence_type, correspondence_id),
  INDEX idx_ocr_status (ocr_status),
  FULLTEXT idx_ocr (ocr_text)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- MODULE 3: WORKFLOW & OPERATIONS
-- =====================================================================

-- Transfers (polymorphic to incoming/outgoing)
CREATE TABLE transfers (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  correspondence_type   ENUM('incoming','outgoing') NOT NULL,
  correspondence_id     BIGINT NOT NULL,
  from_user_id          BIGINT NOT NULL,
  to_user_id            BIGINT NOT NULL,
  action_type           ENUM('for_review','for_info','for_study','for_reply','for_execution','for_opinion','for_archive') NOT NULL,
  notes                 TEXT,
  due_date              DATETIME,
  status                ENUM('pending','acknowledged','completed','rejected','cancelled') NOT NULL DEFAULT 'pending',
  response_notes        TEXT,
  transferred_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at       DATETIME,
  completed_at          DATETIME,
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id),
  INDEX idx_correspondence (correspondence_type, correspondence_id),
  INDEX idx_to_user_status (to_user_id, status),
  INDEX idx_from_user (from_user_id),
  INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workflow definitions
CREATE TABLE workflows (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category_id     BIGINT,
  definition      JSON NOT NULL COMMENT 'BPMN-like steps and conditions',
  version         INT UNSIGNED NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      BIGINT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workflow instances (running workflows on actual correspondences)
CREATE TABLE workflow_instances (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  workflow_id           BIGINT NOT NULL,
  correspondence_type   ENUM('incoming','outgoing') NOT NULL,
  correspondence_id     BIGINT NOT NULL,
  current_step          INT UNSIGNED NOT NULL DEFAULT 1,
  status                ENUM('running','paused','completed','cancelled','failed') NOT NULL DEFAULT 'running',
  state_data            JSON COMMENT 'Variables and context',
  started_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at          DATETIME,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id),
  INDEX idx_workflow (workflow_id),
  INDEX idx_correspondence (correspondence_type, correspondence_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications
CREATE TABLE notifications (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT NOT NULL,
  type            ENUM('transfer','approval','reminder','system','mention') NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT,
  action_url      VARCHAR(500),
  related_type    VARCHAR(50),
  related_id      BIGINT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         DATETIME,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_unread (user_id, is_read),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit logs (IMMUTABLE — see triggers below)
CREATE TABLE audit_logs (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id         BIGINT NOT NULL,
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       BIGINT,
  old_values      JSON,
  new_values      JSON,
  ip_address      VARCHAR(45) NOT NULL,
  user_agent      TEXT,
  session_id      VARCHAR(100),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_date (user_id, created_at),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='IMMUTABLE - No UPDATE or DELETE allowed';

-- =====================================================================
-- MODULE 4: PRINTING SYSTEM
-- =====================================================================

-- Print templates
CREATE TABLE print_templates (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(255) NOT NULL,
  type            ENUM('incoming_letter','outgoing_letter','memo','report','certified_copy') NOT NULL,
  html_template   LONGTEXT NOT NULL,
  variables       JSON COMMENT 'List of placeholders',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      BIGINT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_type (type),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Authorized printers
CREATE TABLE printers (
  id                      BIGINT PRIMARY KEY AUTO_INCREMENT,
  name                    VARCHAR(255) NOT NULL,
  ip_address              VARCHAR(45) NOT NULL,
  port                    INT NOT NULL DEFAULT 631,
  protocol                ENUM('ipp','ipps','lpd','socket') NOT NULL DEFAULT 'ipps',
  location                VARCHAR(255),
  department_id           BIGINT NOT NULL,
  supports_pull_printing  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  INDEX idx_department (department_id),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Print logs (IMMUTABLE)
CREATE TABLE print_logs (
  id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
  print_serial          VARCHAR(50) UNIQUE NOT NULL,
  correspondence_type   ENUM('incoming','outgoing','internal') NOT NULL,
  correspondence_id     BIGINT NOT NULL,
  template_id           BIGINT NOT NULL,
  user_id               BIGINT NOT NULL COMMENT 'Who requested the print',
  approver_id           BIGINT NULL COMMENT 'For confidential documents',
  copies_count          INT UNSIGNED NOT NULL DEFAULT 1,
  copy_type             ENUM('original','copy','certified_copy') NOT NULL DEFAULT 'copy',
  purpose               VARCHAR(200) NOT NULL,
  printer_id            BIGINT NOT NULL,
  ip_address            VARCHAR(45) NOT NULL,
  user_agent            TEXT,
  watermark_text        TEXT,
  qr_payload            TEXT,
  qr_hash               VARCHAR(64) UNIQUE COMMENT 'SHA-256 for verification',
  status                ENUM('pending','printing','success','failed','cancelled') NOT NULL DEFAULT 'pending',
  error_message         TEXT,
  pdf_storage_path      VARCHAR(1000) COMMENT 'Backup PDF in MinIO',
  requested_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at          DATETIME NULL,
  FOREIGN KEY (template_id) REFERENCES print_templates(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (approver_id) REFERENCES users(id),
  FOREIGN KEY (printer_id) REFERENCES printers(id),
  INDEX idx_correspondence (correspondence_type, correspondence_id),
  INDEX idx_user_date (user_id, requested_at),
  INDEX idx_print_serial (print_serial),
  INDEX idx_qr_hash (qr_hash),
  INDEX idx_status (status, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='IMMUTABLE - No UPDATE or DELETE allowed';

-- =====================================================================
-- TRIGGERS: Enforce immutability on audit_logs and print_logs
-- =====================================================================

DELIMITER //

CREATE TRIGGER prevent_audit_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_logs records are immutable - UPDATE not allowed';
END//

CREATE TRIGGER prevent_audit_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_logs records are immutable - DELETE not allowed';
END//

-- Note: print_logs allows UPDATE only for status transitions (pending → printing → success/failed)
-- by the system itself; we enforce via application layer + check trigger
CREATE TRIGGER print_logs_status_only
BEFORE UPDATE ON print_logs
FOR EACH ROW
BEGIN
  IF OLD.print_serial != NEW.print_serial
    OR OLD.correspondence_id != NEW.correspondence_id
    OR OLD.user_id != NEW.user_id
    OR OLD.qr_hash != NEW.qr_hash THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'print_logs critical fields are immutable';
  END IF;
END//

CREATE TRIGGER prevent_print_logs_delete
BEFORE DELETE ON print_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'print_logs records are immutable - DELETE not allowed';
END//

DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- SEED DATA: System roles and permissions
-- =====================================================================

INSERT INTO roles (name, name_ar, is_system, description) VALUES
  ('super_admin',  'مدير النظام',           TRUE, 'Full system access'),
  ('archive_mgr',  'مدير الأرشيف',          TRUE, 'Manages archive policies'),
  ('diwan_officer','موظف الديوان',          TRUE, 'Registers incoming/outgoing'),
  ('dept_manager', 'رئيس إدارة',            TRUE, 'Manages department transfers'),
  ('employee',     'موظف',                  TRUE, 'Standard user');

INSERT INTO permissions (code, name_ar, module, action) VALUES
  ('correspondence.create',   'إنشاء مراسلة',          'correspondence', 'create'),
  ('correspondence.read',     'عرض مراسلة',            'correspondence', 'read'),
  ('correspondence.update',   'تعديل مراسلة',          'correspondence', 'update'),
  ('correspondence.transfer', 'تحويل مراسلة',          'correspondence', 'transfer'),
  ('correspondence.approve',  'اعتماد مراسلة',         'correspondence', 'approve'),
  ('correspondence.print',    'طباعة مراسلة',          'correspondence', 'print'),
  ('correspondence.archive',  'أرشفة مراسلة',          'correspondence', 'archive'),
  ('users.manage',            'إدارة المستخدمين',      'admin',          'manage'),
  ('roles.manage',            'إدارة الأدوار',         'admin',          'manage'),
  ('reports.view',            'عرض التقارير',          'reports',        'view'),
  ('audit.view',              'عرض سجل التدقيق',       'audit',          'view'),
  ('printers.manage',         'إدارة الطابعات',        'admin',          'manage');
