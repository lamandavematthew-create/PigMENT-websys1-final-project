<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../database/db.php';
try {
    $user=requireAdmin($pdo);
    $exists=$pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='listing_moderation'")->fetchColumn();
    $method=$_SERVER['REQUEST_METHOD'];
    if ($method==='GET') {
        $search=$_GET['search']??'';
        $listingStatus=$_GET['status']??'';
        if (!is_string($search) || strlen(trim($search))>100) sendResponse(422,'error','Invalid search term.');
        if (!in_array($listingStatus,['','active','sold','inactive'],true)) sendResponse(422,'error','Invalid listing status.');
        $search=trim($search);
        $sql="SELECT m.listing_id,m.listing_title,m.pig_type,m.asking_price,m.municipality,m.listing_status,m.created_at,u.first_name,u.last_name,u.email,u.account_status AS seller_account_status";
        $sql.=$exists?",COALESCE(lm.is_hidden,0) AS is_hidden,lm.reason AS moderation_reason":" ,0 AS is_hidden,NULL AS moderation_reason";
        $sql.=" FROM marketplace_listings m INNER JOIN users u ON u.user_id=m.seller_id";
        if ($exists) $sql.=" LEFT JOIN listing_moderation lm ON lm.listing_id=m.listing_id";
        $sql.=" WHERE (m.listing_title LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR CONCAT_WS(' ',u.first_name,u.last_name) LIKE ? OR u.email LIKE ?)";
        $term='%'.$search.'%';
        $params=[$term,$term,$term,$term,$term];
        if ($listingStatus!=='') { $sql.=" AND m.listing_status = ?"; $params[]=$listingStatus; }
        $sql.=" ORDER BY m.created_at DESC, m.listing_id DESC LIMIT 200";
        $stmt=$pdo->prepare($sql);
        $stmt->execute($params);
        sendResponse(200,'success','Marketplace listings retrieved.',['listings'=>$stmt->fetchAll(PDO::FETCH_ASSOC),'moderation_ready'=>(bool)$exists]);
    }
    if ($method!=='PATCH') {header('Allow: GET, PATCH');sendResponse(405,'error','Method not allowed.');}
    requireCsrf();
    if (!$exists) sendResponse(409,'error','Marketplace moderation requires the optional database migration. No changes have been made.');
    $data=json_decode(file_get_contents('php://input'),true);
    if (!is_array($data)) sendResponse(400,'error','Invalid JSON request.');
    $id=filter_var($data['listing_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    $hidden=$data['is_hidden']??null;
    $reason=trim((string)($data['reason']??''));
    if (!$id || !is_bool($hidden) || strlen($reason)>500 || ($hidden && strlen($reason)<5)) sendResponse(422,'error','Provide a valid listing, action, and reason (at least five characters when hiding).');
    $check=$pdo->prepare('SELECT listing_id FROM marketplace_listings WHERE listing_id=?');$check->execute([$id]);
    if (!$check->fetch()) sendResponse(404,'error','Listing not found.');
    $stmt=$pdo->prepare('INSERT INTO listing_moderation (listing_id,is_hidden,reason,moderated_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE is_hidden=VALUES(is_hidden),reason=VALUES(reason),moderated_by=VALUES(moderated_by),updated_at=CURRENT_TIMESTAMP');
    $stmt->execute([$id,(int)$hidden,$reason ?: null,(int)$user['user_id']]);
    sendResponse(200,'success',$hidden?'Listing hidden from public browsing.':'Listing moderation restriction cleared.');
} catch(Throwable $e) {error_log($e->getMessage());sendResponse(500,'error','Unable to manage marketplace listings.');}
