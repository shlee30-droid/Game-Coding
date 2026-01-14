import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Game State
const gameState = {
    isPlaying: false,
    score: 0,
    level: 1,
    health: 100,
    enemies: [],
    bullets: [],
    particles: [],
    specialAttackCooldown: 0,
    enemySpawnTimer: 0,
    levelUpScore: 1000
};

// Player State
const player = {
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotation: 0,
    speed: 0.3,
    mesh: null
};

// Input State
const keys = {};
const mouse = { x: 0, y: 0 };

// Scene Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000510, 0.01);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 25);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById('gameCanvas'),
    antialias: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// Post-processing for bloom effect
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5, 0.4, 0.85
);
composer.addPass(bloomPass);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0x00ffff, 2, 100);
pointLight1.position.set(0, 20, 0);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xff00ff, 1.5, 100);
pointLight2.position.set(-20, 10, -20);
scene.add(pointLight2);

// Create Player
function createPlayer() {
    const geometry = new THREE.ConeGeometry(0.8, 2, 4);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
    });
    player.mesh = new THREE.Mesh(geometry, material);
    player.mesh.rotation.x = Math.PI;
    player.mesh.castShadow = true;
    scene.add(player.mesh);

    // Add player glow
    const glowGeometry = new THREE.SphereGeometry(1.2, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    player.mesh.add(glow);
}

// Create Ground Grid
function createGround() {
    const gridHelper = new THREE.GridHelper(100, 50, 0x00ffff, 0x003333);
    gridHelper.position.y = -1;
    scene.add(gridHelper);

    // Add ground plane for visual effect
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x001122,
        transparent: true,
        opacity: 0.8,
        metalness: 0.8,
        roughness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);
}

// Create Enemy
function createEnemy() {
    const types = [
        { color: 0xff0066, size: 1, health: 1, speed: 0.08, points: 100 },
        { color: 0xff9900, size: 1.5, health: 2, speed: 0.06, points: 200 },
        { color: 0xff00ff, size: 2, health: 3, speed: 0.04, points: 300 }
    ];
    
    const type = types[Math.floor(Math.random() * Math.min(types.length, Math.ceil(gameState.level / 2)))];
    
    const geometry = new THREE.OctahedronGeometry(type.size, 0);
    const material = new THREE.MeshStandardMaterial({ 
        color: type.color,
        emissive: type.color,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
    });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Random spawn position
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 10;
    mesh.position.set(
        Math.cos(angle) * distance,
        type.size,
        Math.sin(angle) * distance
    );
    mesh.castShadow = true;
    
    scene.add(mesh);
    
    gameState.enemies.push({
        mesh,
        health: type.health,
        maxHealth: type.health,
        speed: type.speed,
        points: type.points,
        rotationSpeed: Math.random() * 0.05 + 0.02
    });
}

// Create Bullet
function createBullet(fromSpecial = false) {
    const geometry = new THREE.SphereGeometry(fromSpecial ? 0.5 : 0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
        color: fromSpecial ? 0xff00ff : 0x00ffff
    });
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.copy(player.position);
    mesh.position.y += 1;
    
    // Calculate direction
    const direction = new THREE.Vector3(mouse.x, 0, mouse.y).sub(player.position).normalize();
    
    scene.add(mesh);
    
    gameState.bullets.push({
        mesh,
        velocity: direction.multiplyScalar(fromSpecial ? 1.2 : 0.8),
        damage: fromSpecial ? 3 : 1,
        lifetime: 100
    });

    // Add muzzle flash particle
    createParticles(player.position.clone(), fromSpecial ? 0xff00ff : 0x00ffff, 10);
}

// Create Particle Effect
function createParticles(position, color, count) {
    for (let i = 0; i < count; i++) {
        const geometry = new THREE.SphereGeometry(0.1, 4, 4);
        const material = new THREE.MeshBasicMaterial({ color });
        const particle = new THREE.Mesh(geometry, material);
        
        particle.position.copy(position);
        
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.3,
            (Math.random() - 0.5) * 0.3
        );
        
        scene.add(particle);
        
        gameState.particles.push({
            mesh: particle,
            velocity,
            lifetime: 30
        });
    }
}

// Update Player
function updatePlayer() {
    // Movement
    const moveVector = new THREE.Vector3();
    if (keys['w'] || keys['W']) moveVector.z -= 1;
    if (keys['s'] || keys['S']) moveVector.z += 1;
    if (keys['a'] || keys['A']) moveVector.x -= 1;
    if (keys['d'] || keys['D']) moveVector.x += 1;
    
    if (moveVector.length() > 0) {
        moveVector.normalize();
        player.velocity.lerp(moveVector.multiplyScalar(player.speed), 0.2);
    } else {
        player.velocity.multiplyScalar(0.9);
    }
    
    player.position.add(player.velocity);
    
    // Boundary limits
    const limit = 40;
    player.position.x = Math.max(-limit, Math.min(limit, player.position.x));
    player.position.z = Math.max(-limit, Math.min(limit, player.position.z));
    
    // Rotation towards mouse
    const angle = Math.atan2(mouse.y - player.position.z, mouse.x - player.position.x);
    player.rotation = angle + Math.PI / 2;
    
    player.mesh.position.copy(player.position);
    player.mesh.position.y = 1;
    player.mesh.rotation.y = player.rotation;
    
    // Update cooldowns
    if (gameState.specialAttackCooldown > 0) {
        gameState.specialAttackCooldown--;
    }
}

