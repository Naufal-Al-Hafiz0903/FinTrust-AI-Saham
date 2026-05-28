<?php
/**
 * StockMind AI — Login Endpoint
 * File: auth/login.php
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

/* ── Session start ── */
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,          /* sampai browser ditutup */
        'path'     => '/',
        'secure'   => false,      /* set true jika pakai HTTPS */
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

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

$user = trim($body['user'] ?? '');   /* bisa email atau username */
$pass = $body['pass']      ?? '';

if (!$user || !$pass) {
    jsonOut(false, 'Email/username dan kata sandi wajib diisi.', 422);
}

/* ── Koneksi DB ── */
try {
    $db = getDB();
    ensureUsersTable();
} catch (Exception $e) {
    error_log('[StockMind Login] DB error: ' . $e->getMessage());
    jsonOut(false, 'Koneksi database gagal. Hubungi administrator.', 500);
}

/* ── Cari user berdasarkan email ATAU username ── */
try {
    $isEmail = filter_var($user, FILTER_VALIDATE_EMAIL);
    if ($isEmail) {
        $stmt = $db->prepare('SELECT * FROM users WHERE email = :val AND is_active = 1 LIMIT 1');
    } else {
        $stmt = $db->prepare('SELECT * FROM users WHERE username = :val AND is_active = 1 LIMIT 1');
    }
    $stmt->execute([':val' => strtolower($user)]);
    $row = $stmt->fetch();
} catch (Exception $e) {
    error_log('[StockMind Login] Query: ' . $e->getMessage());
    jsonOut(false, 'Terjadi kesalahan server.', 500);
}

/* ── Verifikasi password ── */
if (!$row || !password_verify($pass, $row['password_hash'])) {
    /* Pesan generik agar tidak membocorkan info akun */
    jsonOut(false, 'Email/username atau kata sandi salah.', 401);
}

/* ── Cek apakah perlu rehash (misal cost bertambah) ── */
if (password_needs_rehash($row['password_hash'], PASSWORD_BCRYPT, ['cost' => 12])) {
    try {
        $newHash = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
           ->execute([$newHash, $row['id']]);
    } catch (Exception $e) {
        error_log('[StockMind Login] Rehash gagal: ' . $e->getMessage());
    }
}

/* ── Perbarui last_login ── */
try {
    $db->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')
       ->execute([$row['id']]);
} catch (Exception $_) { /* non-fatal */ }

/* ── Simpan session ── */
session_regenerate_id(true);   /* cegah session fixation */
$_SESSION['user_id']   = $row['id'];
$_SESSION['username']  = $row['username'];
$_SESSION['full_name'] = $row['full_name'];
$_SESSION['role']      = $row['role'];
$_SESSION['login_at']  = time();

/* ── Kembalikan data user (tanpa hash) ── */
jsonOut(true, 'Login berhasil!', 200, [
    'user' => [
        'id'        => $row['id'],
        'full_name' => $row['full_name'],
        'username'  => $row['username'],
        'email'     => $row['email'],
        'role'      => $row['role'],
    ]
]);
