
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

    $firstName = trim($data['first_name'] ?? '');
    $lastName = trim($data['last_name'] ?? '');
    $email = strtolower(trim($data['email'] ?? ''));
    $password = $data['password'] ?? '';
    $phoneNumber = trim($data['phone_number'] ?? '');
    $municipality = trim($data['municipality'] ?? '');
    $barangay = trim($data['barangay'] ?? '');
    $address = trim($data['address'] ?? '');

    // Check required fields
    if (
        $firstName === '' ||
        $lastName === '' ||
        $email === '' ||
        $password === '' ||
        $phoneNumber === '' ||
        $municipality === '' ||
        $barangay === ''
    ) {
        sendResponse(
            422,
            'error',
            'Please complete all required fields.'
        );
    }

    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendResponse(422, 'error', 'Invalid email address.');
    }

    // Validate password
    if (!is_string($password) || strlen($password) < 8) {
        sendResponse(
            422,
            'error',
            'Password must contain at least 8 characters.'
        );
    }

    if (strlen($password) > 72) {
        sendResponse(
            422,
            'error',
            'Password must not exceed 72 bytes.'
        );
    }

    // Check field lengths
    if (
        strlen($firstName) > 100 ||
        strlen($lastName) > 100 ||
        strlen($email) > 150 ||
        strlen($phoneNumber) > 20 ||
        strlen($municipality) > 100 ||
        strlen($barangay) > 100
    ) {
        sendResponse(422, 'error', 'One or more fields are too long.');
    }

    // Check whether the email exists
    $stmt = $pdo->prepare(
        "SELECT user_id FROM users WHERE email = ?"
    );

    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        sendResponse(
            409,
            'error',
            'This email is already registered.'
        );
    }

    // Hash password
    $hashedPassword = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    // Insert farmer account
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'farmer', 'active')"
    );

    $stmt->execute([
        $firstName,
        $lastName,
        $email,
        $hashedPassword,
        $phoneNumber,
        $address ?: null,
        $municipality,
        $barangay
    ]);

    sendResponse(
        201,
        'success',
        'Account registered successfully.'
    );

} catch (PDOException $e) {
    error_log($e->getMessage());

    if ($e->getCode() === '23000') {
        sendResponse(
            409,
            'error',
            'This email is already registered.'
        );
    }

    sendResponse(500, 'error', 'Registration failed.');

} catch (Throwable $e) {
    error_log($e->getMessage());
    sendResponse(500, 'error', 'An unexpected error occurred.');
}
