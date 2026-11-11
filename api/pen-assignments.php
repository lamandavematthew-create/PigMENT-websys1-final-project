
<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    sendResponse(405, 'error', 'Method not allowed.');
}

try {
    $user = requireLogin($pdo);

    if ($user['role'] !== 'farmer') {
        sendResponse(403, 'error', 'Farmer access only.');
    }

    $ownerId = (int) $user['user_id'];

    // =====================================
    // GET - VIEW ASSIGNMENT HISTORY
    // =====================================

    if ($method === 'GET') {
        $sql = "
            SELECT
                h.assignment_id,
                h.pig_id,
                p.pig_name,
                p.pig_code,
                h.pen_id,
                pen.pen_name,
                h.date_assigned,
                h.date_removed,
                h.assignment_status,
                h.notes
            FROM pig_pen_history h
            JOIN pigs p ON h.pig_id = p.pig_id
            JOIN pens pen ON h.pen_id = pen.pen_id
            WHERE p.owner_id = ?
            AND pen.owner_id = ?
        ";

        $params = [$ownerId, $ownerId];

        if (isset($_GET['pig_id'])) {
            $pigId = filter_var(
                $_GET['pig_id'],
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1]]
            );

            if (!$pigId) {
                sendResponse(422, 'error', 'Invalid pig ID.');
            }

            $sql .= " AND h.pig_id = ?";
            $params[] = $pigId;
        }

        $sql .= "
            ORDER BY h.date_assigned DESC,
                     h.assignment_id DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        sendResponse(
            200,
            'success',
            'Assignment history retrieved.',
            $stmt->fetchAll()
        );
    }

    // =====================================
    // POST - CHANGE PEN ASSIGNMENT
    // =====================================

    requireCsrf();

    $data = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($data)) {
        sendResponse(400, 'error', 'Invalid JSON request.');
    }

    $action = $data['action'] ?? '';
    $pigId = filter_var(
        $data['pig_id'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );

    if (
        !in_array($action, ['assign', 'transfer', 'remove'], true) ||
        !$pigId
    ) {
        sendResponse(422, 'error', 'Invalid action or pig ID.');
    }

    $penId = null;

    if ($action !== 'remove') {
        $penId = filter_var(
            $data['pen_id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$penId) {
            sendResponse(422, 'error', 'Valid pen ID required.');
        }
    }

    $notes = $data['notes'] ?? '';

    if (!is_string($notes)) {
        sendResponse(422, 'error', 'Invalid notes.');
    }

    $notes = trim($notes);

    // Use a transaction so related changes stay together.
    $pdo->beginTransaction();

    // Lock the pig while changing its assignment.
    $stmt = $pdo->prepare(
        "SELECT pig_id, pig_status
         FROM pigs
         WHERE pig_id = ? AND owner_id = ?
         FOR UPDATE"
    );

    $stmt->execute([$pigId, $ownerId]);
    $pig = $stmt->fetch();

    if (!$pig) {
        $pdo->rollBack();
        sendResponse(404, 'error', 'Pig not found.');
    }

    if ($pig['pig_status'] !== 'active') {
        $pdo->rollBack();
        sendResponse(409, 'error', 'Pig is not active.');
    }

    // Find the current pen assignment.
    $stmt = $pdo->prepare(
        "SELECT h.assignment_id, h.pen_id
         FROM pig_pen_history h
         JOIN pens pen ON h.pen_id = pen.pen_id
         WHERE h.pig_id = ?
         AND pen.owner_id = ?
         AND h.assignment_status = 'active'
         AND h.date_removed IS NULL
         FOR UPDATE"
    );

    $stmt->execute([$pigId, $ownerId]);
    $currentAssignments = $stmt->fetchAll();

    if (count($currentAssignments) > 1) {
        $pdo->rollBack();
        sendResponse(
            409,
            'error',
            'Multiple active assignments found. Please correct the records.'
        );
    }

    $current = $currentAssignments[0] ?? null;

    // =====================================
    // REMOVE PIG FROM PEN
    // =====================================

    if ($action === 'remove') {
        if (!$current) {
            $pdo->rollBack();
            sendResponse(
                404,
                'error',
                'Pig has no active pen assignment.'
            );
        }

        $stmt = $pdo->prepare(
            "UPDATE pig_pen_history
             SET assignment_status = 'removed',
                 date_removed = NOW()
             WHERE assignment_id = ?"
        );

        $stmt->execute([$current['assignment_id']]);

        $pdo->commit();

        sendResponse(
            200,
            'success',
            'Pig removed from pen successfully.'
        );
    }

    // =====================================
    // CHECK ASSIGNMENT ACTION
    // =====================================

    if ($action === 'assign' && $current) {
        $pdo->rollBack();
        sendResponse(
            409,
            'error',
            'Pig is already assigned to a pen.'
        );
    }

    if ($action === 'transfer' && !$current) {
        $pdo->rollBack();
        sendResponse(
            409,
            'error',
            'Pig has no current pen to transfer from.'
        );
    }

    if ($current && (int) $current['pen_id'] === $penId) {
        $pdo->rollBack();
        sendResponse(
            409,
            'error',
            'Pig is already in this pen.'
        );
    }

    // Lock the destination pen before checking capacity.
    $stmt = $pdo->prepare(
        "SELECT pen_id, capacity, pen_status
         FROM pens
         WHERE pen_id = ? AND owner_id = ?
         FOR UPDATE"
    );

    $stmt->execute([$penId, $ownerId]);
    $pen = $stmt->fetch();

    if (!$pen) {
        $pdo->rollBack();
        sendResponse(404, 'error', 'Pen not found.');
    }

    if ($pen['pen_status'] !== 'active') {
        $pdo->rollBack();
        sendResponse(409, 'error', 'Pen is inactive.');
    }

    // Count pigs currently inside the destination pen.
    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
         FROM pig_pen_history
         WHERE pen_id = ?
         AND assignment_status = 'active'
         AND date_removed IS NULL"
    );

    $stmt->execute([$penId]);
    $occupied = (int) $stmt->fetchColumn();

    if ($occupied >= (int) $pen['capacity']) {
        $pdo->rollBack();
        sendResponse(409, 'error', 'Pen is already full.');
    }

    // Close the previous assignment during transfer.
    if ($action === 'transfer') {
        $stmt = $pdo->prepare(
            "UPDATE pig_pen_history
             SET assignment_status = 'transferred',
                 date_removed = NOW()
             WHERE assignment_id = ?"
        );

        $stmt->execute([$current['assignment_id']]);
    }

    // Create the new assignment.
    $stmt = $pdo->prepare(
        "INSERT INTO pig_pen_history (
            pig_id,
            pen_id,
            date_assigned,
            assignment_status,
            notes
        ) VALUES (?, ?, NOW(), 'active', ?)"
    );

    $stmt->execute([
        $pigId,
        $penId,
        $notes ?: null
    ]);

    $assignmentId = (int) $pdo->lastInsertId();

    $pdo->commit();

    sendResponse(
        201,
        'success',
        $action === 'transfer'
            ? 'Pig transferred successfully.'
            : 'Pig assigned successfully.',
        ['assignment_id' => $assignmentId]
    );

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log($e->getMessage());

    sendResponse(
        500,
        'error',
        'Unable to process pen assignment.'
    );
}
