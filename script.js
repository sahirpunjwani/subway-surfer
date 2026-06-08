// Game Core States
const LANES = [-3, 0, 3];
let currentLane = 1;
let gameState = "INTRO"; 
let score = 0;
let gameSpeed = 0.55;

// Three.js Core Setup Variables
let scene, camera, renderer;
let player, playerBox;
let tracks = [];
let obstacles = [];
let coins = [];
let powerups = [];

// Procedural Mesh Component Trackers
let leftLeg, rightLeg, leftArm, rightArm;

// Player Physics Configurations
let isJumping = false;
let isCrouching = false;
let yVelocity = 0;
let crouchTimer = 0;
const GRAVITY = -0.016;
const JUMP_FORCE = 0.38;

let activePowerup = null;
let powerupTimer = 0;
let lastFrameTime = Date.now();

const PLAYER_STAND_HEIGHT = 1.8;
const PLAYER_CROUCH_HEIGHT = 0.7; 
let currentCollisionHeight = PLAYER_STAND_HEIGHT;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06040a);
    scene.fog = new THREE.FogExp2(0x06040a, 0.01);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5.5, 8.5);
    camera.lookAt(0, 1.8, -4);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas').appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
    mainLight.position.set(10, 30, 15);
    mainLight.castShadow = true;
    scene.add(mainLight);

    buildProceduralMecha();
    buildEnvironment();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onWindowResize);
    
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    if (startBtn) startBtn.addEventListener('click', startGame);
    if (restartBtn) restartBtn.addEventListener('click', resetGame);

    animate();
}

function buildProceduralMecha() {
    player = new THREE.Group();
    player.position.set(LANES[currentLane], 0, 0);
    scene.add(player);

    playerBox = new THREE.Box3();

    // Visual Mesh Core Assembly Wrapper
    const mechaMain = new THREE.Group();
    mechaMain.name = "visualMesh";

    const ironMat = new THREE.MeshStandardMaterial({ color: 0x22252c, roughness: 0.3, metalness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.1, metalness: 0.5 });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

    // Torso Chassis
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), ironMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    mechaMain.add(torso);

    // Light Visor Helmet
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), chromeMat);
    head.position.y = 1.65;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.1), neonCyan);
    visor.position.set(0, 1.7, 0.2);
    mechaMain.add(head, visor);

    // Joint Limbs Setup for active run swing calculations
    const limbGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.6);
    limbGeo.translate(0, -0.3, 0);

    leftArm = new THREE.Mesh(limbGeo, ironMat); leftArm.position.set(-0.48, 1.4, 0);
    rightArm = new THREE.Mesh(limbGeo, ironMat); rightArm.position.set(0.48, 1.4, 0);
    leftLeg = new THREE.Mesh(limbGeo, chromeMat); leftLeg.position.set(-0.22, 0.7, 0);
    rightLeg = new THREE.Mesh(limbGeo, chromeMat); rightLeg.position.set(0.22, 0.7, 0);

    mechaMain.add(leftArm, rightArm, leftLeg, rightLeg);
    player.add(mechaMain);
}

function buildEnvironment() {
    for (let i = 0; i < 4; i++) {
        spawnTrack(i * -50);
    }
}

function spawnTrack(zPos) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 51), new THREE.MeshStandardMaterial({ color: 0x0a0914, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, zPos);
    floor.receiveShadow = true;
    scene.add(floor);
    tracks.push(floor);

    LANES.forEach(lane => {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 51), new THREE.MeshBasicMaterial({ color: 0x221a3a }));
        line.rotation.x = -Math.PI / 2;
        line.position.set(lane, 0.01, zPos);
        scene.add(line);
        tracks.push(line);
    });
}

