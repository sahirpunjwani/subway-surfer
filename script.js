// Game State Configuration
const LANES = [-3, 0, 3];
let currentLane = 1;
let gameActive = true;
let score = 0;
let gameSpeed = 0.55;

// Three.js Scene Variables
let scene, camera, renderer;
let player, playerBox;
let tracks = [];
let obstacles = [];
let coins = [];
let powerups = [];

// Player Mechanical Movement Handles
let leftLeg, rightLeg, leftArm, rightArm, thrusterFire;
let isJumping = false;
let isCrouching = false;
let yVelocity = 0;
let crouchTimer = 0;
const GRAVITY = -0.016;
const JUMP_FORCE = 0.38;

// Powerup Variables
let activePowerup = null; // 'MAGNET' or 'JETPACK'
let powerupTimer = 0;

// Collision Constants
const PLAYER_STAND_HEIGHT = 2.1;
const PLAYER_CROUCH_HEIGHT = 0.7;

function init() {
    // Scene setup with synthwave horizon fog
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040208);
    scene.fog = new THREE.FogExp2(0x040208, 0.01);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6.5, 9.5);
    camera.lookAt(0, 2.5, -4);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas').appendChild(renderer.domElement);

    // Dynamic Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const mainLight = new THREE.DirectionalLight(0x88bbff, 1.0);
    mainLight.position.set(20, 40, 20);
    mainLight.castShadow = true;
    scene.add(mainLight);

    buildCyberPlayer();
    buildEnvironment();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onWindowResize);
    document.getElementById('restart-btn').addEventListener('click', resetGame);

    animate();
}

// Procedural Mecha Robot Assembly 
function buildCyberPlayer() {
    player = new THREE.Group();

    // High-tech materials
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f222a, roughness: 0.3, metalness: 0.8 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.2, metalness: 0.7 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const boostMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });

    // Torso Frame
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.6), bodyMat);
    torso.position.y = 1.3;
    // Core Plate armor
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.2), armorMat);
    chestPlate.position.set(0, 0.1, 0.25);
    torso.add(chestPlate);
    player.add(torso);

    // Sleek Visor Helmet Head
    const headGroup = new THREE.Group();
    headGroup.position.y = 2.1;
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), armorMat);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.1), neonMat);
    visor.position.set(0, 0.05, 0.22);
    headGroup.add(helmet, visor);
    player.add(headGroup);

    // Shoulder Pads & Arms
    const shoulderGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const armGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.7);
    armGeo.translate(0, -0.35, 0);

    leftArm = new THREE.Group(); leftArm.position.set(-0.55, 1.6, 0);
    const lPad = new THREE.Mesh(shoulderGeo, armorMat); lPad.position.set(0,0,0);
    const lLim = new THREE.Mesh(armGeo, bodyMat); leftArm.add(lPad, lLim);

    rightArm = new THREE.Group(); rightArm.position.set(0.55, 1.6, 0);
    const rPad = new THREE.Mesh(shoulderGeo, armorMat); rPad.position.set(0,0,0);
    const rLim = new THREE.Mesh(armGeo, bodyMat); rightArm.add(rPad, rLim);
    
    player.add(leftArm, rightArm);

    // Segmented Running Legs
    const legGeo = new THREE.CylinderGeometry(0.1, 0.07, 0.8);
    legGeo.translate(0, -0.4, 0);
    
    leftLeg = new THREE.Mesh(legGeo, bodyMat); leftLeg.position.set(-0.25, 0.8, 0);
    rightLeg = new THREE.Mesh(legGeo, bodyMat); rightLeg.position.set(0.25, 0.8, 0);
    player.add(leftLeg, rightLeg);

    // Thruster Boost fire on backpack
    thrusterFire = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 8), boostMat);
    thrusterFire.rotation.x = Math.PI;
    thrusterFire.position.set(0, 1.0, -0.4);
    thrusterFire.visible = false;
    player.add(thrusterFire);

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
    // Dark metallic running bed
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 51), new THREE.MeshStandardMaterial({ color: 0x090810, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, zPos);
    floor.receiveShadow = true;
    scene.add(floor);
    tracks.push(floor);

    // Neon Cyber Grid Borders
    LANES.forEach(lane => {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 51), new THREE.MeshBasicMaterial({ color: 0x1d1a30 }));
        line.rotation.x = -Math.PI / 2;
        line.position.set(lane, 0.01, zPos);
        scene.add(line);
        tracks.push(line);
    });
}

