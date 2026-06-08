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

// Animation State Engines
let mixer = null; 
let animationsMap = {}; 
let currentAction = null;

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

    buildAnimatedPlayer();
    buildEnvironment();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onWindowResize);
    
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    if (startBtn) startBtn.addEventListener('click', startGame);
    if (restartBtn) restartBtn.addEventListener('click', resetGame);

    animate();
}

function buildAnimatedPlayer() {
    player = new THREE.Group();
    player.position.set(LANES[currentLane], 0, 0);
    scene.add(player);

    playerBox = new THREE.Box3();

    const placeholderGeo = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const placeholderMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, visible: true });
    const placeholderMesh = new THREE.Mesh(placeholderGeo, placeholderMat);
    placeholderMesh.position.y = 0.8;
    player.add(placeholderMesh);

    const loader = new THREE.GLTFLoader();
    
    loader.load('./player.glb', function(gltf) {
        player.remove(placeholderMesh);

        const model = gltf.scene;
        model.scale.set(1.5, 1.5, 1.5);
        model.position.y = 0;
        model.rotation.y = Math.PI; 
        
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        player.add(model);

        const localMixer = new THREE.AnimationMixer(model);
        
        gltf.animations.forEach((clip) => {
            const name = clip.name.toLowerCase();
            if (name.includes('run') || name.includes('walk') || name.includes('drive')) {
                animationsMap['run'] = localMixer.clipAction(clip);
            }
            if (name.includes('jump') || name.includes('up')) {
                animationsMap['jump'] = localMixer.clipAction(clip);
            }
            if (name.includes('slide') || name.includes('crouch') || name.includes('roll') || name.includes('duck')) {
                animationsMap['slide'] = localMixer.clipAction(clip);
            }
            if (name.includes('idle') || name.includes('stand')) {
                animationsMap['idle'] = localMixer.clipAction(clip);
            }
        });

        if (!animationsMap['run'] && gltf.animations[0]) animationsMap['run'] = localMixer.clipAction(gltf.animations[0]);
        if (!animationsMap['idle']) animationsMap['idle'] = animationsMap['run'];
        if (!animationsMap['jump']) animationsMap['jump'] = animationsMap['run'];
        if (!animationsMap['slide']) animationsMap['slide'] = animationsMap['idle'];

        mixer = localMixer;

        if (gameState === "PLAYING") {
            fadeToAnimation('run');
        } else {
            fadeToAnimation('idle');
        }

    }, undefined, function(error) {
        console.error("Asset Load Error: player.glb missing or named incorrectly inside your repository root folder.", error);
    });
}

function fadeToAnimation(targetName) {
    if (!mixer || !animationsMap[targetName]) return;
    
    const targetAction = animationsMap[targetName];
    if (currentAction === targetAction) return;

    if (currentAction) {
        currentAction.fadeOut(0.12);
    }
    
    targetAction.reset().fadeIn(0.12).play();
    currentAction = targetAction;
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
        fadeToAnimation('jump');
    }
    if (event.key === 'ArrowDown' && !isJumping && activePowerup !== 'JETPACK') {
        triggerModelSlide();
    }
}

function triggerModelSlide() {
    isCrouching = true;
    crouchTimer = 25; 
    currentCollisionHeight = PLAYER_CROUCH_HEIGHT;
    
    if(player && player.children[0]) player.children[0].position.y = -0.4;
    fadeToAnimation('slide');
}

function resetModelSlide() {
    isCrouching = false;
    currentCollisionHeight = PLAYER_STAND_HEIGHT;
    if(player && player.children[0]) player.children[0].position.y = 0; 
    
    if (gameState === "PLAYING" && !isJumping && activePowerup !== 'JETPACK') {
        fadeToAnimation('run');
    }
}

function animate() {
    requestAnimationFrame(animate);

    const now = Date.now();
    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    if (mixer) mixer.update(delta);

    if (gameState === "PLAYING") {
        if (player) player.position.x += (LANES[currentLane] - player.position.x) * 0.24;

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
                if (!isJumping && !isCrouching) fadeToAnimation('run');
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
                    if (gameState === "PLAYING" && !isCrouching && activePowerup !== 'JETPACK') {
                        fadeToAnimation('run');
                    }
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
                
                if (activePowerup === 'JETPACK') fadeToAnimation('idle'); 
                
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
    fadeToAnimation('run');
}

function endGame() {
    gameState = "GAMEOVER";
    fadeToAnimation('idle');
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
    fadeToAnimation('run');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('DOMContentLoaded', () => {
    init();
});
