-- ================================================================
-- StockMind AI — Setup Database
-- Database : eracorpora_db_saham
-- Dijalankan di phpMyAdmin atau via CLI: mysql -u ... < setup.sql
-- ================================================================

USE `eracorpora_db_saham`;

-- ── Tabel users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
    `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `full_name`     VARCHAR(100)  NOT NULL                    COMMENT 'Nama lengkap pengguna',
    `username`      VARCHAR(50)   NOT NULL UNIQUE             COMMENT 'Username unik (huruf/angka/underscore)',
    `email`         VARCHAR(180)  NOT NULL UNIQUE             COMMENT 'Alamat email (unik)',
    `password_hash` VARCHAR(255)  NOT NULL                    COMMENT 'bcrypt hash, cost=12',
    `role`          ENUM('user','admin') NOT NULL DEFAULT 'user',
    `is_active`     TINYINT(1)   NOT NULL DEFAULT 1          COMMENT '1=aktif, 0=dinonaktifkan',
    `last_login`    DATETIME     NULL                         COMMENT 'Waktu login terakhir',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX `idx_email`    (`email`),
    INDEX `idx_username` (`username`),
    INDEX `idx_active`   (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── (Opsional) Tabel sessions untuk persistent login ─────────────
CREATE TABLE IF NOT EXISTS `user_sessions` (
    `id`         CHAR(64)    PRIMARY KEY,
    `user_id`    INT UNSIGNED NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(300) NULL,
    `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME    NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_user` (`user_id`),
    INDEX `idx_exp`  (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── (Opsional) Tabel audit log login ─────────────────────────────
CREATE TABLE IF NOT EXISTS `login_logs` (
    `id`         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id`    INT UNSIGNED NULL,
    `identifier` VARCHAR(200) NULL   COMMENT 'email/username yang dicoba',
    `ip_address` VARCHAR(45)  NULL,
    `success`    TINYINT(1)   NOT NULL DEFAULT 0,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user` (`user_id`),
    INDEX `idx_ip`   (`ip_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Contoh: tambah admin manual ──────────────────────────────────
-- Password: Admin@2025 (hash bcrypt cost=12, generate ulang di PHP)
-- INSERT INTO users (full_name, username, email, password_hash, role)
-- VALUES ('Administrator', 'admin', 'admin@stockmind.id',
--         '$2y$12$XXXX...', 'admin');
