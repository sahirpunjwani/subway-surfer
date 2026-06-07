// Game Configuration
const LANES = [-3, 0, 3];
let currentLane = 1;
let gameActive = true;
let score = 0;
let gameSpeed = 0.5;

// Three.js Core Variables
let scene, camera, renderer;
let player, playerBox;
let tracks = [];
let obstacles = [];
let coins = [];

// Robot Parts references for running animation
let leftLeg, rightLeg;

// Player State Mechanics
let isJumping = false;
let isCrouching = false;
let yVelocity = 0;
let crouchTimer = 0;
const GRAVITY = -0.016;
const JUMP_FORCE = 0.38;

// Configurable constants
const PLAYER_STAND_HEIGHT = 1.8;
const PLAYER_CROUCH_HEIGHT = 0.8;

// Initialization
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a14);
    scene.fog = new THREE.FogExp2(0x0a0a14, 0.012);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 9);
    camera.lookAt(0, 2, -4);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas').appendChild(renderer.domElement);

    // Dynamic Futuristic Neon Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xddffff, 0.8);
    dirLight.position.set(15, 30, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Cyberpunk-esque accent lights
    const pointLight = new THREE.PointLight(0x00ffcc, 1, 50);
    pointLight.position.set(0, 5, -10);
    scene.add(pointLight);

    createPlayerRobot();
    createEnvironment();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onWindowResize);
    document.getElementById('restart-btn').addEventListener('click', resetGame);

    animate();
}

// Assemble a cool looking multi-mesh 3D Android Robot
function createPlayerRobot() {
    player = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d5, roughness: 0.2, metalness: 0.8 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.5 });

    // Torso / Chest
    const torsoGeo = new THREE.BoxGeometry(0.9, 1.0, 0.6);
    const torso = new THREE.Mesh(torsoGeo, metalMat);
    torso.position.y = 1.2;
    torso.castShadow = true;
    player.add(torso);

    // Glowing core
    const coreGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const core = new THREE.Mesh(coreGeo, neonMat);
    core.position.set(0, 1.3, 0.31);
    player.add(core);

    // Head
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const head = new THREE.Mesh(headGeo, metalMat);
    head.position.y = 1.95;
    player.add(head);

    // Visor/Eyes
    const visorGeo = new THREE.BoxGeometry(0.4, 0.1, 0.1);
    const visor = new THREE.Mesh(visorGeo, neonMat);
    visor.position.set(0, 2.0, 0.22);
    player.add(visor);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.8, 8);
    leftLeg = new THREE.Mesh(legGeo, jointMat);
    leftLeg.position.set(-0.25, 0.4, 0);
    rightLeg = new THREE.Mesh(legGeo, jointMat);
    rightLeg.position.set(0.25, 0.4, 0);
    player.add(leftLeg, rightLeg);

    player.position.set(LANES[currentLane], 0, 0);
    scene.add(player);

    // Invisible Bounding Box wrapping the combined group
    playerBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
}

function createEnvironment() {
    for (let i = 0; i < 4; i++) {
        spawnTrackSection(i * -50);
    }
}

function spawnTrackSection(zPos) {
    const floorGeo = new THREE.PlaneGeometry(14, 50);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, zPos);
    floor.receiveShadow = true;
    scene.add(floor);
    tracks.push(floor);

    // Cyber grid lines representing tracks
    LANES.forEach(lane => {
        const lineGeo = new THREE.PlaneGeometry(0.2, 50);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x2d2d3a });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(lane, 0.01, zPos);
        scene.add(line);
        tracks.push(line);
    });
}

