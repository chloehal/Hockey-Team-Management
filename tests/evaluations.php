<?php
require __DIR__ . '/../player-evaluations.php';
class EvaluationStore {
    public $transaction = false;
    public $saved = null;
    function prepare($sql) { return new EvaluationStatement($this, $sql); }
    function beginTransaction() { $this->transaction = true; }
    function inTransaction() { return $this->transaction; }
    function rollBack() { $this->transaction = false; }
    function commit() { $this->transaction = false; }
}
class EvaluationStatement {
    function __construct(public $store, public $sql) {}
    function execute($params) {
        $this->params = $params;
        if (str_starts_with($this->sql, 'INSERT')) $this->store->saved = $params;
    }
    public $params;
    function fetchColumn() {
        return str_contains($this->sql, 'settings') ? 'secret' : ($this->params[0] === 1 ? 1 : false);
    }
}
function check($condition) { if (!$condition) throw new Exception('Assertion failed'); }
$store = new EvaluationStore();
$scores = array_fill_keys(['technique','physique','strategie','placement','esprit_equipe','puissance','precision'], 8.5);
function callEndpoint($store, $input, $method = 'POST') {
    $_SERVER['REQUEST_METHOD'] = $method;
    http_response_code(200);
    ob_start();
    handle_player_evaluations($store, 'save_player_evaluation', $input);
    return [http_response_code(), json_decode(ob_get_clean(), true)];
}
$valid = ['password' => 'secret', 'id' => 1, 'scores' => $scores];
check(callEndpoint($store, $valid, 'GET')[0] === 405);
check(callEndpoint($store, array_replace($valid, ['password' => 'wrong']))[0] === 403);
check($store->saved === null);
check(callEndpoint($store, array_replace($valid, ['id' => 99]))[0] === 404);
foreach ([-1, 11, '8', true] as $bad) {
    check(callEndpoint($store, array_replace($valid, ['scores' => array_replace($scores, ['technique' => $bad])]))[0] === 400);
}
check(callEndpoint($store, $valid)[0] === 200);
check($store->saved[0] === 'player_evaluation_1');
check(json_decode($store->saved[1], true) === $scores);
check(!$store->inTransaction());
check(normalize_player_evaluation(array_replace($scores, ['technique' => null, 'precision' => 0]))['precision'] === 0);
echo "PHP evaluation validation, authorization and storage: OK\n";
