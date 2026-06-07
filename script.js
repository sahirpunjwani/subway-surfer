// Game Core States
const LANES = [-3, 0, 3];
let currentLane = 1;
let gameState = "INTRO"; // "INTRO", "PLAYING", "GAMEOVER"
let score = 0;
let gameSpeed = 0.55;

// Three.js Framework Variables
let scene, camera, renderer;
let player, playerBox;
let tracks = [];
let obstacles = [];
let coins = [];
let powerups = [];

// Joint References for True Articulated Animations
let bodyTorso, bodyHead, leftThigh, rightThigh, leftShin, rightShin, leftArm, rightArm, thrusterFire;

// Movement States
let isJumping = false;
let isCrouching = false;
let yVelocity = 0;
let crouchTimer = 0;
const GRAVITY = -0.016;
const JUMP_FORCE = 0.38;

let activePowerup = null;
let powerupTimer = 0;

// Dynamic Safe Height Calculation Variables
let currentModelHeight = 2.1;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06040a);
    scene.fog = new THREE.FogExp2(0x06040a, 0.01);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6.5, 9.5);
    camera.lookAt(0, 2.5, -4);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas').appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const shadowLight = new THREE.DirectionalLight(0x99ccff, 1.0);
    shadowLight.position.set(20, 40, 20);
    shadowLight.castShadow = true;
    scene.add(shadowLight);

    buildAdvancedMechaPlayer();
    buildEnvironment();

    // Event hooks
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onWindowResize);
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', resetGame);

    animate();
}

// Build a highly detailed, non-distorted articulated Mecha Runner
function buildAdvancedMechaPlayer() {
    player = new THREE.Group();

    // Specular Materials
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1c23, roughness: 0.4, metalness: 0.8 });
    const whitePlates = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.2, metalness: 0.4 });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const orangeJet = new THREE.MeshBasicMaterial({ color: 0xff5500 });

    // Root Anchor for Torso Assembly
    bodyTorso = new THREE.Group();
    bodyTorso.position.y = 1.1; // Baseline pivot point height

    const chestBlock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), darkMat);
    const armorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.15), whitePlates);
    armorPlate.position.set(0, 0.05, 0.22);
    chestBlock.add(armorPlate);
    bodyTorso.add(chestBlock);

    // Glowing Power Core Circle
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), neonCyan);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0.1, 0.31);
    bodyTorso.add(core);
    
    player.add(bodyTorso);

    // Head Assembly Group
    bodyHead = new THREE.Group();
    bodyHead.position.y = 0.65; // Local coordinate above the chest
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), whitePlates);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.15), darkMat);
    brow.position.set(0, 0.15, 0.15);
    const lightVisor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.05), neonCyan);
    lightVisor.position.set(0, 0.04, 0.215);
    bodyHead.add(helmet, brow, lightVisor);
    bodyTorso.add(bodyHead);

    // Arm Articulations
    const shoulderGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const limbGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.6);
    limbGeo.translate(0, -0.3, 0);

    leftArm = new THREE.Group(); leftArm.position.set(-0.5, 0.3, 0);
    const lShoulder = new THREE.Mesh(shoulderGeo, whitePlates);
    const lArmB = new THREE.Mesh(limbGeo, darkMat); leftArm.add(lShoulder, lArmB);

    rightArm = new THREE.Group(); rightArm.position.set(0.5, 0.3, 0);
    const rShoulder = new THREE.Mesh(shoulderGeo, whitePlates);
    const rArmB = new THREE.Mesh(limbGeo, darkMat); rightArm.add(rShoulder, rArmB);

    bodyTorso.add(leftArm, rightArm);

    // Jointed Legs Structure (Prevents Squashing Distortion!)
    // Thighs
    const thighGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.55);
    thighGeo.translate(0, -0.25, 0);
    leftThigh = new THREE.Group(); leftThigh.position.set(-0.24, 0.75, 0);
    const ltMesh = new THREE.Mesh(thighGeo, darkMat); leftThigh.add(ltMesh);

    rightThigh = new THREE.Group(); rightThigh.position.set(0.24, 0.75, 0);
    const rtMesh = new THREE.Mesh(thighGeo, darkMat); rightThigh.add(rtMesh);

    // Shins
    const shinGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.5);
    shinGeo.translate(0, -0.25, 0);
    leftShin = new THREE.Mesh(shinGeo, whitePlates); leftShin.position.y = -0.5;
    rightShin = new THREE.Mesh(shinGeo, whitePlates); rightShin.position.y = -0.5;

    leftThigh.add(leftShin);
    rightThigh.add(rightShin);
    player.add(leftThigh, rightThigh);

    // Backpack Booster Flame
    thrusterFire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 8), orangeJet);
    thrusterFire.rotation.x = Math.PI;
    thrusterFire.position.set(0, 0, -0.35);
    thrusterFire.visible = false;
    bodyTorso.add(thrusterFire);

    player.position.set(LANES[currentLane], 0, 0);
    scene.add(player);

    playerBox = new THREE.Box3();
}

