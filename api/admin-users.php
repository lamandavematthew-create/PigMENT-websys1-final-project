<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';
try {
    $admin=requireAdmin($pdo);
    $method=$_SERVER['REQUEST_METHOD'];
    if ($method==='GET') {
        $search=trim((string)($_GET['search']??''));
        if (strlen($search)>100) sendResponse(422,'error','Search term too long.');
        $stmt=$pdo->prepare("SELECT user_id,first_name,last_name,email,municipality,account_status FROM users WHERE role='farmer' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?) ORDER BY user_id DESC LIMIT 200");
        $term='%'.$search.'%'; $stmt->execute([$term,$term,$term]);
        sendResponse(200,'success','Farmer accounts retrieved.',$stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    if ($method!=='PATCH') {header('Allow: GET, PATCH');sendResponse(405,'error','Method not allowed.');}
    requireCsrf();
    $data=json_decode(file_get_contents('php://input'),true);
    if (!is_array($data)) sendResponse(400,'error','Invalid JSON request.');
    $id=filter_var($data['user_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    $status=$data['account_status']??null;
    if (!$id || !in_array($status,['active','suspended'],true)) sendResponse(422,'error','Invalid account or status.');
    if ($id===(int)$admin['user_id']) sendResponse(403,'error','Cannot modify your own account.');
    // Respect the database's existing ENUM choices; never alter the account schema silently.
    $column=$pdo->query("SHOW COLUMNS FROM users LIKE 'account_status'")->fetch(PDO::FETCH_ASSOC);
    if (!$column) sendResponse(409,'error','Account status column not found.');
    $type=strtolower($column['Type']);
    if (str_starts_with($type,'enum(') && !str_contains($type,"'".$status."'")) {
        sendResponse(409,'error','This account status is not supported by your current users table. Team-approved schema migration is required.');
    }

    $stmt=$pdo->prepare("UPDATE users SET account_status=? WHERE user_id=? AND role='farmer'");
    $stmt->execute([$status,$id]);
    if (!$stmt->rowCount()) {
        $check=$pdo->prepare("SELECT account_status FROM users WHERE user_id=? AND role='farmer'");$check->execute([$id]);
        if (!$check->fetch()) sendResponse(404,'error','Farmer account not found.');
    }
    sendResponse(200,'success','Farmer account status updated.');
} catch(Throwable $e) {error_log($e->getMessage());sendResponse(500,'error','Unable to manage farmer accounts.');}
