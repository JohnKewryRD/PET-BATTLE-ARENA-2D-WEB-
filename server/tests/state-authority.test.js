const test = require('node:test');
const assert = require('node:assert/strict');
const PetBattleArenaServer = require('../index.js');

function createServerForTest() {
    const server = new PetBattleArenaServer();
    clearInterval(server.tickInterval);
    server.ensureRoom('test_room', { activate: false });
    return server;
}

function cleanupServer(server) {
    try {
        server.io.close();
    } catch (error) {
        // ignore cleanup errors in tests
    }
}

test('applyEnemyDamage updates hp and removes enemy at zero', () => {
    const server = createServerForTest();
    const room = server.ensureRoom('test_room', { activate: false });

    room.gameState.enemies.set('enemy_1', {
        id: 'enemy_1',
        hp: 100,
        maxHp: 100
    });

    const firstHit = server.applyEnemyDamage('test_room', 'enemy_1', 35, 'pet_1');
    assert.equal(firstHit, true);
    assert.equal(room.gameState.enemies.get('enemy_1').hp, 65);

    const secondHit = server.applyEnemyDamage('test_room', 'enemy_1', 80, 'pet_1');
    assert.equal(secondHit, true);
    assert.equal(room.gameState.enemies.has('enemy_1'), false);

    cleanupServer(server);
});

test('applyPetDamage updates hp and removes pet at zero', () => {
    const server = createServerForTest();
    const room = server.ensureRoom('test_room', { activate: false });

    room.gameState.pets.set('pet_1', {
        id: 'pet_1',
        hp: 90,
        maxHp: 90
    });

    const firstHit = server.applyPetDamage('test_room', 'pet_1', 30);
    assert.equal(firstHit, true);
    assert.equal(room.gameState.pets.get('pet_1').hp, 60);

    const secondHit = server.applyPetDamage('test_room', 'pet_1', 70);
    assert.equal(secondHit, true);
    assert.equal(room.gameState.pets.has('pet_1'), false);

    cleanupServer(server);
});

test('isSimulationOwner validates owner socket id', () => {
    const server = createServerForTest();
    const room = server.ensureRoom('test_room', { activate: false });

    room.simulationOwnerSocketId = 'socket_owner';
    assert.equal(server.isSimulationOwner('test_room', 'socket_owner'), true);
    assert.equal(server.isSimulationOwner('test_room', 'socket_other'), false);

    cleanupServer(server);
});