function buildEnvironment() {
    for (let i = 0; i < 4; i++) {
        spawnTrack(i * -50);
    }
}

function spawnTrack(zPos) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 51), new THREE.MeshStandardMaterial({ color: 0x08070e, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, zPos);
    floor.receiveShadow = true;
    scene.add(floor);
    tracks.push(floor);

    LANES.forEach(lane => {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 51), new THREE.MeshBasicMaterial({ color: 0x19152b }));
        line.rotation.x = -Math.PI / 2;
        line.position.set(lane, 0.01, zPos);
        scene.add(line);
        tracks.push(line);
    });
}

// Procedural Hazard Generators
let spawnTimer = 0;
function manageSpawning() {
    spawnTimer++;
    if (spawnTimer % 45 === 0) {
        const laneIdx = Math.floor(Math.random() * 3);
        const targetLane = LANES[laneIdx];
        const spawnZ = -180;
        const roll = Math.random();

        if (roll < 0.28) {
            // 🚄 Fast Subway Train
            const trainGroup = new THREE.Group();
            trainGroup.position.set(targetLane, 1.8, spawnZ);
            
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.6, 20), new THREE.MeshStandardMaterial({ color: 0x111e38, metalness: 0.8, roughness: 0.2 }));
            body.castShadow = true;
            trainGroup.add(body);

            const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
            const lLight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), lightMat); lLight.position.set(-0.7, -1.1, 10.01);
            const rLight = lLight.clone(); rLight.position.x = 0.7;
            trainGroup.add(lLight, rLight);

            const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 4.5), new THREE.MeshStandardMaterial({ color: 0x0a1120 }));
            ramp.position.set(0, -1.75, 12);
            ramp.rotation.x = 0.42;
            trainGroup.add(ramp);

            trainGroup.userData = { box: new THREE.Box3(), type: 'train', extraSpeed: 0.26 };
            scene.add(trainGroup);
            obstacles.push(trainGroup);

        } else if (roll >= 0.28 && roll < 0.55) {
            // 🚧 The 3 Barrier Variants
            const barrierRoll = Math.random();
            let barrierMesh, bType;

            if (barrierRoll < 0.33) {
                // 1. HIGH WALL (Jump Only)
                barrierMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.2, 0.4), new THREE.MeshStandardMaterial({ color: 0xff0055, roughness: 0.3 }));
                barrierMesh.position.set(targetLane, 2.1, spawnZ);
                bType = 'barrier_jump_only';
            } else if (barrierRoll < 0.66) {
                // 2. CRAWL BARRIER (Crouch Only)
                barrierMesh = new THREE.Group();
                const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
                beam.position.y = 2.0; 
                const frameL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3), new THREE.MeshStandardMaterial({color: 0x111}));
                frameL.position.set(-1.2, 1.5, 0);
                const frameR = frameL.clone(); frameR.position.x = 1.2;
                barrierMesh.add(beam, frameL, frameR);
                barrierMesh.position.set(targetLane, 0, spawnZ);
                bType = 'barrier_crouch_only';
            } else {
                // 3. MID HURDLE (Both Methods Allowed)
                barrierMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.4), new THREE.MeshStandardMaterial({ color: 0xff7700 }));
                barrierMesh.rotation.z = Math.PI / 2;
                barrierMesh.position.set(targetLane, 0.9, spawnZ);
                bType = 'barrier_both';
            }

            barrierMesh.userData = { box: new THREE.Box3(), type: bType, extraSpeed: 0 };
            scene.add(barrierMesh);
            obstacles.push(barrierMesh);

        } else if (roll >= 0.55 && roll < 0.64) {
            // 💎 Powerups
            const pType = Math.random() > 0.5 ? 'JETPACK' : 'MAGNET';
            const color = pType === 'JETPACK' ? 0x00ffcc : 0xff00ff;
            const geo = pType === 'JETPACK' ? new THREE.OctahedronGeometry(0.4) : new THREE.SphereGeometry(0.3, 16, 16);
            const pMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, emissive: color, roughness: 0.2 }));
            
            pMesh.position.set(targetLane, 1.3, spawnZ);
            pMesh.userData = { box: new THREE.Box3(), type: pType };
            scene.add(pMesh);
            powerups.push(pMesh);

        } else {
            // 🪙 Vector Coins
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
        thrusterFire.visible = true;
    }
    if (event.key === 'ArrowDown' && !isJumping && activePowerup !== 'JETPACK') {
        triggerProceduralCrouch();
    }
}

