<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/db.php';

$method  = $_SERVER['REQUEST_METHOD'];
$type    = $_GET['type'] ?? 'history';
$user_id = (int)($_GET['user_id'] ?? 0);

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'User ID diperlukan']);
    exit;
}

$db     = getDB();
$table  = $type === 'saved' ? 'analysis_saved' : 'analysis_history';
$tcol   = $type === 'saved' ? 'saved_at' : 'created_at';

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT * FROM {$table} WHERE user_id=:uid ORDER BY {$tcol} DESC LIMIT 100");
    $stmt->execute([':uid'=>$user_id]);
    echo json_encode(['success'=>true,'data'=>$stmt->fetchAll()]);

} elseif ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if ($type === 'history') {
        $stmt = $db->prepare("INSERT INTO analysis_history (user_id,ticker,verdict,score,market,name) VALUES (:uid,:ticker,:verdict,:score,:market,:name)");
        $stmt->execute([':uid'=>$user_id,':ticker'=>$body['ticker']??'',':verdict'=>$body['verdict']??'',':score'=>$body['score']??50,':market'=>$body['market']??'idx',':name'=>$body['name']??'']);
    } else {
        $stmt = $db->prepare("INSERT INTO analysis_saved (user_id,ticker,verdict,score,summary,target,stop_loss,market,name) VALUES (:uid,:ticker,:verdict,:score,:summary,:target,:stop_loss,:market,:name)");
        $stmt->execute([':uid'=>$user_id,':ticker'=>$body['ticker']??'',':verdict'=>$body['verdict']??'',':score'=>$body['score']??50,':summary'=>$body['summary']??'',':target'=>$body['target']??'',':stop_loss'=>$body['stop_loss']??'',':market'=>$body['market']??'idx',':name'=>$body['name']??'']);
    }
    echo json_encode(['success'=>true,'id'=>(int)$db->lastInsertId()]);

} elseif ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id) {
        $stmt = $db->prepare("DELETE FROM {$table} WHERE id=:id AND user_id=:uid");
        $stmt->execute([':id'=>$id,':uid'=>$user_id]);
    } else {
        $stmt = $db->prepare("DELETE FROM {$table} WHERE user_id=:uid");
        $stmt->execute([':uid'=>$user_id]);
    }
    echo json_encode(['success'=>true]);
}