// Spawning Logic (Hurdles, Crawl Barriers, and Faster Trains)
let spawnTimer = 0;
function manageSpawning() {
    spawnTimer++;
    if (spawnTimer % 55 === 0) {
        const randomLane = Math.floor(Math.random() * 3);
        const spawnZ = -160;
        const roll = Math.random();

        if (roll < 0.35) {
            // 🚄 TYPE 1: Train (Moves faster towards player, can walk on top)
            const trainGeo = new THREE.BoxGeometry(2.2, 3.5, 18);
            const trainMat = new THREE.MeshStandardMaterial({ color: 0xcc2233, metalness: 0.7, roughness: 0.3 });
            const train = new THREE.Mesh(trainGeo, trainMat);
            train.position.set(LANES[randomLane], 1.75, spawnZ);
            train.castShadow = true;
            
            // Add a Wedge Mesh on back of train serving as an intuitive ramp
            const rampGeo = new THREE.BoxGeometry(2.2, 0.1, 4);
            const rampMat = new THREE.MeshStandardMaterial({ color: 0x991122 });
            const ramp = new THREE.Mesh(rampGeo, rampMat);
            ramp.position.set(0, -1.6, 10); // Placed at rear end
            ramp.rotation.x = 0.4; // Tilted downward
            train.add(ramp);

            // Give train faster offset movement properties
            train.userData = { box: new THREE.Box3(), type: 'train', extraSpeed: 0.25 };
            scene.add(train);
            obstacles.push(train);

        } else if (roll >= 0.35 && roll < 0.65) {
            // 🚧 TYPE 2: Crawl Barrier (Must Crouch!)
            const barrierGroup = new THREE.Group();
            
            // Side supports
            const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x333 });
            const leftP = new THREE.Mesh(poleGeo, poleMat); leftP.position.x = -1.2;
            const rightP = new THREE.Mesh(poleGeo, poleMat); rightP.position.x = 1.2;
            barrierGroup.add(leftP, rightP);

            // Warning Bar block hung high up
            const barGeo = new THREE.BoxGeometry(2.6, 0.7, 0.3);
            // Caution yellow/black stripe texture look via basic colors
            const barMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.6 });
            const bar = new THREE.Mesh(barGeo, barMat);
            bar.position.y = 2.0; // Suspended high
            barrierGroup.add(bar);

            barrierGroup.position.set(LANES[randomLane], 1.5, spawnZ);
            barrierGroup.userData = { box: new THREE.Box3(), type: 'crawl_barrier', extraSpeed: 0 };
            scene.add(barrierGroup);
            obstacles.push(barrierGroup);

        } else {
            // 🟡 TYPE 3: Grid Coins
            const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.15, 12);
            const coinMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00aa77 });
            const coin = new THREE.Mesh(coinGeo, coinMat);
            coin.rotation.x = Math.PI / 2;
            
            // Scatter height randomly if on flat ground vs potential trains
            const coinHeight = Math.random() > 0.5 ? 1.2 : 4.5;
            coin.position.set(LANES[randomLane], coinHeight, spawnZ);
            coin.userData = { box: new THREE.Box3(), type: 'coin' };
            scene.add(coin);
            coins.push(coin);
        }
    }
}

// Input Controllers
function handleKeyDown(event) {
    if (!gameActive) return;

    if (event.key === 'ArrowLeft' && currentLane > 0) {
        currentLane--;
    }
    if (event.key === 'ArrowRight' && currentLane < 2) {
        currentLane++;
    }
    if ((event.key === 'ArrowUp' || event.key === ' ') && !isJumping && !isCrouching) {
        isJumping = true;
        yVelocity = JUMP_FORCE;
    }
    if (event.key === 'ArrowDown' && !isJumping) {
        triggerCrouch();
    }
}

function triggerCrouch() {
    isCrouching = true;
    crouchTimer = 25; // Lasts for 25 frames
    player.scale.y = 0.45; // Flatten robot visually 
    player.position.y = 0; 
}