// Articulated Crouch: Actually lowers body parts cleanly instead of flattening the model
function triggerProceduralCrouch() {
    isCrouching = true;
    crouchTimer = 22;
    currentModelHeight = PLAYER_CROUCH_HEIGHT;

    // Dynamic mechanical slide transformations
    bodyTorso.position.y = 0.55;       // Lower chest down toward tracks
    bodyHead.rotation.x = 0.35;         // Tilt head forward looking down
    leftArm.rotation.x = -Math.PI / 2;  // Swing arms backward behind back
    rightArm.rotation.x = -Math.PI / 2;
    
    // Fold knees out to support sliding stance
    leftThigh.rotation.x = -0.8;
    rightThigh.rotation.x = -0.8;
    leftThigh.position.y = 0.45;
    rightThigh.position.y = 0.45;
}

// Reset Pose Matrix to Stand/Run
function resetProceduralCrouch() {
    isCrouching = false;
    currentModelHeight = PLAYER_STAND_HEIGHT;

    bodyTorso.position.y = 1.1;
    bodyHead.rotation.x = 0;
    leftArm.rotation.x = 0;
    rightArm.rotation.x = 0;
    leftThigh.rotation.x = 0;
    rightThigh.rotation.x = 0;
    leftThigh.position.y = 0.75;
    rightThigh.position.y = 0.75;
}