// Continuous Spawn Matrix Manager
let spawnTimer = 0;
function manageSpawning() {
    spawnTimer++;
    if (spawnTimer % 45 === 0) {
        const laneIdx = Math.floor(Math.random() * 3);
        const targetLane = LANES[laneIdx];
        const spawnZ = -180;
        const roll = Math.random();

        if (roll < 0.28) {
            // 🚄 Mag-Lev Train 
            const trainGroup = new THREE.Group();
            trainGroup.position.set(targetLane, 1.8, spawnZ);
            
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.6, 20), new THREE.MeshStandardMaterial({ color: 0x0f3460, metalness: 0.8, roughness: 0.2 }));
            body.castShadow = true;
            trainGroup.add(body);

            // Tech Windshield / Glowing Headlights
            const lightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
            const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
            const lLight = new THREE.Mesh(lightGeo, lightMat); lLight.position.set(-0.7, -1.0, 10.01);
            const rLight = new THREE.Mesh(lightGeo, lightMat); rLight.position.set(0.7, -1.0, 10.01);
            trainGroup.add(lLight, rLight);

            // Integrated Roof Ramp
            const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 4.5), new THREE.MeshStandardMaterial({ color: 0x16213e }));
            ramp.position.set(0, -1.75, 12);
            ramp.rotation.x = 0.42;
            trainGroup.add(ramp);

            trainGroup.userData = { box: new THREE.Box3(), type: 'train', extraSpeed: 0.25 };
            scene.add(trainGroup);
            obstacles.push(trainGroup);

        } else if (roll >= 0.28 && roll < 0.55) {
            // 🚧 Spawn Barriers (3 Archetypes)
            const typeRoll = Math.random();
            let barrierMesh, bType;

            if (typeRoll < 0.33) {
                // 1. HIGH WALL: JUMP ONLY
                barrierMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.5, 0.4), new THREE.MeshStandardMaterial({ color: 0xff2e63, roughness: 0.4 }));
                barrierMesh.position.set(targetLane, 2.25, spawnZ);
                bType = 'barrier_jump_only';
            } else if (typeRoll < 0.66) {
                // 2. CRAWL BARRIER: CROUCH ONLY
                barrierMesh = new THREE.Group();
                const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 0.4), new THREE.MeshStandardMaterial({ color: 0xeee333 }));
                beam.position.y = 2.1; // Floating high gap under it
                const sideL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3), new THREE.MeshStandardMaterial({color: 0x222}));
                sideL.position.set(-1.2, 1.5, 0);
                const sideR = sideL.clone(); sideR.position.x = 1.2;
                barrierMesh.add(beam, sideL, sideR);
                barrierMesh.position.set(targetLane, 0, spawnZ);
                bType = 'barrier_crouch_only';
            } else {
                // 3. HURDLE PIPE: BOTH CAN PASS
                barrierMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4), new THREE.MeshStandardMaterial({ color: 0xff9f43 }));
                barrierMesh.rotation.z = Math.PI / 2;
                barrierMesh.position.set(targetLane, 1.0, spawnZ); // Floating midway
                bType = 'barrier_both';
            }

            barrierMesh.userData = { box: new THREE.Box3(), type: bType, extraSpeed: 0 };
            scene.add(barrierMesh);
            obstacles.push(barrierMesh);

        } else if (roll >= 0.55 && roll < 0.65) {
            // 💎 Spawn Powerups
            const pRoll = Math.random();
            const pType = pRoll > 0.5 ? 'JETPACK' : 'MAGNET';
            const color = pType === 'JETPACK' ? 0x00f3ff : 0xff00ff;

            let pGeo = pType === 'JETPACK' ? new THREE.OctahedronGeometry(0.45) : new THREE.SphereGeometry(0.35, 16, 16);
            const pMesh = new THREE.Mesh(pGeo, new THREE.MeshStandardMaterial({ color: color, emissive: color, roughness: 0.1 }));
            
            pMesh.position.set(targetLane, 1.4, spawnZ);
            pMesh.userData = { box: new THREE.Box3(), type: pType };
            scene.add(pMesh);
            powerups.push(pMesh);

        } else {
            // 🪙 Spawn Coins (Line sequence formation)
            const count = activePowerup === 'JETPACK' ? 1 : 3;
            const height = activePowerup === 'JETPACK' ? 7.5 : 1.2;
            
            for (let k = 0; k < count; k++) {
                const coin = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.35, 0.35, 0.12, 8),
                    new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x004433, roughness: 0.2 })
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
    if (!gameActive) return;

    if (event.key === 'ArrowLeft' && currentLane > 0) currentLane--;
    if (event.key === 'ArrowRight' && currentLane < 2) currentLane++;
    if ((event.key === 'ArrowUp' || event.key === ' ') && !isJumping && !isCrouching && activePowerup !== 'JETPACK') {
        isJumping = true;
        yVelocity = JUMP_FORCE;
        thrusterFire.visible = true;
    }
    if (event.key === 'ArrowDown' && !isJumping && activePowerup !== 'JETPACK') {
        triggerCrouch();
    }
}

function triggerCrouch() {
    isCrouching = true;
    crouchTimer = 22;
    player.scale.y = 0.35; // Squash down
    leftArm.rotation.x = -Math.PI/3;
    rightArm.rotation.x = -Math.PI/3;
}

