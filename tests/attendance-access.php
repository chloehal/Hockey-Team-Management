<?php
// Exercise the actual API switch against an isolated SQLite database.
// Only the config and HTTP input transport are replaced; no production DB access.
$root = dirname(__DIR__);
$temp = sys_get_temp_dir() . '/pantheres-access-' . bin2hex(random_bytes(6));
mkdir($temp);
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('PRAGMA foreign_keys = ON');
$pdo->exec('CREATE TABLE settings (`key` TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE players (id INTEGER PRIMARY KEY);
CREATE TABLE trainings (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT UNIQUE NOT NULL);
CREATE TABLE training_presences (training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE, player_id INTEGER REFERENCES players(id) ON DELETE CASCADE, PRIMARY KEY(training_id, player_id));
INSERT INTO players VALUES (1), (2);
INSERT INTO settings VALUES ("coach_password", "test-secret");');
file_put_contents($temp . '/config.php', '<?php');
copy($root . '/coach-auth.php', $temp . '/coach-auth.php');
file_put_contents($temp . '/api.php', str_replace("file_get_contents('php://input')", '$GLOBALS["testBody"]', file_get_contents($root . '/api.php')));
function callAttendance($action, $input, $method = 'POST') {
    global $pdo, $temp;
    $_GET['action'] = $action;
    $_SERVER['REQUEST_METHOD'] = $method;
    $GLOBALS['testBody'] = json_encode($input);
    http_response_code(200);
    ob_start();
    include $temp . '/api.php';
    return [http_response_code(), json_decode(ob_get_clean(), true)];
}
function checkAttendance($condition, $message) { if (!$condition) throw new Exception($message); }
function ids() { global $pdo; return $pdo->query('SELECT player_id FROM training_presences ORDER BY player_id')->fetchAll(PDO::FETCH_COLUMN); }
try {
    $input = ['date' => '2026-09-27', 'presentIds' => [1]];
    checkAttendance(callAttendance('save_training', $input)[0] === 200, 'Public creation');
    foreach ([null, '', 'wrong', ['test-secret']] as $password) {
        $update = array_replace($input, ['presentIds' => [2], 'password' => $password]);
        checkAttendance(callAttendance('save_training', $update)[0] === 403, 'Reject unauthorized update');
        checkAttendance(ids() === [1], 'No attendance changed');
        checkAttendance(callAttendance('delete_training', ['id' => 1, 'password' => $password])[0] === 403, 'Reject unauthorized deletion');
        checkAttendance(callAttendance('delete_player', ['id' => 1, 'password' => $password])[0] === 403, 'Reject indirect attendance deletion');
    }
    checkAttendance(callAttendance('save_training', array_replace($input, ['date' => '2026-9-27']))[0] === 400, 'Reject alternate date encoding');
    checkAttendance(callAttendance('save_training', array_replace($input, ['date' => '2026-02-30']))[0] === 400, 'Reject invalid dates');
    checkAttendance(callAttendance('save_training', $input, 'GET')[0] === 405, 'Reject GET');
    checkAttendance(callAttendance('delete_training', ['id' => 1], 'GET')[0] === 405, 'Reject GET delete');
    checkAttendance(callAttendance('save_training', array_replace($input, ['presentIds' => [2], 'password' => 'test-secret']))[0] === 200, 'Coach update');
    checkAttendance(ids() === [2], 'Coach changes applied');
    $pdo->exec('DELETE FROM settings');
    checkAttendance(callAttendance('delete_training', ['id' => 1, 'password' => '111'])[0] === 403, 'No fallback password grants access');
    $pdo->exec('INSERT INTO settings VALUES ("coach_password", "new-secret")');
    checkAttendance(callAttendance('delete_training', ['id' => 1, 'password' => 'test-secret'])[0] === 403, 'Old credential rejected after rotation');
    checkAttendance(callAttendance('delete_training', ['id' => 1, 'password' => 'new-secret'])[0] === 200, 'Coach deletion');
    checkAttendance(ids() === [], 'Deletion applied');
    $pdo->exec('DROP TABLE settings');
    checkAttendance(callAttendance('delete_player', ['id' => 1, 'password' => '111'])[0] === 503, 'Database failure denies access');
    echo "Attendance API: public creation, coach-only updates/deletions, invalid credentials and fail-closed checks passed.\n";
} finally {
    foreach (glob($temp . '/*') as $path) unlink($path);
    rmdir($temp);
}
