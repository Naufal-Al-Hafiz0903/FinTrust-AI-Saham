<?php
/**
 * Fintrust AI — Database helper
 * Dibuat tahan terhadap schema lama agar login/register tidak gagal.
 */

declare(strict_types=1);

function getDB(): PDO {
    static $db = null;

    if ($db instanceof PDO) {
        return $db;
    }

    $host = '127.0.0.1';
    $port = '3306';
    $dbname = 'eracorpora_db_saham';
    $user = 'eracorpora_sahamcompe';
    $pass = 'Sahamcompe@2025';

    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";

    try {
        $db = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 8,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $db->exec("SET NAMES utf8mb4");
        return $db;
    } catch (Throwable $e) {
        error_log('[FintrustAI DB] Connection error: ' . $e->getMessage());
        throw new RuntimeException('Koneksi database gagal.');
    }
}

function tableExists(PDO $db, string $table): bool {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table'
    );
    $stmt->execute([':table' => $table]);
    return (int)$stmt->fetchColumn() > 0;
}

function columnExists(PDO $db, string $table, string $column): bool {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
    );
    $stmt->execute([':table' => $table, ':column' => $column]);
    return (int)$stmt->fetchColumn() > 0;
}

function ensureColumn(PDO $db, string $table, string $column, string $definition): void {
    if (!columnExists($db, $table, $column)) {
        $db->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
    }
}

function ensureIndex(PDO $db, string $table, string $index, string $definition): void {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :idx'
    );
    $stmt->execute([':table' => $table, ':idx' => $index]);
    if ((int)$stmt->fetchColumn() === 0) {
        $db->exec("ALTER TABLE `{$table}` ADD {$definition}");
    }
}

function ensureUsersTable(): void {
    $db = getDB();

    if (!tableExists($db, 'users')) {
        $db->exec("
            CREATE TABLE `users` (
                `id` INT NOT NULL AUTO_INCREMENT,
                `full_name` VARCHAR(100) NOT NULL,
                `username` VARCHAR(50) NOT NULL,
                `email` VARCHAR(100) NOT NULL,
                `password_hash` VARCHAR(255) NOT NULL,
                `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `role` VARCHAR(20) NOT NULL DEFAULT 'user',
                `last_login` TIMESTAMP NULL DEFAULT NULL,
                `email_verified_at` DATETIME DEFAULT NULL,
                `verification_code_md5` CHAR(32) DEFAULT NULL,
                `verification_code_expires_at` DATETIME DEFAULT NULL,
                `verification_sent_at` DATETIME DEFAULT NULL,
                `verification_attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
                PRIMARY KEY (`id`),
                UNIQUE KEY `username` (`username`),
                UNIQUE KEY `email` (`email`),
                KEY `idx_email_verified_at` (`email_verified_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");
        return;
    }

    ensureColumn($db, 'users', 'full_name', "VARCHAR(100) NOT NULL DEFAULT ''");
    ensureColumn($db, 'users', 'username', "VARCHAR(50) NOT NULL DEFAULT ''");
    ensureColumn($db, 'users', 'email', "VARCHAR(100) NOT NULL DEFAULT ''");
    ensureColumn($db, 'users', 'password_hash', "VARCHAR(255) NOT NULL DEFAULT ''");
    ensureColumn($db, 'users', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
    ensureColumn($db, 'users', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
    ensureColumn($db, 'users', 'role', "VARCHAR(20) NOT NULL DEFAULT 'user'");
    ensureColumn($db, 'users', 'last_login', 'TIMESTAMP NULL DEFAULT NULL');
    ensureColumn($db, 'users', 'email_verified_at', 'DATETIME DEFAULT NULL');
    ensureColumn($db, 'users', 'verification_code_md5', 'CHAR(32) DEFAULT NULL');
    ensureColumn($db, 'users', 'verification_code_expires_at', 'DATETIME DEFAULT NULL');
    ensureColumn($db, 'users', 'verification_sent_at', 'DATETIME DEFAULT NULL');
    ensureColumn($db, 'users', 'verification_attempts', 'TINYINT UNSIGNED NOT NULL DEFAULT 0');

    try { ensureIndex($db, 'users', 'username', 'UNIQUE KEY `username` (`username`)'); } catch (Throwable $e) { error_log('[FintrustAI DB] username index skipped: ' . $e->getMessage()); }
    try { ensureIndex($db, 'users', 'email', 'UNIQUE KEY `email` (`email`)'); } catch (Throwable $e) { error_log('[FintrustAI DB] email index skipped: ' . $e->getMessage()); }
}