// Primary Loop Logic
function animate() {
    requestAnimationFrame(animate);

    if (gameActive) {
        // 1. Lerp Lateral Movements
        player.position.x += (LANES[currentLane] - player.position.x) * 0.24;

        // 2. Continuous Locomotion Swing Animation
        const time = Date.now() * 0.009;
        if (!isJumping && !isCrouching && activePowerup !== 'JETPACK') {
            leftLeg.rotation.x = Math.sin(time) * 0.75;
            rightLeg.rotation.x = -Math.sin(time) * 0.75;
            leftArm.rotation.x = -Math.sin(time) * 0.5;
            rightArm.rotation.x = Math.sin(time) * 0.5;
        }

        // 3. Crouching Scaling Reset
        if (isCrouching) {
            crouchTimer--;
            if (crouchTimer <= 0) {
                isCrouching = false;
                player.scale.y = 1.0;
                leftArm.rotation.x = 0;
                rightArm.rotation.x = 0;
            }
        }

        // 4. Powerup State Engine Timers
        if (activePowerup) {
            powerupTimer -= 0.016; // Approx time delta per frame
            document.getElementById('powerup-time').innerText = Math.max(0, Math.ceil(powerupTimer));
            
            if (powerupTimer <= 0) {
                activePowerup = null;
                thrusterFire.visible = false;
                document.getElementById('powerup-status').classList.add('hidden');
            }
        }

        // 5. Vertical Terrain Logic (Default vs Jetpack Sky mode vs Train Roofs)
        let targetFloor = 0;

        if (activePowerup === 'JETPACK') {
            targetFloor = 7.0; // Float above hazards safely
            thrusterFire.visible = true;
            thrusterFire.scale.setScalar(Math.sin(time * 2) * 0.3 + 1.0);
        } else {
            // Train roof collision checks
            obstacles.forEach(obs => {
                if (obs.userData.type === 'train') {
                    if (Math.abs(player.position.x - obs.position.x) < 0.8) {
                        if (player.position.z < obs.position.z + 11 && player.position.z > obs.position.z - 11) {
                            if (player.position.y >= 3.3) targetFloor = 3.6;
                        }
                    }
                }
            });
        }

        // Apply Gravity Acceleration mechanics
        if (isJumping || player.position.y > targetFloor) {
            player.position.y += yVelocity;
            yVelocity += GRAVITY;

            if (player.position.y <= targetFloor) {
                player.position.y = targetFloor;
                isJumping = false;
                yVelocity = 0;
                if (activePowerup !== 'JETPACK') thrusterFire.visible = false;
            }
        } else if (!isCrouching) {
            player.position.y += (targetFloor - player.position.y) * 0.2;
        }

        // 6. Handle Infinite Ground Treadmill Loops
        tracks.forEach(track => {
            track.position.z += gameSpeed;
            if (track.position.z > 50) track.position.z -= 200;
        });

        // Frame update the precise bounding box of the player model
        const currentHeight = isCrouching ? PLAYER_CROUCH_HEIGHT : PLAYER_STAND_HEIGHT;
        playerBox.min.set(player.position.x - 0.45, player.position.y, player.position.z - 0.35);
        playerBox.max.set(player.position.x + 0.45, player.position.y + currentHeight, player.position.z + 0.35);

        // 7. Process Obstacles & Hazards Matrix
        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            obs.position.z += (gameSpeed + (obs.userData.extraSpeed || 0));
            obs.userData.box.setFromObject(obs);

            if (playerBox.intersectsBox(obs.userData.box)) {
                const type = obs.userData.type;

                // Jetpack flies completely clean above any grounding crash
                if (activePowerup === 'JETPACK') continue;

                // Validate individual specific multi-barrier rulesets
                if (type === 'barrier_crouch_only' && isCrouching) continue; 
                if (type === 'barrier_both' && (isCrouching || isJumping)) continue;
                if (type === 'train' && player.position.y >= 3.5) continue; // Safety bounds running on train roof

                endGame();
            }

            if (obs.position.z > 15) {
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
        }

        // 8. Process Powerup Drops Collection Loops
        for (let i = powerups.length - 1; i >= 0; i--) {
            let pu = powerups[i];
            pu.position.z += gameSpeed;
            pu.rotation.y += 0.04;
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

        // 9. Process Coins Vector & Magnet pulling physics
        for (let i = coins.length - 1; i >= 0; i--) {
            let coin = coins[i];
            coin.rotation.z += 0.05;

            // Magnet active pulling vector calculation
            if (activePowerup === 'MAGNET' && coin.position.z > -40) {
                // Accelerate coin vectors straight towards player core coordinates
                coin.position.x += (player.position.x - coin.position.x) * 0.22;
                coin.position.y += (player.position.y + 1.0 - coin.position.y) * 0.22;
                coin.position.z += (player.position.z - coin.position.z) * 0.22;
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
    }

    renderer.render(scene, camera);
}

function endGame() {
    gameActive = false;
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
    player.scale.y = 1.0;
    isCrouching = false; isJumping = false; thrusterFire.visible = false;
    
    document.getElementById('score').innerText = score;
    document.getElementById('powerup-status').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    gameActive = true;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
