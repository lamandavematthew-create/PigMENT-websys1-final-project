
<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
    header('Allow: GET, POST, PUT, DELETE');
    sendResponse(405, 'error', 'Method not allowed.');
}

try {
    // Verify the logged-in farmer
    $user = requireLogin($pdo);

    if ($user['role'] !== 'farmer') {
        sendResponse(403, 'error', 'Farmer access only.');
    }

    $ownerId = (int) $user['user_id'];

    if ($method !== 'GET') {
        requireCsrf();
    }

    // Check that a pig belongs to this farmer
    function ownsPig($pdo, $pigId, $ownerId) {
        $stmt = $pdo->prepare(
            "SELECT pig_id FROM pigs
             WHERE pig_id = ? AND owner_id = ?"
        );

        $stmt->execute([$pigId, $ownerId]);

        return (bool) $stmt->fetch();
    }

    // ====================================
    // GET - VIEW MEASUREMENT HISTORY
    // ====================================

    if ($method === 'GET') {

        $pigId = filter_var(
            $_GET['pig_id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$pigId) {
            sendResponse(422, 'error', 'Valid pig ID required.');
        }

        if (!ownsPig($pdo, $pigId, $ownerId)) {
            sendResponse(404, 'error', 'Pig not found.');
        }

        $stmt = $pdo->prepare(
            "SELECT *
             FROM weight_records
             WHERE pig_id = ?
             ORDER BY measurement_date DESC,
                      weight_record_id DESC"
        );

        $stmt->execute([$pigId]);

        sendResponse(
            200,
            'success',
            'Measurement history retrieved.',
            $stmt->fetchAll()
        );
    }

    // ====================================
    // DELETE - REMOVE A MEASUREMENT
    // ====================================

    if ($method === 'DELETE') {

        $recordId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$recordId) {
            sendResponse(422, 'error', 'Valid record ID required.');
        }

        $stmt = $pdo->prepare(
            "DELETE wr FROM weight_records wr
             INNER JOIN pigs p ON wr.pig_id = p.pig_id
             WHERE wr.weight_record_id = ?
             AND p.owner_id = ?"
        );

        $stmt->execute([$recordId, $ownerId]);

        if ($stmt->rowCount() === 0) {
            sendResponse(404, 'error', 'Record not found.');
        }

        sendResponse(
            200,
            'success',
            'Measurement deleted successfully.'
        );
    }

    // ====================================
    // READ AND VALIDATE INPUT
    // ====================================

    $data = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($data)) {
        sendResponse(400, 'error', 'Invalid JSON request.');
    }

    $pigId = filter_var(
        $data['pig_id'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );

    $heartGirth = $data['heart_girth'] ?? null;
    $bodyLength = $data['body_length'] ?? null;
    $estimatedWeight = $data['estimated_weight'] ?? null;
    $measurementDate = $data['measurement_date'] ?? '';
    $notes = $data['notes'] ?? '';

    if (!$pigId || !ownsPig($pdo, $pigId, $ownerId)) {
        sendResponse(404, 'error', 'Pig not found.');
    }

    // Measurements must be positive numbers
    if (
        !is_numeric($heartGirth) ||
        !is_numeric($bodyLength) ||
        $heartGirth <= 0 ||
        $bodyLength <= 0 ||
        $heartGirth > 99999.99 ||
        $bodyLength > 99999.99
    ) {
        sendResponse(
            422,
            'error',
            'Enter valid heart girth and body length.'
        );
    }

    // Estimated weight is optional
    if ($estimatedWeight === '') {
        $estimatedWeight = null;
    }

    if (
        $estimatedWeight !== null &&
        (
            !is_numeric($estimatedWeight) ||
            $estimatedWeight <= 0 ||
            $estimatedWeight > 999999.99
        )
    ) {
        sendResponse(422, 'error', 'Invalid weight estimate.');
    }

    // Check measurement date
    if (!is_string($measurementDate)) {
        sendResponse(422, 'error', 'Invalid measurement date.');
    }

    $date = DateTimeImmutable::createFromFormat(
        '!Y-m-d',
        $measurementDate
    );

    if (
        !$date ||
        $date->format('Y-m-d') !== $measurementDate ||
        $measurementDate > date('Y-m-d')
    ) {
        sendResponse(422, 'error', 'Invalid measurement date.');
    }

    if (!is_string($notes)) {
        sendResponse(422, 'error', 'Invalid notes.');
    }

    $notes = trim($notes);

    // All input measurements use cm and kg
    $measurementUnit = 'cm';
    $weightUnit = 'kg';

    // ====================================
    // POST - ADD NEW MEASUREMENT
    // ====================================

    if ($method === 'POST') {

        $stmt = $pdo->prepare(
            "INSERT INTO weight_records (
                pig_id,
                heart_girth,
                body_length,
                measurement_unit,
                estimated_weight,
                weight_unit,
                measurement_date,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );

        $stmt->execute([
            $pigId,
            $heartGirth,
            $bodyLength,
            $measurementUnit,
            $estimatedWeight,
            $weightUnit,
            $measurementDate,
            $notes ?: null
        ]);

        sendResponse(
            201,
            'success',
            'Measurement saved successfully.',
            [
                'weight_record_id' => (int) $pdo->lastInsertId()
            ]
        );
    }

    // ====================================
    // PUT - UPDATE MEASUREMENT
    // ====================================

    if ($method === 'PUT') {

        $recordId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$recordId) {
            sendResponse(422, 'error', 'Valid record ID required.');
        }

        // Check record ownership
        $stmt = $pdo->prepare(
            "SELECT wr.weight_record_id
             FROM weight_records wr
             INNER JOIN pigs p ON wr.pig_id = p.pig_id
             WHERE wr.weight_record_id = ?
             AND p.owner_id = ?"
        );

        $stmt->execute([$recordId, $ownerId]);

        if (!$stmt->fetch()) {
            sendResponse(404, 'error', 'Record not found.');
        }

        $stmt = $pdo->prepare(
            "UPDATE weight_records
             SET pig_id = ?,
                 heart_girth = ?,
                 body_length = ?,
                 measurement_unit = ?,
                 estimated_weight = ?,
                 weight_unit = ?,
                 measurement_date = ?,
                 notes = ?
             WHERE weight_record_id = ?"
        );

        $stmt->execute([
            $pigId,
            $heartGirth,
            $bodyLength,
            $measurementUnit,
            $estimatedWeight,
            $weightUnit,
            $measurementDate,
            $notes ?: null,
            $recordId
        ]);

        sendResponse(
            200,
            'success',
            'Measurement updated successfully.'
        );
    }

} catch (Throwable $e) {
    error_log($e->getMessage());

    sendResponse(
        500,
        'error',
        'Unable to process measurement record.'
    );
}