let spawnTimer = 0;
function manageSpawning() {
    spawnTimer++;
    if (spawnTimer % 45 === 0) {
        const laneIdx = Math.floor(Math.random() * 3);
        const targetLane = LANES[laneIdx];
        const spawnZ = -180;
        const roll = Math.random();

        if (roll < 0.28) {
            const trainGroup = new THREE.Group();
            trainGroup.position.set(targetLane, 1.8, spawnZ);
            
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.6, 20), new THREE.MeshStandardMaterial({ color: 0x1a3a5f, metalness: 0.7, roughness: 0.3 }));
            body.castShadow = true;
            trainGroup.add(body);

            const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 4.5), new THREE.MeshStandardMaterial({ color: 0x0f2238 }));
            ramp.position.set(0, -1.75, 12);
            ramp.rotation.x = 0.42;
            trainGroup.add(ramp);

            trainGroup.userData = { box: new THREE.Box3(), type: 'train', extraSpeed: 0.25 };
            scene.add(trainGroup);
            obstacles.push(trainGroup);

        } else if (roll >= 0.28 && roll < 0.55) {
            const barrierRoll = Math.random();
            let barrierMesh, bType;

            if (barrierRoll < 0.33) {
                barrierMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.2, 0.4), new THREE.MeshStandardMaterial({ color: 0xe94560 }));
                barrierMesh.position.set(targetLane, 2.1, spawnZ);
                bType = 'barrier_jump_only';
            } else if (barrierRoll < 0.66) {
                barrierMesh = new THREE.Group();
                const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: 0xfcaf45 }));
                beam.position.y = 2.0; 
                const support = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3), new THREE.MeshStandardMaterial({color: 0x1a1a2e}));
                support.position.set(-1.2, 1.5, 0);
                const supportR = support.clone(); supportR.position.x = 1.2;
                barrierMesh.add(beam, support, supportR);
                barrierMesh.position.set(targetLane, 0, spawnZ);
                bType = 'barrier_crouch_only';
            } else {
                barrierMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4), new THREE.MeshStandardMaterial({ color: 0xff7e67 }));
                barrierMesh.rotation.z = Math.PI / 2;
                barrierMesh.position.set(targetLane, 0.8, spawnZ);
                bType = 'barrier_both';
            }

            barrierMesh.userData = { box: new THREE.Box3(), type: bType, extraSpeed: 0 };
            scene.add(barrierMesh);
            obstacles.push(barrierMesh);

        } else if (roll >= 0.55 && roll < 0.64) {
            const pType = Math.random() > 0.5 ? 'JETPACK' : 'MAGNET';
            const color = pType === 'JETPACK' ? 0x00fff5 : 0xff007f;
            const geo = pType === 'JETPACK' ? new THREE.OctahedronGeometry(0.4) : new THREE.SphereGeometry(0.3, 16, 16);
            const pMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, emissive: color, roughness: 0.2 }));
            
            pMesh.position.set(targetLane, 1.3, spawnZ);
            pMesh.userData = { box: new THREE.Box3(), type: pType };
            scene.add(pMesh);
            powerups.push(pMesh);

        } else {
            const count = activePowerup === 'JETPACK' ? 1 : 3;
            const height = activePowerup === 'JETPACK' ? 7.2 : 1.1;
            
            for (let k = 0; k < count; k++) {
                const coin = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.32, 0.32, 0.1, 8),
                    new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x003322 })
                );
                coin.rotation.x = Math.PI / 2;
                coin.position.set(targetLane, height, spawnZ - (k * 3.5));
                coin.userData = { box: new THREE.Box3(), type: 'coin' };
                scene.add(coin);
                coins.push(coin);
            }
        }
    }
}

function handleKeyDown(event) {
    if (gameState !== "PLAYING") return;

    if (event.key === 'ArrowLeft' && currentLane > 0) currentLane--;
    if (event.key === 'ArrowRight' && currentLane < 2) currentLane++;
    
    if ((event.key === 'ArrowUp' || event.key === ' ') && !isJumping && !isCrouching && activePowerup !== 'JETPACK') {
        isJumping = true;
        yVelocity = JUMP_FORCE;
    }
    if (event.key === 'ArrowDown' && !isJumping && activePowerup !== 'JETPACK') {
        triggerModelSlide();
    }
}

function triggerModelSlide() {
    isCrouching = true;
    crouchTimer = 25; 
    currentCollisionHeight = PLAYER_CROUCH_HEIGHT;
    
    const visualMesh = player.getObjectByName("visualMesh");
    if (visualMesh) {
        visualMesh.scale.y = 0.45; // Clean visual scale squash
        visualMesh.position.y = 0.25; // Anchor base cleanly over road beds
    }
}

function resetModelSlide() {
    isCrouching = false;
    currentCollisionHeight = PLAYER_STAND_HEIGHT;
    
    const visualMesh = player.getObjectByName("visualMesh");
    if (visualMesh) {
        visualMesh.scale.y = 1.0; 
        visualMesh.position.y = 0;
    }
}

