-- ============================================
-- GSDMS Migration: Recipient + Attachments
-- نسخة مبسّطة - تطبيق سهل
-- ============================================

USE gsdms;

-- 1. إضافة حقول الجهة المرسل إليها (نص + نوع)
ALTER TABLE incoming_correspondence
  ADD COLUMN recipient_type VARCHAR(20) NULL COMMENT 'internal or external',
  ADD COLUMN recipient_name VARCHAR(255) NULL COMMENT 'اسم الجهة المرسل إليها';

-- 2. إنشاء جدول المرفقات
CREATE TABLE IF NOT EXISTS attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  correspondence_type VARCHAR(20) NOT NULL,
  correspondence_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by BIGINT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_correspondence (correspondence_type, correspondence_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- التحقق من النجاح
SELECT 'Migration applied successfully' AS status;
SHOW COLUMNS FROM incoming_correspondence WHERE Field LIKE 'recipient%';
SELECT COUNT(*) AS attachments_table_ready FROM information_schema.tables 
  WHERE table_schema = 'gsdms' AND table_name = 'attachments';
