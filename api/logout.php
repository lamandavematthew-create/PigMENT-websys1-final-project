
<?php

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    sendResponse(405, 'error', 'Method not allowed.');
}

requireCsrf();

if (empty($_SESSION['user_id'])) {
    sendResponse(401, 'error', 'Not authenticated.');
}

// Clear all session information
$_SESSION = [];

// Delete the session cookie
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

// Destroy the session
session_destroy();

sendResponse(
    200,
    'success',
    'Logged out successfully.'
);
