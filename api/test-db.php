
<?php

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    http_response_code(405);

    echo json_encode([
        'status' => 'error',
        'message' => 'Method not allowed.'
    ]);
    exit;
}

try {
    require_once __DIR__ . '/../database/db.php';

    $pdo->query('SELECT 1');

    echo json_encode([
        'status' => 'success',
        'message' => 'PigMENT database connected'
    ]);

} catch (Throwable $e) {
    error_log($e->getMessage());

    http_response_code(500);

    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed.'
    ]);
}
