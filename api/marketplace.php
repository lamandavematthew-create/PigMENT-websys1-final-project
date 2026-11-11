
<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
    header('Allow: GET, POST, PUT, DELETE');
    sendResponse(405, 'error', 'Method not allowed.');
}

try {

    // =====================================
    // GET - VIEW MARKETPLACE LISTINGS
    // =====================================

    if ($method === 'GET') {

        $myListings = ($_GET['mine'] ?? '') === '1';

        // Private listing management
        if ($myListings) {
            $user = requireLogin($pdo);

            if ($user['role'] !== 'farmer') {
                sendResponse(403, 'error', 'Farmer access only.');
            }

            $ownerId = (int) $user['user_id'];

            $stmt = $pdo->prepare(
                "SELECT m.*,
                        (
                            SELECT li.image_path
                            FROM listing_images li
                            WHERE li.listing_id = m.listing_id
                            ORDER BY li.is_primary DESC, li.image_id ASC
                            LIMIT 1
                        ) AS primary_image
                 FROM marketplace_listings m
                 WHERE m.seller_id = ?
                 ORDER BY m.created_at DESC, m.listing_id DESC"
            );

            $stmt->execute([$ownerId]);

            sendResponse(
                200,
                'success',
                'Your listings retrieved.',
                $stmt->fetchAll()
            );
        }

        // Public listing information only
        $sql = "
            SELECT
                m.listing_id,
                m.listing_title,
                m.pig_type,
                m.breed,
                m.sex,
                m.age_months,
                m.estimated_weight,
                m.asking_price,
                m.description,
                m.municipality,
                m.barangay,
                m.listing_status,
                m.created_at,
                u.first_name AS seller_first_name,
                u.last_name AS seller_last_name,
                (
                    SELECT li.image_path
                    FROM listing_images li
                    WHERE li.listing_id = m.listing_id
                    ORDER BY li.is_primary DESC, li.image_id ASC
                    LIMIT 1
                ) AS primary_image
            FROM marketplace_listings m
            INNER JOIN users u ON m.seller_id = u.user_id
            WHERE m.listing_status = 'active'
            AND u.account_status = 'active'
        ";

        $params = [];

        if (isset($_GET['search']) && $_GET['search'] !== '') {
            if (!is_string($_GET['search']) || strlen($_GET['search']) > 100) {
                sendResponse(422, 'error', 'Invalid search term.');
            }
            $term = '%' . trim($_GET['search']) . '%';
            $sql .= " AND (m.listing_title LIKE ? OR m.pig_type LIKE ? OR m.breed LIKE ? OR m.municipality LIKE ? OR m.barangay LIKE ?)";
            array_push($params, $term, $term, $term, $term, $term);
        }

        if (isset($_GET['pig_type']) && $_GET['pig_type'] !== '') {
            $sql .= " AND m.pig_type = ?";
            $params[] = trim((string) $_GET['pig_type']);
        }

        if (isset($_GET['breed']) && $_GET['breed'] !== '') {
            $sql .= " AND m.breed = ?";
            $params[] = trim((string) $_GET['breed']);
        }

        if (isset($_GET['weight_min']) && $_GET['weight_min'] !== '') {
            $sql .= " AND m.estimated_weight >= ?";
            $params[] = (float) $_GET['weight_min'];
        }

        if (isset($_GET['weight_max']) && $_GET['weight_max'] !== '') {
            $sql .= " AND m.estimated_weight <= ?";
            $params[] = (float) $_GET['weight_max'];
        }

        // Optional municipality filter
        if (isset($_GET['municipality']) &&
            $_GET['municipality'] !== '') {

            if (!is_string($_GET['municipality']) ||
                strlen($_GET['municipality']) > 100) {
                sendResponse(422, 'error', 'Invalid municipality.');
            }

            $sql .= " AND m.municipality = ?";
            $params[] = trim($_GET['municipality']);
        }

        // Optional listing ID
        if (isset($_GET['id'])) {
            $listingId = filter_var(
                $_GET['id'],
                FILTER_VALIDATE_INT,
                ['options' => ['min_range' => 1]]
            );

            if (!$listingId) {
                sendResponse(422, 'error', 'Invalid listing ID.');
            }

            $sql .= " AND m.listing_id = ?";
            $params[] = $listingId;
        }

        $sql .= " ORDER BY m.created_at DESC, m.listing_id DESC";

        // Limit public browsing results
        if (!isset($_GET['id'])) {
            $limit = filter_var($_GET['limit'] ?? 50, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 50]]);
            $offset = filter_var($_GET['offset'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
            $sql .= " LIMIT " . ($limit ?: 50) . " OFFSET " . ($offset ?: 0);
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        if (isset($_GET['id'])) {
            $listing = $stmt->fetch();

            if (!$listing) {
                sendResponse(404, 'error', 'Listing not found.');
            }

            sendResponse(
                200,
                'success',
                'Listing retrieved.',
                $listing
            );
        }

        sendResponse(
            200,
            'success',
            'Marketplace listings retrieved.',
            $stmt->fetchAll()
        );
    }

    // =====================================
    // CHECK AUTHENTICATION
    // =====================================

    $user = requireLogin($pdo);

    if ($user['role'] !== 'farmer') {
        sendResponse(403, 'error', 'Farmer access only.');
    }

    $sellerId = (int) $user['user_id'];

    requireCsrf();

    // =====================================
    // DELETE - REMOVE A LISTING
    // =====================================

    if ($method === 'DELETE') {

        $listingId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$listingId) {
            sendResponse(422, 'error', 'Valid listing ID required.');
        }

        // Avoid deleting a listing that has images.
        // Image files need separate cleanup.
        $stmt = $pdo->prepare(
            "SELECT COUNT(*)
             FROM listing_images
             WHERE listing_id = ?
             AND listing_id IN (
                 SELECT listing_id
                 FROM marketplace_listings
                 WHERE seller_id = ?
             )"
        );

        $stmt->execute([$listingId, $sellerId]);

        if ((int) $stmt->fetchColumn() > 0) {
            sendResponse(
                409,
                'error',
                'Remove listing images before deleting this listing.'
            );
        }

        $stmt = $pdo->prepare(
            "DELETE FROM marketplace_listings
             WHERE listing_id = ? AND seller_id = ?"
        );

        $stmt->execute([$listingId, $sellerId]);

        if ($stmt->rowCount() === 0) {
            sendResponse(404, 'error', 'Listing not found.');
        }

        sendResponse(
            200,
            'success',
            'Listing deleted successfully.'
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

    $title = $data['listing_title'] ?? '';
    $pigType = $data['pig_type'] ?? '';
    $breed = $data['breed'] ?? '';
    $sex = $data['sex'] ?? '';
    $age = $data['age_months'] ?? null;
    $weight = $data['estimated_weight'] ?? null;
    $price = $data['asking_price'] ?? null;
    $description = $data['description'] ?? '';
    $municipality = $data['municipality'] ?? '';
    $barangay = $data['barangay'] ?? '';
    $pigId = $data['pig_id'] ?? null;

    // Check text fields
    foreach (
        [$title, $pigType, $breed, $sex,
         $description, $municipality, $barangay]
        as $value
    ) {
        if (!is_string($value)) {
            sendResponse(422, 'error', 'Invalid text field.');
        }
    }

    $title = trim($title);
    $pigType = trim($pigType);
    $breed = trim($breed);
    $description = trim($description);
    $municipality = trim($municipality);
    $barangay = trim($barangay);

    if (
        $title === '' ||
        $pigType === '' ||
        $breed === '' ||
        $municipality === '' ||
        !in_array($sex, ['male', 'female'], true)
    ) {
        sendResponse(
            422,
            'error',
            'Please complete all required listing fields.'
        );
    }

    if (
        strlen($title) > 150 ||
        strlen($pigType) > 100 ||
        strlen($breed) > 100 ||
        strlen($municipality) > 100 ||
        strlen($barangay) > 100
    ) {
        sendResponse(422, 'error', 'A field is too long.');
    }

    // Validate asking price
    if (
        !is_numeric($price) ||
        !is_finite((float) $price) ||
        $price <= 0 ||
        $price > 9999999999.99
    ) {
        sendResponse(422, 'error', 'Invalid asking price.');
    }

    // Validate optional age
    if ($age === '') {
        $age = null;
    }

    if (
        $age !== null &&
        (
            !is_numeric($age) ||
            !is_finite((float) $age) ||
            $age < 0 ||
            $age > 999.99
        )
    ) {
        sendResponse(422, 'error', 'Invalid pig age.');
    }

    // Validate optional weight
    if ($weight === '') {
        $weight = null;
    }

    if (
        $weight !== null &&
        (
            !is_numeric($weight) ||
            !is_finite((float) $weight) ||
            $weight <= 0 ||
            $weight > 999999.99
        )
    ) {
        sendResponse(422, 'error', 'Invalid weight estimate.');
    }

    // Verify ownership of an optional linked pig
    if ($pigId === '') {
        $pigId = null;
    }

    if ($pigId !== null) {

        $pigId = filter_var(
            $pigId,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$pigId) {
            sendResponse(422, 'error', 'Invalid pig ID.');
        }

        $stmt = $pdo->prepare(
            "SELECT pig_id, pig_status, breed, sex
             FROM pigs
             WHERE pig_id = ? AND owner_id = ?"
        );

        $stmt->execute([$pigId, $sellerId]);
        $pig = $stmt->fetch();

        if (!$pig) {
            sendResponse(404, 'error', 'Linked pig not found.');
        }

        if ($pig['pig_status'] !== 'active') {
            sendResponse(
                409,
                'error',
                'Only active pigs can be listed for sale.'
            );
        }

        if ($pig['breed'] !== $breed || $pig['sex'] !== $sex) {
            sendResponse(
                422,
                'error',
                'Listing breed and sex must match the linked pig.'
            );
        }
    }

    // =====================================
    // POST - CREATE A LISTING
    // =====================================

    if ($method === 'POST') {

        $stmt = $pdo->prepare(
            "INSERT INTO marketplace_listings (
                seller_id,
                pig_id,
                listing_title,
                pig_type,
                breed,
                sex,
                age_months,
                estimated_weight,
                asking_price,
                description,
                municipality,
                barangay,
                listing_status
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active'
            )"
        );

        $stmt->execute([
            $sellerId,
            $pigId,
            $title,
            $pigType,
            $breed,
            $sex,
            $age,
            $weight,
            $price,
            $description ?: null,
            $municipality,
            $barangay ?: null
        ]);

        sendResponse(
            201,
            'success',
            'Marketplace listing created successfully.',
            ['listing_id' => (int) $pdo->lastInsertId()]
        );
    }

    // =====================================
    // PUT - UPDATE A LISTING
    // =====================================

    if ($method === 'PUT') {

        $listingId = filter_var(
            $_GET['id'] ?? null,
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]
        );

        if (!$listingId) {
            sendResponse(422, 'error', 'Valid listing ID required.');
        }

        $stmt = $pdo->prepare(
            "SELECT listing_id
             FROM marketplace_listings
             WHERE listing_id = ? AND seller_id = ?"
        );

        $stmt->execute([$listingId, $sellerId]);

        if (!$stmt->fetch()) {
            sendResponse(404, 'error', 'Listing not found.');
        }

        $status = $data['listing_status'] ?? 'active';

        if (
            !in_array(
                $status,
                ['active', 'sold', 'inactive'],
                true
            )
        ) {
            sendResponse(422, 'error', 'Invalid listing status.');
        }

        $stmt = $pdo->prepare(
            "UPDATE marketplace_listings
             SET pig_id = ?,
                 listing_title = ?,
                 pig_type = ?,
                 breed = ?,
                 sex = ?,
                 age_months = ?,
                 estimated_weight = ?,
                 asking_price = ?,
                 description = ?,
                 municipality = ?,
                 barangay = ?,
                 listing_status = ?
             WHERE listing_id = ? AND seller_id = ?"
        );

        $stmt->execute([
            $pigId,
            $title,
            $pigType,
            $breed,
            $sex,
            $age,
            $weight,
            $price,
            $description ?: null,
            $municipality,
            $barangay ?: null,
            $status,
            $listingId,
            $sellerId
        ]);

        sendResponse(
            200,
            'success',
            'Listing updated successfully.'
        );
    }

} catch (PDOException $e) {

    error_log($e->getMessage());

    if ($e->getCode() === '23000') {
        sendResponse(
            409,
            'error',
            'Listing conflicts with an existing record.'
        );
    }

    sendResponse(500, 'error', 'Database operation failed.');

} catch (Throwable $e) {

    error_log($e->getMessage());

    sendResponse(
        500,
        'error',
        'Unable to process marketplace request.'
    );
}
