
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

    $firstName = trim($data['first_name'] ?? '');
    $lastName = trim($data['last_name'] ?? '');
    $email = strtolower(trim($data['email'] ?? ''));
    $password = $data['password'] ?? '';
    $phoneNumber = trim($data['phone_number'] ?? '');
    $municipality = trim($data['municipality'] ?? '');
    $barangay = trim($data['barangay'] ?? '');
    $address = trim($data['address'] ?? '');

    if (
        $firstName === '' ||
        $lastName === '' ||
        $email === '' ||
        $password === '' ||
        $phoneNumber === '' ||
        $municipality === '' ||
        $barangay === ''
    ) {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'message' => 'Please complete all required fields.'
        ]);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'message' => 'Please enter a valid email address.'
        ]);
        exit;
    }

    if (strlen($password) < 8) {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'message' => 'Password must contain at least 8 characters.'
        ]);
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare(
        "INSERT INTO users (
            first_name,
            last_name,
            email,
            password,
            phone_number,
            address,
            municipality,
            barangay,
            role,
            account_status
        ) VALUES (
            :first_name,
            :last_name,
            :email,
            :password,
            :phone_number,
            :address,
            :municipality,
            :barangay,
            'farmer',
            'active'
        )"
    );

    $stmt->execute([
        ':first_name' => $firstName,
        ':last_name' => $lastName,
        ':email' => $email,
        ':password' => $hashedPassword,
        ':phone_number' => $phoneNumber,
        ':address' => $address ?: null,
        ':municipality' => $municipality,
        ':barangay' => $barangay
    ]);

    http_response_code(201);

    echo json_encode([
        'status' => 'success',
        'message' => 'Account registered successfully.'
    ]);

} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        http_response_code(409);
        echo json_encode([
            'status' => 'error',
            'message' => 'This email address is already registered.'
        ]);
    } else {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'message' => 'Registration failed.'
        ]);
    }
} catch (Throwable $e) {
    error_log($e->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'An unexpected error occurred.'
    ]);
}
