<?php
/**
 * StockMind AI — Register Endpoint
 * File: auth/register.php
 * Method: POST (JSON body)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

/* Handle preflight */
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { jsonOut(false, 'Method tidak diizinkan.', 405); }

require_once __DIR__ . '/db.php';

/* ── Helper ── */
function jsonOut(bool $ok, string $msg, int $code = 200, array $extra = []): never {
    http_response_code($code);
    echo json_encode(array_merge(['success' => $ok, 'message' => $msg], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

/* ── Baca body JSON ── */
$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body) jsonOut(false, 'Request tidak valid.', 400);

$name     = trim($body['name']     ?? '');
$username = trim($body['username'] ?? '');
$email    = trim($body['email']    ?? '');
$pass     = $body['pass']          ?? '';

/* ── Validasi ── */
if (!$name || !$username || !$email || !$pass) {
    jsonOut(false, 'Semua kolom wajib diisi.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonOut(false, 'Format email tidak valid.', 422);
}
if (!preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username)) {
    jsonOut(false, 'Username hanya boleh huruf, angka, dan underscore (3–20 karakter).', 422);
}
if (strlen($pass) < 8) {
    jsonOut(false, 'Kata sandi minimal 8 karakter.', 422);
}

/* ── Koneksi & buat tabel jika belum ada ── */
try {
    $db = getDB();
    ensureUsersTable();
} catch (Exception $e) {
    error_log('[StockMind Register] DB error: ' . $e->getMessage());
    jsonOut(false, 'Koneksi database gagal. Hubungi administrator.', 500);
}

/* ── Cek duplikat email atau username ── */
try {
    $stmt = $db->prepare('SELECT id FROM users WHERE email = :email OR username = :username LIMIT 1');
    $stmt->execute([':email' => $email, ':username' => $username]);
    $existing = $stmt->fetch();

    if ($existing) {
        /* Tentukan mana yang duplikat untuk pesan yang lebih informatif */
        $stmtE = $db->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $stmtE->execute([':email' => $email]);
        if ($stmtE->fetch()) jsonOut(false, 'Email sudah terdaftar.', 409);

        jsonOut(false, 'Username sudah digunakan, pilih yang lain.', 409);
    }
} catch (Exception $e) {
    error_log('[StockMind Register] Cek duplikat: ' . $e->getMessage());
    jsonOut(false, 'Terjadi kesalahan server.', 500);
}

/* ── Hash password & simpan ── */
try {
    $hash = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = $db->prepare('
        INSERT INTO users (full_name, username, email, password_hash)
        VALUES (:name, :username, :email, :hash)
    ');
    $stmt->execute([
        ':name'     => $name,
        ':username' => strtolower($username),
        ':email'    => strtolower($email),
        ':hash'     => $hash,
    ]);

    require_once __DIR__ . '/mailer.php';
    sendWelcomeEmail($email, $name, strtolower($username));
    jsonOut(true, 'Akun berhasil dibuat! Silakan masuk.', 201, ['user_id' => (int)$db->lastInsertId()]);

} catch (Exception $e) {
    error_log('[StockMind Register] Insert: ' . $e->getMessage());
    jsonOut(false, 'Gagal membuat akun. Coba lagi.', 500);
}
