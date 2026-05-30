<?php
/**
 * Fintrust AI — Login Endpoint
 * Method: POST (JSON body)
 */

declare(strict_types=1);

@set_time_limit(20);

function sendCorsHeaders(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
    } else {
        header('Access-Control-Allow-Origin: *');
    }
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept');
}

function jsonOut(bool $ok, string $msg, int $code = 200, array $extra = []): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode(array_merge(['success' => $ok, 'message' => $msg], $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

sendCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonOut(false, 'Method tidak diizinkan.', 405);
}

require_once __DIR__ . '/db.php';

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) {
    $body = $_POST ?: [];
}

$user = strtolower(trim((string)($body['user'] ?? '')));
$pass = (string)($body['pass'] ?? '');

if ($user === '' || $pass === '') {
    jsonOut(false, 'Email/username dan kata sandi wajib diisi.', 422);
}

try {
    $db = getDB();
    ensureUsersTable();
} catch (Throwable $e) {
    error_log('[FintrustAI Login] DB init error: ' . $e->getMessage());
    jsonOut(false, 'Koneksi database gagal. Hubungi administrator.', 500);
}

try {
    $stmt = $db->prepare(
        "SELECT id, full_name, username, email, password_hash, role, is_active
         FROM users
         WHERE (LOWER(email) = :val OR LOWER(username) = :val)
           AND is_active = 1
         LIMIT 1"
    );
    $stmt->execute([':val' => $user]);
    $row = $stmt->fetch();
} catch (Throwable $e) {
    error_log('[FintrustAI Login] Query error: ' . $e->getMessage());
    jsonOut(false, 'Terjadi kesalahan server saat membaca akun.', 500);
}

if (!$row || !password_verify($pass, (string)$row['password_hash'])) {
    jsonOut(false, 'Email/username atau kata sandi salah.', 401);
}

if (password_needs_rehash((string)$row['password_hash'], PASSWORD_BCRYPT, ['cost' => 12])) {
    try {
        $newHash = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$newHash, $row['id']]);
    } catch (Throwable $e) {
        error_log('[FintrustAI Login] Rehash skipped: ' . $e->getMessage());
    }
}

try {
    $db->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$row['id']]);
} catch (Throwable $e) {
    error_log('[FintrustAI Login] last_login skipped: ' . $e->getMessage());
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int)$row['id'];
$_SESSION['username'] = (string)$row['username'];
$_SESSION['full_name'] = (string)$row['full_name'];
$_SESSION['role'] = (string)($row['role'] ?: 'user');
$_SESSION['login_at'] = time();

jsonOut(true, 'Login berhasil!', 200, [
    'redirect' => 'stockmind_ui.html',
    'user' => [
        'id' => (int)$row['id'],
        'full_name' => (string)$row['full_name'],
        'username' => (string)$row['username'],
        'email' => (string)$row['email'],
        'role' => (string)($row['role'] ?: 'user'),
    ],
]);
