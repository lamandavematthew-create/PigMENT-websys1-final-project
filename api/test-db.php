
<?php

header('Content-Type: application/json');

try {
    require_once __DIR__ . '/../database/db.php';

    $pdo->query('SELECT 1');

    echo json_encode([
        'status' => 'success',
        'message' => 'PigMENT database connected'
    ]);
} catch (Throwable $e) {
    http_response_code(500);

    echo json_encode([
        'status' => 'error',
        'message' => 'Database test failed'
    ]);
}