// Game Loop calculations
function animate() {
    requestAnimationFrame(animate);

    if (gameActive) {
        // 1. Lane Leaping Physics
        player.position.x += (LANES[currentLane] - player.position.x) * 0.22;

        // 2. Robot Legs Walk Cycle Simulation
        if (!isJumping && !isCrouching) {
            const time = Date.now() * 0.008;
            leftLeg.rotation.x = Math.sin(time) * 0.6;
            rightLeg.rotation.x = -Math.sin(time) * 0.6;
        } else {
            leftLeg.rotation.x = 0;
            rightLeg.rotation.x = 0;
        }

        // 3. Crouching Timers
        if (isCrouching) {
            crouchTimer--;
            if (crouchTimer <= 0) {
                isCrouching = false;
                player.scale.y = 1.0; // Restore full height scale
            }
        }

        // 4. Vertical Tracking & Gravity
        let baseFloorLevel = 0;

        // Scan underneath to determine if standing on top of a Train
        obstacles.forEach(obs => {
            if (obs.userData.type === 'train') {
                // If player lane matches train lane, and player is inside train's longitudinal Z-spread
                if (Math.abs(player.position.x - obs.position.x) < 1.0) {
                    if (player.position.z < obs.position.z + 10 && player.position.z > obs.position.z - 10) {
                        // Standing over roof line
                        if (player.position.y >= 3.4) {
                            baseFloorLevel = 3.5;
                        }
                    }
                }
            }
        });

        if (isJumping || player.position.y > baseFloorLevel) {
            player.position.y += yVelocity;
            yVelocity += GRAVITY;

            if (player.position.y <= baseFloorLevel) {
                player.position.y = baseFloorLevel;
                isJumping = false;
                yVelocity = 0;
            }
        } else if (!isCrouching) {
            // Anchor default standing position 
            player.position.y = baseFloorLevel;
        }

        // 5. Shift Background Environment Loops
        tracks.forEach(track => {
            track.position.z += gameSpeed;
            if (track.position.z > 50) track.position.z -= 200;
        });

        // Compute localized dynamic bounding box sizes for the robot depending on posture
        const dynamicHeight = isCrouching ? PLAYER_CROUCH_HEIGHT : PLAYER_STAND_HEIGHT;
        playerBox.min.set(player.position.x - 0.45, player.position.y, player.position.z - 0.3);
        playerBox.max.set(player.position.x + 0.45, player.position.y + dynamicHeight, player.position.z + 0.3);

        // 6. Manage Hazard Collisions
        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            
            // Active movement vectors (Trains move faster relative to ground speed)
            obs.position.z += (gameSpeed + (obs.userData.extraSpeed || 0));
            obs.userData.box.setFromObject(obs);

            if (playerBox.intersectsBox(obs.userData.box)) {
                
                // Fine-tune Exception logic for Crawl Barriers
                if (obs.userData.type === 'crawl_barrier') {
                    // If crouching, you safely slip right under the collision block
                    if (isCrouching) {
                        continue; 
                    }
                }
                
                // Exception logic for running along Train Rooves
                if (obs.userData.type === 'train' && player.position.y >= 3.4) {
                    continue; // Safe!
                }

                endGame();
            }

            if (obs.position.z > 15) {
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
        }

        // 7. Coin Collection Loops
        for (let i = coins.length - 1; i >= 0; i--) {
            let coin = coins[i];
            coin.position.z += gameSpeed;
            coin.rotation.z += 0.06;
            coin.userData.box.setFromObject(coin);

            if (playerBox.intersectsBox(coin.userData.box)) {
                score += 15;
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
        gameSpeed += 0.00008; // Continuous mild speed ramp
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
    obstacles = [];
    coins = [];
    score = 0;
    gameSpeed = 0.5;
    currentLane = 1;
    player.position.set(LANES[currentLane], 0, 0);
    player.scale.y = 1.0;
    isCrouching = false;
    isJumping = false;
    document.getElementById('score').innerText = score;
    document.getElementById('game-over-screen').classList.add('hidden');
    gameActive = true;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