function animate() {
    requestAnimationFrame(animate);

    const now = Date.now();
    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    const runTime = now * 0.009;

    if (gameState === "PLAYING") {
        if (player) player.position.x += (LANES[currentLane] - player.position.x) * 0.24;

        // Procedural Running Leg Swing animation vector formulas
        if (!isJumping && !isCrouching && activePowerup !== 'JETPACK') {
            leftLeg.rotation.x = Math.sin(runTime) * 0.75;
            rightLeg.rotation.x = -Math.sin(runTime) * 0.75;
            leftArm.rotation.x = -Math.sin(runTime) * 0.5;
            rightArm.rotation.x = Math.sin(runTime) * 0.5;
        } else if (isJumping || activePowerup === 'JETPACK') {
            leftLeg.rotation.x = -0.2; rightLeg.rotation.x = 0.2;
            leftArm.rotation.x = 0.4; rightArm.rotation.x = -0.4;
        } else if (isCrouching) {
            leftLeg.rotation.x = -1.1; rightLeg.rotation.x = -1.1;
            leftArm.rotation.x = -0.8; rightArm.rotation.x = -0.8;
        }

        if (isCrouching) {
            crouchTimer--;
            if (crouchTimer <= 0) resetModelSlide();
        }

        if (activePowerup) {
            powerupTimer -= delta;
            const timerEl = document.getElementById('powerup-time');
            if (timerEl) timerEl.innerText = Math.max(0, Math.ceil(powerupTimer));
            if (powerupTimer <= 0) {
                activePowerup = null;
                document.getElementById('powerup-status').classList.add('hidden');
            }
        }

        let groundFloorHeight = 0;

        if (activePowerup === 'JETPACK') {
            groundFloorHeight = 6.6;
        } else {
            obstacles.forEach(obs => {
                if (obs.userData.type === 'train') {
                    if (player && Math.abs(player.position.x - obs.position.x) < 0.8) {
                        if (player.position.z < obs.position.z + 11 && player.position.z > obs.position.z - 11) {
                            if (player.position.y >= 3.2) groundFloorHeight = 3.6;
                        }
                    }
                }
            });
        }

        if (player) {
            if (isJumping || player.position.y > groundFloorHeight) {
                player.position.y += yVelocity;
                yVelocity += GRAVITY;

                if (player.position.y <= groundFloorHeight) {
                    player.position.y = groundFloorHeight;
                    isJumping = false;
                    yVelocity = 0;
                }
            } else if (!isCrouching) {
                player.position.y += (groundFloorHeight - player.position.y) * 0.24;
            }
        }

        tracks.forEach(track => {
            track.position.z += gameSpeed;
            if (track.position.z > 50) track.position.z -= 200;
        });

        if (player && playerBox) {
            playerBox.min.set(player.position.x - 0.45, player.position.y, player.position.z - 0.4);
            playerBox.max.set(player.position.x + 0.45, player.position.y + currentCollisionHeight, player.position.z + 0.4);
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            obs.position.z += (gameSpeed + (obs.userData.extraSpeed || 0));
            obs.userData.box.setFromObject(obs);

            if (playerBox && playerBox.intersectsBox(obs.userData.box)) {
                if (activePowerup === 'JETPACK') continue;
                if (obs.userData.type === 'barrier_crouch_only' && isCrouching) continue;
                if (obs.userData.type === 'barrier_both' && (isCrouching || isJumping)) continue;
                if (player && obs.userData.type === 'train' && player.position.y >= 3.5) continue;

                endGame();
            }

            if (obs.position.z > 15) {
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
        }

        for (let i = powerups.length - 1; i >= 0; i--) {
            let pu = powerups[i];
            pu.position.z += gameSpeed;
            pu.rotation.y += 0.05;
            pu.userData.box.setFromObject(pu);

            if (playerBox && playerBox.intersectsBox(pu.userData.box)) {
                activePowerup = pu.userData.type;
                powerupTimer = activePowerup === 'JETPACK' ? 5.0 : 8.0;
                document.getElementById('powerup-name').innerText = activePowerup;
                document.getElementById('powerup-status').classList.remove('hidden');
                scene.remove(pu);
                powerups.splice(i, 1);
                continue;
            }
            if (pu.position.z > 15) {
                scene.remove(pu);
                powerups.splice(i, 1);
            }
        }

        for (let i = coins.length - 1; i >= 0; i--) {
            let coin = coins[i];
            coin.rotation.z += 0.05;

            if (activePowerup === 'MAGNET' && coin.position.z > -45) {
                if (player) {
                    coin.position.x += (player.position.x - coin.position.x) * 0.25;
                    coin.position.y += (player.position.y + 1.0 - coin.position.y) * 0.25;
                    coin.position.z += (player.position.z - coin.position.z) * 0.25;
                }
            } else {
                coin.position.z += gameSpeed;
            }

            coin.userData.box.setFromObject(coin);

            if (playerBox && playerBox.intersectsBox(coin.userData.box)) {
                score += 20;
                document.getElementById('score').innerText = score;
                scene.remove(coin);
                coins.splice(i, 1);
                continue;
            }
            if (coin.position.z > 15) {
                scene.remove(coin);
                coins.splice(i, 1);
            }
        }

        manageSpawning();
        gameSpeed += 0.00006;
    }

    renderer.render(scene, camera);
}

function startGame() {
    document.getElementById('intro-screen').classList.add('hidden');
    document.getElementById('hud-panel').classList.remove('hidden');
    gameState = "PLAYING";
}

function endGame() {
    gameState = "GAMEOVER";
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function resetGame() {
    obstacles.forEach(o => scene.remove(o));
    coins.forEach(c => scene.remove(c));
    powerups.forEach(p => scene.remove(p));
    
    obstacles = []; 
    coins = []; 
    powerups = [];
    
    score = 0; 
    gameSpeed = 0.55; 
    currentLane = 1;
    activePowerup = null; 
    powerupTimer = 0;
    isJumping = false;
    
    if (player) player.position.set(LANES[currentLane], 0, 0);
    resetModelSlide();

    document.getElementById('score').innerText = score;
    document.getElementById('powerup-status').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    
    gameState = "PLAYING";
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('DOMContentLoaded', () => {
    init();
});