// Update Enemies
function updateEnemies() {
    gameState.enemies.forEach((enemy, index) => {
        // Move towards player
        const direction = player.position.clone().sub(enemy.mesh.position).normalize();
        enemy.mesh.position.add(direction.multiplyScalar(enemy.speed * (1 + gameState.level * 0.1)));
        
        // Rotate
        enemy.mesh.rotation.x += enemy.rotationSpeed;
        enemy.mesh.rotation.y += enemy.rotationSpeed;
        
        // Check collision with player
        const distance = enemy.mesh.position.distanceTo(player.position);
        if (distance < 2) {
            gameState.health -= 10;
            updateHealthBar();
            scene.remove(enemy.mesh);
            gameState.enemies.splice(index, 1);
            createParticles(enemy.mesh.position, 0xff0000, 20);
            
            if (gameState.health <= 0) {
                gameOver();
            }
        }
    });
}

// Update Bullets
function updateBullets() {
    gameState.bullets.forEach((bullet, bIndex) => {
        bullet.mesh.position.add(bullet.velocity);
        bullet.lifetime--;
        
        // Remove if lifetime expired
        if (bullet.lifetime <= 0) {
            scene.remove(bullet.mesh);
            gameState.bullets.splice(bIndex, 1);
            return;
        }
        
        // Check collision with enemies
        gameState.enemies.forEach((enemy, eIndex) => {
            const distance = bullet.mesh.position.distanceTo(enemy.mesh.position);
            if (distance < 1.5) {
                enemy.health -= bullet.damage;
                
                // Remove bullet
                scene.remove(bullet.mesh);
                gameState.bullets.splice(bIndex, 1);
                
                // Check if enemy destroyed
                if (enemy.health <= 0) {
                    gameState.score += enemy.points;
                    updateScore();
                    scene.remove(enemy.mesh);
                    gameState.enemies.splice(eIndex, 1);
                    createParticles(enemy.mesh.position, 0x00ff00, 30);
                    
                    // Level up check
                    if (gameState.score >= gameState.levelUpScore) {
                        gameState.level++;
                        gameState.levelUpScore += 1000 * gameState.level;
                        updateLevel();
                    }
                } else {
                    createParticles(bullet.mesh.position, 0xffff00, 10);
                }
            }
        });
    });
}

// Update Particles
function updateParticles() {
    gameState.particles.forEach((particle, index) => {
        particle.mesh.position.add(particle.velocity);
        particle.velocity.multiplyScalar(0.95);
        particle.lifetime--;
        
        particle.mesh.material.opacity = particle.lifetime / 30;
        
        if (particle.lifetime <= 0) {
            scene.remove(particle.mesh);
            gameState.particles.splice(index, 1);
        }
    });
}

// Spawn Enemies
function spawnEnemies() {
    gameState.enemySpawnTimer++;
    const spawnRate = Math.max(60 - gameState.level * 5, 20);
    
    if (gameState.enemySpawnTimer >= spawnRate) {
        const count = Math.min(1 + Math.floor(gameState.level / 3), 3);
        for (let i = 0; i < count; i++) {
            createEnemy();
        }
        gameState.enemySpawnTimer = 0;
    }
}

// Update UI
function updateScore() {
    document.getElementById('score').textContent = gameState.score;
}

function updateLevel() {
    document.getElementById('level').textContent = gameState.level;
}

function updateHealthBar() {
    const healthPercent = Math.max(0, gameState.health);
    document.getElementById('health-fill').style.width = healthPercent + '%';
    
    // Change color based on health
    const healthFill = document.getElementById('health-fill');
    if (healthPercent > 60) {
        healthFill.style.background = 'linear-gradient(90deg, #0f0, #0ff)';
    } else if (healthPercent > 30) {
        healthFill.style.background = 'linear-gradient(90deg, #ff0, #f90)';
    } else {
        healthFill.style.background = 'linear-gradient(90deg, #f00, #f60)';
    }
}

// Game Loop
function animate() {
    requestAnimationFrame(animate);
    
    if (gameState.isPlaying) {
        updatePlayer();
        updateEnemies();
        updateBullets();
        updateParticles();
        spawnEnemies();
        
        // Animate lights
        pointLight1.position.x = Math.sin(Date.now() * 0.001) * 20;
        pointLight1.position.z = Math.cos(Date.now() * 0.001) * 20;
    }
    
    composer.render();
}

// Start Game
function startGame() {
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.level = 1;
    gameState.health = 100;
    gameState.enemies = [];
    gameState.bullets = [];
    gameState.particles = [];
    gameState.levelUpScore = 1000;
    
    // Clear scene
    gameState.enemies.forEach(enemy => scene.remove(enemy.mesh));
    gameState.bullets.forEach(bullet => scene.remove(bullet.mesh));
    gameState.particles.forEach(particle => scene.remove(particle.mesh));
    
    updateScore();
    updateLevel();
    updateHealthBar();
    
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
}

// Game Over
function gameOver() {
    gameState.isPlaying = false;
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

// Event Listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // Special attack
    if (e.key === ' ' && gameState.isPlaying && gameState.specialAttackCooldown === 0) {
        e.preventDefault();
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            mouse.x = player.position.x + Math.cos(angle) * 5;
            mouse.y = player.position.z + Math.sin(angle) * 5;
            createBullet(true);
        }
        gameState.specialAttackCooldown = 180; // 3 seconds at 60fps
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

window.addEventListener('mousemove', (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Convert to world coordinates
    const vector = new THREE.Vector3(x, y, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.y / dir.y;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
    
    mouse.x = pos.x;
    mouse.y = pos.z;
});

window.addEventListener('click', () => {
    if (gameState.isPlaying) {
        createBullet();
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize
createPlayer();
createGround();

// Add starfield background
const starsGeometry = new THREE.BufferGeometry();
const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
const starsVertices = [];
for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 200;
    const y = Math.random() * 100 + 20;
    const z = (Math.random() - 0.5) * 200;
    starsVertices.push(x, y, z);
}
starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

animate();