// Runtime Game Clock loop
function animate() {
    requestAnimationFrame(animate);

    const time = Date.now() * 0.009;

    if (gameState === "PLAYING") {
        player.position.x += (LANES[currentLane] - player.position.x) * 0.24;

        // Locomotion Swing (only when standing/running on paths)
        if (!isJumping && !isCrouching && activePowerup !== 'JETPACK') {
            leftThigh.rotation.x = Math.sin(time) * 0.8;
            rightThigh.rotation.x = -Math.sin(time) * 0.8;
            leftShin.rotation.x = Math.max(0, Math.sin(time + 1.5)) * 0.4;
            rightShin.rotation.x = Math.max(0, -Math.sin(time + 1.5)) * 0.4;
            
            leftArm.rotation.x = -Math.sin(time) * 0.6;
            rightArm.rotation.x = Math.sin(time) * 0.6;
        }

        if (isCrouching) {
            crouchTimer--;
            if (crouchTimer <= 0) {
                resetProceduralCrouch();
            }
        }

        // Powerup Lifespan Counters
        if (activePowerup) {
            powerupTimer -= 0.016;
            document.getElementById('powerup-time').innerText = Math.max(0, Math.ceil(powerupTimer));
            if (powerupTimer <= 0) {
                activePowerup = null;
                thrusterFire.visible = false;
                document.getElementById('powerup-status').classList.add('hidden');
            }
        }

        // Vertical Gravity Calculations
        let groundFloor = 0;

        if (activePowerup === 'JETPACK') {
            groundFloor = 6.6;
            thrusterFire.visible = true;
            thrusterFire.scale.setScalar(Math.sin(time * 3) * 0.2 + 1.0);
            bodyTorso.position.y = 1.1 + Math.sin(time * 2) * 0.1; // Smooth aerial hover wobble
        } else {
            obstacles.forEach(obs => {
                if (obs.userData.type === 'train') {
                    if (Math.abs(player.position.x - obs.position.x) < 0.8) {
                        if (player.position.z < obs.position.z + 11 && player.position.z > obs.position.z - 11) {
                            if (player.position.y >= 3.2) groundFloor = 3.6;
                        }
                    }
                }
            });
        }

        if (isJumping || player.position.y > groundFloor) {
            player.position.y += yVelocity;
            yVelocity += GRAVITY;

            if (player.position.y <= groundFloor) {
                player.position.y = groundFloor;
                isJumping = false;
                yVelocity = 0;
                if (activePowerup !== 'JETPACK') thrusterFire.visible = false;
            }
        } else if (!isCrouching) {
            player.position.y += (groundFloor - player.position.y) * 0.24;
        }

        // Speed Track Environment Movement Loops
        tracks.forEach(track => {
            track.position.z += gameSpeed;
            if (track.position.z > 50) track.position.z -= 200;
        });

        // Compute Bounding Collision Space
        playerBox.min.set(player.position.x - 0.4, player.position.y, player.position.z - 0.3);
        playerBox.max.set(player.position.x + 0.4, player.position.y + currentModelHeight, player.position.z + 0.3);

        // Hazards Matrix Collision Loops
        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            obs.position.z += (gameSpeed + (obs.userData.extraSpeed || 0));
            obs.userData.box.setFromObject(obs);

            if (playerBox.intersectsBox(obs.userData.box)) {
                if (activePowerup === 'JETPACK') continue;
                if (obs.userData.type === 'barrier_crouch_only' && isCrouching) continue;
                if (obs.userData.type === 'barrier_both' && (isCrouching || isJumping)) continue;
                if (obs.userData.type === 'train' && player.position.y >= 3.5) continue;

                endGame();
            }

            if (obs.position.z > 15) {
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
        }

        // Powerup Drop Collection Loops
        for (let i = powerups.length - 1; i >= 0; i--) {
            let pu = powerups[i];
            pu.position.z += gameSpeed;
            pu.rotation.y += 0.05;
            pu.userData.box.setFromObject(pu);

            if (playerBox.intersectsBox(pu.userData.box)) {
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

        // Magnet Coins mechanics
        for (let i = coins.length - 1; i >= 0; i--) {
            let coin = coins[i];
            coin.rotation.z += 0.05;

            if (activePowerup === 'MAGNET' && coin.position.z > -45) {
                coin.position.x += (player.position.x - coin.position.x) * 0.25;
                coin.position.y += (player.position.y + 1.0 - coin.position.y) * 0.25;
                coin.position.z += (player.position.z - coin.position.z) * 0.25;
            } else {
                coin.position.z += gameSpeed;
            }

            coin.userData.box.setFromObject(coin);

            if (playerBox.intersectsBox(coin.userData.box)) {
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
    } else if (gameState === "INTRO") {
        // Idle running animation logic inside Intro screen background
        leftThigh.rotation.x = Math.sin(time * 0.8) * 0.6;
        rightThigh.rotation.x = -Math.sin(time * 0.8) * 0.6;
        leftArm.rotation.x = -Math.sin(time * 0.8) * 0.4;
        rightArm.rotation.x = Math.sin(time * 0.8) * 0.4;
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
    obstacles = []; coins = []; powerups = [];
    score = 0; gameSpeed = 0.55; currentLane = 1;
    activePowerup = null; powerupTimer = 0;
    
    player.position.set(LANES[currentLane], 0, 0);
    resetProceduralCrouch();
    isJumping = false; thrusterFire.visible = false;
    
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

init();
