
<?php

header('Content-Type: application/json; charset=utf-8');

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');

$isHttps = (
    !empty($_SERVER['HTTPS']) &&
    $_SERVER['HTTPS'] !== 'off'
);

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax'
]);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Return a JSON response
function sendResponse($code, $status, $message, $data = null) {
    http_response_code($code);

    $response = [
        'status' => $status,
        'message' => $message
    ];

    if ($data !== null) {
        $response['data'] = $data;
    }

    echo json_encode($response);
    exit;
}

// Check if the account is logged in and active
function requireLogin($pdo) {
    if (empty($_SESSION['user_id'])) {
        sendResponse(401, 'error', 'Please log in first.');
    }

    $stmt = $pdo->prepare(
        "SELECT user_id, role, account_status
         FROM users
         WHERE user_id = ?"
    );

    $stmt->execute([$_SESSION['user_id']]);

    $user = $stmt->fetch();

    if (!$user || $user['account_status'] !== 'active') {
        $_SESSION = [];
        session_destroy();

        sendResponse(401, 'error', 'Invalid session.');
    }

    return $user;
}

// Check if the logged-in user is an admin
function requireAdmin($pdo) {
    $user = requireLogin($pdo);

    if ($user['role'] !== 'admin') {
        sendResponse(403, 'error', 'Admin access only.');
    }

    return $user;
}

// Generate a CSRF token
function getCsrfToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

// Verify the CSRF token
function requireCsrf() {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';

    if (
        !is_string($token) ||
        !is_string($expected) ||
        $expected === '' ||
        !hash_equals($expected, $token)
    ) {
        sendResponse(403, 'error', 'Invalid CSRF token.');
    }
}
