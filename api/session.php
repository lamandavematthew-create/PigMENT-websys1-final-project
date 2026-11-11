
<?php

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    sendResponse(405, 'error', 'Method not allowed.');
}

try {
    require_once __DIR__ . '/../database/db.php';

    if (empty($_SESSION['user_id'])) {
        sendResponse(401, 'error', 'Not authenticated.');
    }

    $stmt = $pdo->prepare(
        "SELECT
            user_id,
            first_name,
            last_name,
            email,
            role,
            account_status
         FROM users
         WHERE user_id = ?
         LIMIT 1"
    );

    $stmt->execute([$_SESSION['user_id']]);

    $user = $stmt->fetch();

    if (!$user || $user['account_status'] !== 'active') {
        $_SESSION = [];
        session_destroy();

        sendResponse(
            401,
            'error',
            'Session is no longer valid.'
        );
    }

    sendResponse(
        200,
        'success',
        'Session is active.',
        [
            'authenticated' => true,
            'user' => [
                'user_id' => (int) $user['user_id'],
                'first_name' => $user['first_name'],
                'last_name' => $user['last_name'],
                'email' => $user['email'],
                'role' => $user['role']
            ]
        ]
    );

} catch (Throwable $e) {
    error_log($e->getMessage());

    sendResponse(
        500,
        'error',
        'Unable to verify session.'
    );
}
