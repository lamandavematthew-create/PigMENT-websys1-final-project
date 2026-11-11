
<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

// Check the request method
$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'])) {
    header('Allow: GET, POST, PUT, DELETE');
    sendResponse(405, 'error', 'Method not allowed.');
}

try {
    // Check if the user is logged in
    $user = requireLogin($pdo);

    // Only farmers can manage pig records
    if ($user['role'] !== 'farmer') {
        sendResponse(403, 'error', 'Farmer access only.');
    }

    $ownerId = (int) $user['user_id'];

    // Validate CSRF for requests that change data
    if ($method !== 'GET') {
        requireCsrf();
    }

    // =====================================
    // GET - RETRIEVE PIG RECORDS
    // =====================================

    if ($method === 'GET') {

        // Retrieve one pig if an ID is provided
        if (isset($_GET['id'])) {
            $pigId = filter_var(
                $_GET['id'],
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1]]
            );

            if (!$pigId) {
                sendResponse(422, 'error', 'Invalid pig ID.');
            }

            $stmt = $pdo->prepare(
                "SELECT * FROM pigs
                 WHERE pig_id = ? AND owner_id = ?"
            );

            $stmt->execute([$pigId, $ownerId]);
            $pig = $stmt->fetch();

            if (!$pig) {
                sendResponse(404, 'error', 'Pig not found.');
            }

            sendResponse(
                200,
                'success',
                'Pig record retrieved.',
                $pig
            );
        }

        // Retrieve all pigs belonging to the farmer
        $stmt = $pdo->prepare(
            "SELECT * FROM pigs
             WHERE owner_id = ?
             ORDER BY created_at DESC, pig_id DESC"
        );

        $stmt->execute([$ownerId]);

        sendResponse(
            200,
            'success',
            'Pig records retrieved.',
            $stmt->fetchAll()
        );
    }

    // =====================================
    // DELETE - REMOVE A PIG
    // =====================================

    if ($method === 'DELETE') {

        $pigId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$pigId) {
            sendResponse(422, 'error', 'Valid pig ID required.');
        }

        $stmt = $pdo->prepare(
            "DELETE FROM pigs
             WHERE pig_id = ? AND owner_id = ?"
        );

        $stmt->execute([$pigId, $ownerId]);

        if ($stmt->rowCount() === 0) {
            sendResponse(404, 'error', 'Pig not found.');
        }

        sendResponse(
            200,
            'success',
            'Pig record deleted successfully.'
        );
    }

    // =====================================
    // READ JSON FOR POST AND PUT
    // =====================================

    $data = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($data)) {
        sendResponse(400, 'error', 'Invalid JSON request.');
    }

    // Read pig information
    $pigCode = $data['pig_code'] ?? '';
    $pigName = $data['pig_name'] ?? '';
    $breed = $data['breed'] ?? '';
    $sex = $data['sex'] ?? '';
    $birthDate = $data['birth_date'] ?? null;
    $age = $data['estimated_age_months'] ?? null;
    $notes = $data['notes'] ?? '';

    // Check text field types
    if (
        !is_string($pigCode) ||
        !is_string($pigName) ||
        !is_string($breed) ||
        !is_string($sex) ||
        !is_string($notes)
    ) {
        sendResponse(422, 'error', 'Invalid field types.');
    }

    $pigCode = trim($pigCode);
    $pigName = trim($pigName);
    $breed = trim($breed);
    $notes = trim($notes);

    // Validate required fields
    if (
        $pigCode === '' ||
        $pigName === '' ||
        $breed === '' ||
        !in_array($sex, ['male', 'female'], true)
    ) {
        sendResponse(
            422,
            'error',
            'Please provide valid pig information.'
        );
    }

    // Validate field lengths
    if (
        strlen($pigCode) > 50 ||
        strlen($pigName) > 100 ||
        strlen($breed) > 100
    ) {
        sendResponse(422, 'error', 'Text is too long.');
    }

    // Validate birth date
    if ($birthDate === '') {
        $birthDate = null;
    }

    if ($birthDate !== null) {
        if (!is_string($birthDate)) {
            sendResponse(422, 'error', 'Invalid birth date.');
        }

        $date = DateTimeImmutable::createFromFormat(
            '!Y-m-d',
            $birthDate
        );

        if (
            !$date ||
            $date->format('Y-m-d') !== $birthDate ||
            $birthDate > date('Y-m-d')
        ) {
            sendResponse(422, 'error', 'Invalid birth date.');
        }
    }

    // Validate estimated age
    if ($age === '') {
        $age = null;
    }

    if (
        $age !== null &&
        (
            !is_numeric($age) ||
            $age < 0 ||
            $age > 999.99
        )
    ) {
        sendResponse(422, 'error', 'Invalid estimated age.');
    }

    // =====================================
    // POST - REGISTER A NEW PIG
    // =====================================

    if ($method === 'POST') {

        $stmt = $pdo->prepare(
            "INSERT INTO pigs (
                owner_id,
                pig_code,
                pig_name,
                breed,
                sex,
                birth_date,
                estimated_age_months,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );

        $stmt->execute([
            $ownerId,
            $pigCode,
            $pigName,
            $breed,
            $sex,
            $birthDate,
            $age,
            $notes ?: null
        ]);

        sendResponse(
            201,
            'success',
            'Pig registered successfully.',
            ['pig_id' => (int) $pdo->lastInsertId()]
        );
    }

    // =====================================
    // PUT - UPDATE AN EXISTING PIG
    // =====================================

    if ($method === 'PUT') {

        $pigId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$pigId) {
            sendResponse(422, 'error', 'Valid pig ID required.');
        }

        // Check that the farmer owns the pig
        $stmt = $pdo->prepare(
            "SELECT pig_id FROM pigs
             WHERE pig_id = ? AND owner_id = ?"
        );

        $stmt->execute([$pigId, $ownerId]);

        if (!$stmt->fetch()) {
            sendResponse(404, 'error', 'Pig not found.');
        }

        // Validate pig status
        $pigStatus = $data['pig_status'] ?? 'active';

        if (
            !in_array(
                $pigStatus,
                ['active', 'sold', 'deceased'],
                true
            )
        ) {
            sendResponse(422, 'error', 'Invalid pig status.');
        }

        // Update the record
        $stmt = $pdo->prepare(
            "UPDATE pigs
             SET pig_code = ?,
                 pig_name = ?,
                 breed = ?,
                 sex = ?,
                 birth_date = ?,
                 estimated_age_months = ?,
                 notes = ?,
                 pig_status = ?
             WHERE pig_id = ? AND owner_id = ?"
        );

        $stmt->execute([
            $pigCode,
            $pigName,
            $breed,
            $sex,
            $birthDate,
            $age,
            $notes ?: null,
            $pigStatus,
            $pigId,
            $ownerId
        ]);

        sendResponse(
            200,
            'success',
            'Pig record updated successfully.'
        );
    }

} catch (PDOException $e) {

    error_log($e->getMessage());

    if ($e->getCode() === '23000') {
        sendResponse(
            409,
            'error',
            'This operation conflicts with an existing record or a related record.'
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
