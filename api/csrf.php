
<?php

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    sendResponse(405, 'error', 'Method not allowed.');
}

echo json_encode([
    'status' => 'success',
    'csrf_token' => getCsrfToken()
]);
