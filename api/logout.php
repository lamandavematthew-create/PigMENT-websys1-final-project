
<?php

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);

    echo json_encode([
        'status' => 'error',
        'message' => 'Method not allowed.'
    ]);
    exit;
}

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);

    echo json_encode([
        'status' => 'error',
        'message' => 'Not authenticated.'
    ]);
    exit;
}

// Clear session data
$_SESSION = [];

// Remove the session cookie
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();

    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $params['path'],
        'domain' => $params['domain'],
        'secure' => $params['secure'],
        'httponly' => $params['httponly'],
        'samesite' => $params['samesite'] ?: 'Lax'
    ]);
}

// Destroy the server-side session
session_destroy();

echo json_encode([
    'status' => 'success',
    'message' => 'Logged out successfully.'
]);
