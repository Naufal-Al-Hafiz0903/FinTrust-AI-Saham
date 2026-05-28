<?php
require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

function sendWelcomeEmail(string $toEmail, string $toName, string $username): bool {
    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = 'eracorpora@gmail.com';      // ganti ini
        $mail->Password   = 'qlayzwtrmsaiazel';     // ganti ini
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;

        $mail->setFrom('eracorpora@gmail.com', 'Fintrust AI');
        $mail->addAddress($toEmail, $toName);

        $mail->isHTML(true);
        $mail->Subject = 'Selamat datang di Fintrust AI, ' . $toName . '!';
        $mail->Body    = "
        <div style='font-family:sans-serif;max-width:500px;margin:auto;padding:20px;background:#0f172a;color:#fff;border-radius:12px;'>
            <h2 style='color:#3b82f6;'>Selamat datang, {$toName}! 👋</h2>
            <p>Akun Fintrust AI Anda berhasil dibuat.</p>
            <p><b>Username:</b> {$username}</p>
            <p><b>Email:</b> {$toEmail}</p>
            <br>
            <a href='http://fintrustai.dev.eraenterprise.id/login.html' 
               style='background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;'>
               Masuk Sekarang
            </a>
            <br><br>
            <small style='color:#94a3b8;'>Fintrust AI — Hanya untuk edukasi dan riset.</small>
        </div>";

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('[StockMind Mailer] ' . $mail->ErrorInfo);
        return false;
    }
}
