
<?php

$host = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'pigment_db';
$username = getenv('DB_USER');
$password = getenv('DB_PASSWORD');

if ($username === false) {
    $username = 'root'; // Local XAMPP only
}

if ($password === false) {
    $password = ''; // Local XAMPP only
}

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

} catch (PDOException $e) {
    error_log($e->getMessage());

    http_response_code(500);

    throw new RuntimeException(
        'Database connection failed.'
    );
}
