
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

    // Protect requests that change records
    if ($method !== 'GET') {
        requireCsrf();
    }

    // ====================================
    // GET - VIEW PEN RECORDS
    // ====================================

    if ($method === 'GET') {

        // Retrieve a specific pen
        if (isset($_GET['id'])) {
            $penId = filter_var(
                $_GET['id'],
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1]]
            );

            if (!$penId) {
                sendResponse(422, 'error', 'Invalid pen ID.');
            }

            $stmt = $pdo->prepare(
                "SELECT * FROM pens
                 WHERE pen_id = ? AND owner_id = ?"
            );

            $stmt->execute([$penId, $ownerId]);
            $pen = $stmt->fetch();

            if (!$pen) {
                sendResponse(404, 'error', 'Pen not found.');
            }

            sendResponse(
                200,
                'success',
                'Pen retrieved successfully.',
                $pen
            );
        }

        // Retrieve all pens belonging to the farmer
        $stmt = $pdo->prepare(
            "SELECT * FROM pens
             WHERE owner_id = ?
             ORDER BY pen_id DESC"
        );

        $stmt->execute([$ownerId]);

        sendResponse(
            200,
            'success',
            'Pen records retrieved successfully.',
            $stmt->fetchAll()
        );
    }

    // ====================================
    // DELETE - REMOVE A PEN
    // ====================================

    if ($method === 'DELETE') {

        $penId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$penId) {
            sendResponse(422, 'error', 'Valid pen ID required.');
        }

        // Check pen ownership
        $stmt = $pdo->prepare(
            "SELECT pen_id FROM pens
             WHERE pen_id = ? AND owner_id = ?"
        );

        $stmt->execute([$penId, $ownerId]);

        if (!$stmt->fetch()) {
            sendResponse(404, 'error', 'Pen not found.');
        }

        // Prevent deleting pens with assignment history
        $stmt = $pdo->prepare(
            "SELECT assignment_id
             FROM pig_pen_history
             WHERE pen_id = ?
             LIMIT 1"
        );

        $stmt->execute([$penId]);

        if ($stmt->fetch()) {
            sendResponse(
                409,
                'error',
                'This pen has assignment history. Set it to inactive instead.'
            );
        }

        $stmt = $pdo->prepare(
            "DELETE FROM pens
             WHERE pen_id = ? AND owner_id = ?"
        );

        $stmt->execute([$penId, $ownerId]);

        sendResponse(
            200,
            'success',
            'Pen deleted successfully.'
        );
    }

    // ====================================
    // READ INPUT FOR POST AND PUT
    // ====================================

    $data = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($data)) {
        sendResponse(400, 'error', 'Invalid JSON request.');
    }

    $penName = $data['pen_name'] ?? '';
    $penType = $data['pen_type'] ?? '';
    $capacity = $data['capacity'] ?? null;
    $description = $data['description'] ?? '';
    $penStatus = $data['pen_status'] ?? 'active';

    // Validate text fields
    if (
        !is_string($penName) ||
        !is_string($penType) ||
        !is_string($description)
    ) {
        sendResponse(422, 'error', 'Invalid pen information.');
    }

    $penName = trim($penName);
    $penType = trim($penType);
    $description = trim($description);

    if (
        $penName === '' ||
        strlen($penName) > 100 ||
        strlen($penType) > 100
    ) {
        sendResponse(422, 'error', 'Invalid pen name or type.');
    }

    // Validate pen capacity
    $capacity = filter_var(
        $capacity,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );

    if ($capacity === false) {
        sendResponse(
            422,
            'error',
            'Pen capacity must be a positive whole number.'
        );
    }

    // Validate pen status
    if (
        !in_array(
            $penStatus,
            ['active', 'inactive'],
            true
        )
    ) {
        sendResponse(422, 'error', 'Invalid pen status.');
    }

    // ====================================
    // POST - CREATE A NEW PEN
    // ====================================

    if ($method === 'POST') {

        $stmt = $pdo->prepare(
            "INSERT INTO pens (
                owner_id,
                pen_name,
                pen_type,
                capacity,
                description,
                pen_status
            ) VALUES (?, ?, ?, ?, ?, ?)"
        );

        $stmt->execute([
            $ownerId,
            $penName,
            $penType ?: null,
            $capacity,
            $description ?: null,
            $penStatus
        ]);

        sendResponse(
            201,
            'success',
            'Pen created successfully.',
            [
                'pen_id' => (int) $pdo->lastInsertId()
            ]
        );
    }

    // ====================================
    // PUT - UPDATE AN EXISTING PEN
    // ====================================

    if ($method === 'PUT') {

        $penId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$penId) {
            sendResponse(422, 'error', 'Valid pen ID required.');
        }

        // Verify ownership
        $stmt = $pdo->prepare(
            "SELECT pen_id FROM pens
             WHERE pen_id = ? AND owner_id = ?"
        );

        $stmt->execute([$penId, $ownerId]);

        if (!$stmt->fetch()) {
            sendResponse(404, 'error', 'Pen not found.');
        }

        // Count pigs currently assigned to this pen
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM pig_pen_history
             WHERE pen_id = ?
             AND assignment_status = 'active'
             AND date_removed IS NULL"
        );

        $stmt->execute([$penId]);
        $occupied = (int) $stmt->fetchColumn();

        if ($capacity < $occupied) {
            sendResponse(
                409,
                'error',
                'Capacity cannot be smaller than the number of assigned pigs.'
            );
        }

        // Do not deactivate occupied pens
        if ($penStatus === 'inactive' && $occupied > 0) {
            sendResponse(
                409,
                'error',
                'Transfer or remove assigned pigs before deactivating this pen.'
            );
        }

        // Update pen information
        $stmt = $pdo->prepare(
            "UPDATE pens
             SET pen_name = ?,
                 pen_type = ?,
                 capacity = ?,
                 description = ?,
                 pen_status = ?
             WHERE pen_id = ? AND owner_id = ?"
        );

        $stmt->execute([
            $penName,
            $penType ?: null,
            $capacity,
            $description ?: null,
            $penStatus,
            $penId,
            $ownerId
        ]);

        sendResponse(
            200,
            'success',
            'Pen updated successfully.'
        );
    }

} catch (PDOException $e) {

    error_log($e->getMessage());

    if ($e->getCode() === '23000') {
        sendResponse(
            409,
            'error',
            'Pen name already exists or the pen is linked to another record.'
        );
    }

    sendResponse(500, 'error', 'Database operation failed.');

} catch (Throwable $e) {

    error_log($e->getMessage());

    sendResponse(
        500,
        'error',
        'An unexpected error occurred.'
    );
}
