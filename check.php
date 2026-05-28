<?php
/**
 * StockMind AI — Auth Guard
 * File: auth/check.php
 *
 * Sertakan di awal setiap halaman yang memerlukan login:
 *
 *   <?php require_once 'auth/check.php'; ?>
 *
 * Untuk respons JSON (API):
 *
 *   <?php define('AUTH_JSON', true); require_once 'auth/check.php'; ?>
 */

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => false,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

if (empty($_SESSION['user_id'])) {
    if (defined('AUTH_JSON') && AUTH_JSON) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Sesi habis. Silakan login kembali.']);
        exit;
    }
    /* Redirect ke login dengan next URL */
    $next = urlencode($_SERVER['REQUEST_URI'] ?? '');
    header("Location: /login.html?next=$next");
    exit;
}

/* ── Helper: ambil info user dari session ── */
function currentUser(): array {
    return [
        'id'        => $_SESSION['user_id']   ?? null,
        'username'  => $_SESSION['username']  ?? '',
        'full_name' => $_SESSION['full_name'] ?? '',
        'role'      => $_SESSION['role']      ?? 'user',
    ];
}
