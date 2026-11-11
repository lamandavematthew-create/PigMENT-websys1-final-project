
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

try {
    require_once __DIR__ . '/../database/db.php';

    $data = json_decode(file_get_contents('php://input'), true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid JSON request.'
        ]);
        exit;
    }

    $email = strtolower(trim($data['email'] ?? ''));
    $password = $data['password'] ?? '';

    if ($email === '' || !is_string($password) || $password === '') {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'message' => 'Email and password are required.'
        ]);
        exit;
    }

    $stmt = $pdo->prepare(
        "SELECT user_id, first_name, last_name, email,
                password, role, account_status
         FROM users
         WHERE email = :email
         LIMIT 1"
    );

    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid email or password.'
        ]);
        exit;
    }

    if ($user['account_status'] !== 'active') {
        http_response_code(403);
        echo json_encode([
            'status' => 'error',
            'message' => 'This account is not active.'
        ]);
        exit;
    }

    session_regenerate_id(true);

    $_SESSION['user_id'] = (int) $user['user_id'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['email'] = $user['email'];

    echo json_encode([
        'status' => 'success',
        'message' => 'Login successful.',
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
        'message' => 'Unable to log in. Please try again.'
    ]);
}
