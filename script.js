// Game Configuration
const LANES = [-3, 0, 3]; // Left, Center, Right X-positions
let currentLane = 1;      // Start in Center (index 1)
let gameActive = true;
let score = 0;
let gameSpeed = 0.4;

// Three.js Core Variables
let scene, camera, renderer;
let player, playerBox;
let tracks = [];
let obstacles = [];
let coins = [];

// Player Physics Variables
let isJumping = false;
let yVelocity = 0;
const GRAVITY = -0.015;
const JUMP_FORCE = 0.35;

// Initialization
function init() {
    // 1. Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.FogExp2(0xa0a0a0, 0.015);

    // 2. Setup Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 8);
    camera.lookAt(0, 2, -5);

    // 3. Setup Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-canvas').appendChild(renderer.domElement);

    // 4. Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 5. Create Objects
    createPlayer();
    createEnvironment();

    // 6. Event Listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onWindowResize);
    document.getElementById('restart-btn').addEventListener('click', resetGame);

    // Start Loop
    animate();
}

// Create Player (Red Capsule substitute)
function createPlayer() {
    const geometry = new THREE.BoxGeometry(1, 1.8, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    player = new THREE.Mesh(geometry, material);
    player.position.set(LANES[currentLane], 0.9, 0);
    player.castShadow = true;
    scene.add(player);

    playerBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
}

// Generate Track Treadmill Elements
function createEnvironment() {
    // Spawn 3 interlocking ground slices ahead
    for (let i = 0; i < 3; i++) {
        spawnTrackSection(i * -50);
    }
}

function spawnTrackSection(zPos) {
    const geometry = new THREE.PlaneGeometry(12, 50);
    const material = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(geometry, material);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, zPos);
    floor.receiveShadow = true;
    scene.add(floor);
    tracks.push(floor);

    // Visual lane markings
    for(let lane of LANES) {
        const lineGeo = new THREE.PlaneGeometry(0.1, 50);
        const lineMat = new THREE.MeshBasicMaterial({color: 0xffffff});
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(lane, 0.01, zPos);
        scene.add(line);
        tracks.push(line); // Track together for recycling movement
    }
}

// Spawning Spree logic
let spawnTimer = 0;
function manageSpawning() {
    spawnTimer += 1;
    if (spawnTimer % 60 === 0) { // Every ~1 second
        const randomLane = Math.floor(Math.random() * 3);
        const spawnZ = -120;

        if (Math.random() > 0.4) {
            // Spawn Obstacle (Blue hurdle or Tall Train block)
            const isTall = Math.random() > 0.7;
            const obsHeight = isTall ? 5 : 1.2;
            const obsGeo = new THREE.BoxGeometry(1.8, obsHeight, 2);
            const obsMat = new THREE.MeshStandardMaterial({ color: isTall ? 0x0066cc : 0xff9900 });
            const obstacle = new THREE.Mesh(obsGeo, obsMat);
            
            obstacle.position.set(LANES[randomLane], obsHeight / 2, spawnZ);
            obstacle.userData = { box: new THREE.Box3(), type: 'obstacle' };
            scene.add(obstacle);
            obstacles.push(obstacle);
        } else {
            // Spawn Coin (Yellow Cylinder)
            const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
            const coinMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.6, roughness: 0.2 });
            const coin = new THREE.Mesh(coinGeo, coinMat);
            coin.rotation.x = Math.PI / 2;
            coin.position.set(LANES[randomLane], 1, spawnZ);
            coin.userData = { box: new THREE.Box3(), type: 'coin' };
            scene.add(coin);
            coins.push(coin);
        }
    }
}

// Handle Controls
function handleKeyDown(event) {
    if (!gameActive) return;

    if (event.key === 'ArrowLeft' && currentLane > 0) {
        currentLane--;
    }
    if (event.key === 'ArrowRight' && currentLane < 2) {
        currentLane++;
    }
    if ((event.key === 'ArrowUp' || event.key === ' ') && !isJumping) {
        isJumping = true;
        yVelocity = JUMP_FORCE;
    }
}

// Main Game Loop
function animate() {
    requestAnimationFrame(animate);

    if (gameActive) {
        // 1. Smoothly Lerp X Position to Target Lane
        player.position.x += (LANES[currentLane] - player.position.x) * 0.2;

        // 2. Handle Jump Gravity
        if (isJumping) {
            player.position.y += yVelocity;
            yVelocity += GRAVITY;

            if (player.position.y <= 0.9) {
                player.position.y = 0.9;
                isJumping = false;
                yVelocity = 0;
            }
        }

        // 3. Move Track Environment (Treadmill effect)
        tracks.forEach(track => {
            track.position.z += gameSpeed;
            if (track.position.z > 50) {
                track.position.z -= 150; // Teleport far back
            }
        });

        // 4. Move and Manage Obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            obs.position.z += gameSpeed;
            obs.userData.box.setFromObject(obs);

            // Check collision
            playerBox.setFromObject(player);
            if (playerBox.intersectsBox(obs.userData.box)) {
                endGame();
            }

            // Cleanup off-screen
            if (obs.position.z > 10) {
                scene.remove(obs);
                obstacles.splice(i, 1);
            }
        }

        // 5. Move and Manage Coins
        for (let i = coins.length - 1; i >= 0; i--) {
            let coin = coins[i];
            coin.position.z += gameSpeed;
            coin.rotation.z += 0.05; // Spin visual
            coin.userData.box.setFromObject(coin);

            // Check collection collision
            playerBox.setFromObject(player);
            if (playerBox.intersectsBox(coin.userData.box)) {
                score += 10;
                document.getElementById('score').innerText = score;
                scene.remove(coin);
                coins.splice(i, 1);
                continue;
            }

            if (coin.position.z > 10) {
                scene.remove(coin);
                coins.splice(i, 1);
            }
        }

        // Spawning updates
        manageSpawning();
        
        // Speed scaling gradually
        gameSpeed += 0.0001;
    }

    renderer.render(scene, camera);
}

function endGame() {
    gameActive = false;
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function resetGame() {
    // Clear old elements from scene
    obstacles.forEach(o => scene.remove(o));
    coins.forEach(c => scene.remove(c));
    obstacles = [];
    coins = [];
    
    // Reset metrics
    score = 0;
    gameSpeed = 0.4;
    currentLane = 1;
    player.position.set(LANES[currentLane], 0.9, 0);
    document.getElementById('score').innerText = score;
    
    document.getElementById('game-over-screen').classList.add('hidden');
    gameActive = true;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Boot up
init();
