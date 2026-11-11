
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

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'status' => 'error',
        'message' => 'Not authenticated.'
    ]);
    exit;
}

try {
    require_once __DIR__ . '/../database/db.php';

    $stmt = $pdo->prepare(
        "SELECT user_id, first_name, last_name, email,
                role, account_status
         FROM users
         WHERE user_id = :user_id
         LIMIT 1"
    );

    $stmt->execute([
        ':user_id' => $_SESSION['user_id']
    ]);

    $user = $stmt->fetch();

    if (!$user || $user['account_status'] !== 'active') {
        $_SESSION = [];
        session_destroy();

        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Session is no longer valid.'
        ]);
        exit;
    }

    echo json_encode([
        'status' => 'success',
        'authenticated' => true,
        'user' => [
            'user_id' => (int) $user['user_id'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);

} catch (Throwable $e) {
    error_log($e->getMessage());

    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Unable to verify session.'
    ]);
}
