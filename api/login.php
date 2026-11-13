
<?php

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    sendResponse(405, 'error', 'Method not allowed.');
}

requireCsrf();

try {
    require_once __DIR__ . '/../database/db.php';

    $data = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($data)) {
        sendResponse(400, 'error', 'Invalid JSON request.');
    }

    $email = strtolower(trim($data['email'] ?? ''));
    $password = $data['password'] ?? '';

    if (
        $email === '' ||
        !is_string($password) ||
        $password === ''
    ) {
        sendResponse(
            422,
            'error',
            'Email and password are required.'
        );
    }

    // Find account
    $stmt = $pdo->prepare(
        "SELECT
            user_id,
            first_name,
            last_name,
            email,
            password,
            role,
            account_status
         FROM users
         WHERE email = ?
         LIMIT 1"
    );

    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Verify password
    if (
        !$user ||
        !password_verify($password, $user['password'])
    ) {
        sendResponse(
            401,
            'error',
            'Invalid email or password.'
        );
    }

    // Check account status
    if ($user['account_status'] !== 'active') {
        sendResponse(
            403,
            'error',
            'This account is not active.'
        );
    }

    // Create a fresh session ID
    session_regenerate_id(true);

    $_SESSION['user_id'] = (int) $user['user_id'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['email'] = $user['email'];

    // Refresh CSRF token after login
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    sendResponse(
        200,
        'success',
        'Login successful.',
        [
            'user_id' => (int) $user['user_id'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    );

} catch (Throwable $e) {
    error_log($e->getMessage());
    sendResponse(500, 'error', 'Unable to log in.');
}
