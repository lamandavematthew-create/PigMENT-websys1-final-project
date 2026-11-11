<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['GET', 'PUT'], true)) {
    header('Allow: GET, PUT');
    sendResponse(405, 'error', 'Method not allowed.');
}

try {
    $user = requireLogin($pdo);
    $userId = (int) $user['user_id'];

    if ($method === 'GET') {
        $stmt = $pdo->prepare(
            "SELECT user_id, first_name, last_name, email, phone_number,
                    municipality, barangay, address, role
             FROM users
             WHERE user_id = ?
             LIMIT 1"
        );
        $stmt->execute([$userId]);
        $profile = $stmt->fetch();

        if (!$profile) {
            sendResponse(404, 'error', 'Profile not found.');
        }

        $profile['user_id'] = (int) $profile['user_id'];
        sendResponse(200, 'success', 'Profile retrieved successfully.', $profile);
    }

    requireCsrf();
    $data = json_decode(file_get_contents('php://input'), true);

    if (!is_array($data)) {
        sendResponse(400, 'error', 'Invalid JSON request.');
    }

    $fields = [
        'first_name' => trim((string) ($data['first_name'] ?? '')),
        'last_name' => trim((string) ($data['last_name'] ?? '')),
        'phone_number' => trim((string) ($data['phone_number'] ?? '')),
        'municipality' => trim((string) ($data['municipality'] ?? '')),
        'barangay' => trim((string) ($data['barangay'] ?? '')),
        'address' => trim((string) ($data['address'] ?? ''))
    ];

    if (
        $fields['first_name'] === '' ||
        $fields['last_name'] === '' ||
        $fields['phone_number'] === '' ||
        $fields['municipality'] === '' ||
        $fields['barangay'] === ''
    ) {
        sendResponse(422, 'error', 'Please complete all required fields.');
    }

    if (
        strlen($fields['first_name']) > 100 ||
        strlen($fields['last_name']) > 100 ||
        strlen($fields['phone_number']) > 20 ||
        strlen($fields['municipality']) > 100 ||
        strlen($fields['barangay']) > 100 ||
        strlen($fields['address']) > 255
    ) {
        sendResponse(422, 'error', 'One or more fields are too long.');
    }

    $stmt = $pdo->prepare(
        "UPDATE users
         SET first_name = ?, last_name = ?, phone_number = ?,
             municipality = ?, barangay = ?, address = ?
         WHERE user_id = ? AND account_status = 'active'"
    );
    $stmt->execute([
        $fields['first_name'],
        $fields['last_name'],
        $fields['phone_number'],
        $fields['municipality'],
        $fields['barangay'],
        $fields['address'] ?: null,
        $userId
    ]);

    sendResponse(200, 'success', 'Profile updated successfully.');
} catch (PDOException $error) {
    error_log($error->getMessage());
    sendResponse(500, 'error', 'Profile update failed.');
} catch (Throwable $error) {
    error_log($error->getMessage());
    sendResponse(500, 'error', 'Unable to process profile request.');
}
