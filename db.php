<?php

function getDB() {
    static $db = null;

    if ($db === null) {

        $host = '127.0.0.1';
        $port = '3306';

        $dbname = 'eracorpora_db_saham';
        $user   = 'eracorpora_sahamcompe';
        $pass   = 'Sahamcompe@2025';

        $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";

        try {

            $db = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);

        } catch (PDOException $e) {

            die(json_encode([
                'success' => false,
                'message' => 'Koneksi database gagal',
                'error' => $e->getMessage()
            ]));
        }
    }

    return $db;
}

function ensureUsersTable() {

    $db = getDB();

    $sql = "
    CREATE TABLE IF NOT EXISTS users (

        id INT AUTO_INCREMENT PRIMARY KEY,

        full_name VARCHAR(100) NOT NULL,

        username VARCHAR(50) NOT NULL UNIQUE,

        email VARCHAR(100) NOT NULL UNIQUE,

        password_hash VARCHAR(255) NOT NULL,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    $db->exec($sql);
}