
<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
    header('Allow: GET, POST, PUT, DELETE');
    sendResponse(405, 'error', 'Method not allowed.');
}

try {
    // Check the logged-in user
    $user = requireLogin($pdo);

    if ($user['role'] !== 'farmer') {
        sendResponse(403, 'error', 'Farmer access only.');
    }

    $ownerId = (int) $user['user_id'];

    // CSRF protection for requests that change data
    if ($method !== 'GET') {
        requireCsrf();
    }

    // =====================================
    // GET - RETRIEVE LITTER RECORDS
    // =====================================

    if ($method === 'GET') {

        $sql = "
            SELECT
                l.litter_id,
                l.mother_pig_id,
                p.pig_name AS mother_name,
                p.pig_code AS mother_code,
                l.birth_date,
                l.total_born,
                l.born_alive,
                l.stillborn,
                l.notes,
                l.created_at,
                l.updated_at
            FROM litters l
            INNER JOIN pigs p
                ON l.mother_pig_id = p.pig_id
            WHERE l.owner_id = ?
            AND p.owner_id = ?
        ";

        $params = [$ownerId, $ownerId];

        // Optionally retrieve one litter
        if (isset($_GET['id'])) {
            $litterId = filter_var(
                $_GET['id'],
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1]]
            );

            if (!$litterId) {
                sendResponse(422, 'error', 'Invalid litter ID.');
            }

            $sql .= " AND l.litter_id = ?";
            $params[] = $litterId;
        }

        $sql .= " ORDER BY l.birth_date DESC, l.litter_id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        if (isset($_GET['id'])) {
            $litter = $stmt->fetch();

            if (!$litter) {
                sendResponse(404, 'error', 'Litter not found.');
            }

            sendResponse(
                200,
                'success',
                'Litter record retrieved.',
                $litter
            );
        }

        sendResponse(
            200,
            'success',
            'Litter records retrieved.',
            $stmt->fetchAll()
        );
    }

    // =====================================
    // DELETE - DELETE LITTER RECORD
    // =====================================

    if ($method === 'DELETE') {

        $litterId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$litterId) {
            sendResponse(422, 'error', 'Valid litter ID required.');
        }

        $stmt = $pdo->prepare(
            "DELETE FROM litters
             WHERE litter_id = ? AND owner_id = ?"
        );

        $stmt->execute([$litterId, $ownerId]);

        if ($stmt->rowCount() === 0) {
            sendResponse(404, 'error', 'Litter not found.');
        }

        sendResponse(
            200,
            'success',
            'Litter record deleted successfully.'
        );
    }

    // =====================================
    // READ AND VALIDATE JSON INPUT
    // =====================================

    $data = json_decode(
        file_get_contents('php://input'),
        true
    );

    if (!is_array($data)) {
        sendResponse(400, 'error', 'Invalid JSON request.');
    }

    $motherPigId = filter_var(
        $data['mother_pig_id'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );

    $birthDate = $data['birth_date'] ?? '';
    $totalBorn = $data['total_born'] ?? null;
    $bornAlive = $data['born_alive'] ?? null;
    $stillborn = $data['stillborn'] ?? null;
    $notes = $data['notes'] ?? '';

    if (!$motherPigId) {
        sendResponse(422, 'error', 'Valid mother pig ID required.');
    }

    // Check if the mother pig belongs to this farmer
    $stmt = $pdo->prepare(
        "SELECT pig_id, sex, pig_status, birth_date
         FROM pigs
         WHERE pig_id = ? AND owner_id = ?"
    );

    $stmt->execute([$motherPigId, $ownerId]);
    $mother = $stmt->fetch();

    if (!$mother) {
        sendResponse(404, 'error', 'Mother pig not found.');
    }

    if ($mother['sex'] !== 'female') {
        sendResponse(
            422,
            'error',
            'The selected mother pig must be female.'
        );
    }

    // Validate farrowing date
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

    if (
        $mother['birth_date'] !== null &&
        $birthDate <= $mother['birth_date']
    ) {
        sendResponse(
            422,
            'error',
            'Litter date must be after the mother pig birth date.'
        );
    }

    // Validate number of piglets
    $totalBorn = filter_var(
        $totalBorn,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 0]]
    );

    $bornAlive = filter_var(
        $bornAlive,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 0]]
    );

    $stillborn = filter_var(
        $stillborn,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 0]]
    );

    if (
        $totalBorn === false ||
        $bornAlive === false ||
        $stillborn === false
    ) {
        sendResponse(
            422,
            'error',
            'Piglet counts must be non-negative whole numbers.'
        );
    }

    if ($totalBorn !== $bornAlive + $stillborn) {
        sendResponse(
            422,
            'error',
            'Total born must equal born alive plus stillborn.'
        );
    }

    if (!is_string($notes)) {
        sendResponse(422, 'error', 'Invalid notes.');
    }

    $notes = trim($notes);

    // =====================================
    // POST - CREATE LITTER RECORD
    // =====================================

    if ($method === 'POST') {

        if ($mother['pig_status'] !== 'active') {
            sendResponse(
                409,
                'error',
                'Cannot create a litter for an inactive pig.'
            );
        }

        $stmt = $pdo->prepare(
            "INSERT INTO litters (
                owner_id,
                mother_pig_id,
                birth_date,
                total_born,
                born_alive,
                stillborn,
                notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );

        $stmt->execute([
            $ownerId,
            $motherPigId,
            $birthDate,
            $totalBorn,
            $bornAlive,
            $stillborn,
            $notes ?: null
        ]);

        sendResponse(
            201,
            'success',
            'Litter recorded successfully.',
            [
                'litter_id' => (int) $pdo->lastInsertId()
            ]
        );
    }

    // =====================================
    // PUT - UPDATE LITTER RECORD
    // =====================================

    if ($method === 'PUT') {

        $litterId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$litterId) {
            sendResponse(422, 'error', 'Valid litter ID required.');
        }

        // Check if the farmer owns this litter
        $stmt = $pdo->prepare(
            "SELECT litter_id
             FROM litters
             WHERE litter_id = ? AND owner_id = ?"
        );

        $stmt->execute([$litterId, $ownerId]);

        if (!$stmt->fetch()) {
            sendResponse(404, 'error', 'Litter not found.');
        }

        // Update the litter
        $stmt = $pdo->prepare(
            "UPDATE litters
             SET mother_pig_id = ?,
                 birth_date = ?,
                 total_born = ?,
                 born_alive = ?,
                 stillborn = ?,
                 notes = ?
             WHERE litter_id = ? AND owner_id = ?"
        );

        $stmt->execute([
            $motherPigId,
            $birthDate,
            $totalBorn,
            $bornAlive,
            $stillborn,
            $notes ?: null,
            $litterId,
            $ownerId
        ]);

        sendResponse(
            200,
            'success',
            'Litter record updated successfully.'
        );
    }

} catch (PDOException $e) {
    error_log($e->getMessage());

    if ($e->getCode() === '23000') {
        sendResponse(
            409,
            'error',
            'Litter record conflicts with an existing record.'
        );
    }

    sendResponse(500, 'error', 'Database operation failed.');

} catch (Throwable $e) {
    error_log($e->getMessage());

    sendResponse(
        500,
        'error',
        'Unable to process litter record.'
    );
}

