// Game constants
const GRAVITY = 0.5;
const JUMP_FORCE = -10;
const PIPE_WIDTH = 50;
const PIPE_GAP = 150;
const BIRD_SIZE = 30;
const FLAP_ANIMATION_DURATION = 0.2;

// Game state
let gameStarted = false;
let gameOver = false;
let score = 0;
let highScore = localStorage.getItem('flappyHighScore') || 0;
let bpm = 120; // Default BPM
let lastClapTime = 0;
let lastPipeTime = 0;
let pipeInterval = 2000; // Default interval in ms (will be updated based on BPM)

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const bpmValueElement = document.getElementById('bpm-value');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const micStatusElement = document.getElementById('mic-status');

// Bird properties
const bird = {
    x: 100,
    y: canvas.height / 2,
    velocity: 0,
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    color: '#ffd700',
    image: null,
    rotation: 0,
    
    init: function() {
        // Load the bird image
        this.image = new Image();
        this.image.src = 'bird.png';
        // Set a default size if the image loads with different dimensions
        this.image.onload = () => {
            // Optionally adjust the size based on the image's aspect ratio
            const aspectRatio = this.image.width / this.image.height;
            this.height = BIRD_SIZE;
            this.width = this.height * aspectRatio;
        };
    },
    
    jump: function() {
        this.velocity = JUMP_FORCE;
        this.rotation = -0.5; // Tilt up when jumping
        playSound('jump');
    },
    
    update: function() {
        // Apply gravity
        this.velocity += GRAVITY;
        this.y += this.velocity;
        
        // Update rotation based on velocity
        this.rotation = Math.min(Math.PI/4, Math.max(-Math.PI/4, this.velocity * 0.05));

        // Keep bird within canvas bounds
        if (this.y < 0) {
            this.y = 0;
            this.velocity = 0;
        }
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            if (!gameOver) {
                endGame();
            }
        }
    },
    
    draw: function() {
        if (this.image && this.image.complete) {
            // Save the current canvas state
            ctx.save();
            
            // Move to the bird's center point
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            
            // Rotate the canvas
            ctx.rotate(this.rotation);
            
            // Draw the image centered
            ctx.drawImage(
                this.image, 
                -this.width/2, 
                -this.height/2, 
                this.width, 
                this.height
            );
            
            // Restore the canvas state
            ctx.restore();
        } else {
            // Fallback to drawing a circle if the image isn't loaded
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
};

// Pipes array
let pipes = [];

// Sound effects
const sounds = {
    jump: new Audio('https://assets.mixkit.co/active_storage/sfx/2577/2577-preview.mp3'),
    point: new Audio('https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3'),
    hit: new Audio('https://assets.mixkit.co/active_storage/sfx/2579/2579-preview.mp3'),
    clap: new Audio('https://assets.mixkit.co/active_storage/sfx/2507/2507-preview.mp3')
};

function playSound(soundName) {
    if (sounds[soundName]) {
        const sound = sounds[soundName].cloneNode();
        sound.volume = 0.3;
        sound.play().catch(e => console.log('Audio play failed:', e));
    }
}

// Reset game state
function resetGame() {
    // Reset game state
    gameOver = false;
    score = 0;
    scoreElement.textContent = score;
    pipes = [];
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    bird.rotation = 0;
    lastPipeTime = 0;
    lastClapTime = 0;
    bpm = 120;
    bpmValueElement.textContent = bpm;
    pipeInterval = 2000; // Reset to default interval
    
    // Remove any existing game over screen
    const existingGameOver = document.querySelector('#game-over-screen');
    if (existingGameOver) {
        existingGameOver.remove();
    }
}

// Initialize game
function init() {
    resetGame();
    
    // Hide start screen
    startScreen.style.display = 'none';
    
    // Start game loop
    if (!gameStarted) {
        gameStarted = true;
        gameLoop();
    }
}

// Game loop
function gameLoop() {
    if (gameOver) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update and draw bird
    bird.update();
    bird.draw();
    
    // Update and draw pipes
    updatePipes();
    drawPipes();
    
    // Check for collisions
    checkCollisions();
    
    // Generate new pipes based on BPM
    const now = Date.now();
    if (now - lastPipeTime > pipeInterval) {
        addPipe();
        lastPipeTime = now;
    }
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Pipe functions
function addPipe() {
    const gapPosition = Math.random() * (canvas.height - PIPE_GAP - 100) + 50;
    pipes.push({
        x: canvas.width,
        gapY: gapPosition,
        passed: false,
        width: PIPE_WIDTH,
        gap: PIPE_GAP,
        color: '#ffffffff'
    });
}

function updatePipes() {
    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        pipe.x -= 2; // Move pipe to the left
        
        // Remove pipes that are off screen
        if (pipe.x + pipe.width < 0) {
            pipes.splice(i, 1);
            continue;
        }
        
        // Check if bird passed the pipe
        if (!pipe.passed && pipe.x + pipe.width < bird.x) {
            pipe.passed = true;
            score++;
            scoreElement.textContent = score;
            playSound('point');
            
            // Play clap sound when passing a pipe (metronome effect)
            playSound('clap');
            
            // Update BPM based on clap detection (simplified)
            const now = Date.now();
            if (lastClapTime > 0) {
                const timeBetweenClaps = now - lastClapTime;
                if (timeBetweenClaps > 0) {
                    bpm = Math.round(60000 / timeBetweenClaps);
                    bpm = Math.max(60, Math.min(300, bpm)); // Clamp BPM between 60 and 300
                    bpmValueElement.textContent = bpm;
                    
                    // Update pipe interval based on BPM (faster BPM = more frequent pipes)
                    pipeInterval = 60000 / bpm * 2; // 2 beats per pipe (every other beat)
                }
            }
            lastClapTime = now;
        }
    }
}

function drawPipes() {
    ctx.fillStyle = '#ffffffff';
    
    for (const pipe of pipes) {
        // Top pipe
        ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapY);
        
        // Bottom pipe
        const bottomPipeY = pipe.gapY + pipe.gap;
        ctx.fillRect(pipe.x, bottomPipeY, pipe.width, canvas.height - bottomPipeY);
        
        // Pipe caps
        ctx.fillStyle = '#868686ff';
        ctx.fillRect(pipe.x - 5, pipe.gapY - 20, pipe.width + 10, 20);
        ctx.fillRect(pipe.x - 5, bottomPipeY, pipe.width + 10, 20);
        ctx.fillStyle = '#9f9f9fff';
    }
}

function checkCollisions() {
    // Check collision with pipes
    for (const pipe of pipes) {
        // Check if bird is within pipe width
        if (bird.x + bird.width > pipe.x && bird.x < pipe.x + pipe.width) {
            // Check if bird is in the gap
            if (bird.y < pipe.gapY || bird.y + bird.height > pipe.gapY + pipe.gap) {
                endGame();
                return;
            }
        }
    }
}

function endGame() {
    if (gameOver) return; // Prevent multiple triggers
    
    gameOver = true;
    playSound('hit');
    
    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappyHighScore', highScore);
    }
    
    // Remove any existing game over screen
    const existingGameOver = document.querySelector('#game-over-screen');
    if (existingGameOver) {
        existingGameOver.remove();
    }
    
    // Show game over screen
    const gameOverDiv = document.createElement('div');
    gameOverDiv.id = 'game-over-screen';
    gameOverDiv.style.position = 'absolute';
    gameOverDiv.style.top = '50%';
    gameOverDiv.style.left = '50%';
    gameOverDiv.style.transform = 'translate(-50%, -50%)';
    gameOverDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gameOverDiv.style.color = 'white';
    gameOverDiv.style.padding = '20px';
    gameOverDiv.style.borderRadius = '10px';
    gameOverDiv.style.textAlign = 'center';
    gameOverDiv.style.zIndex = '100';
    
    gameOverDiv.innerHTML = `
        <h2>Game Over!</h2>
        <p>Score: ${score}</p>
        <p>High Score: ${highScore}</p>
        <button id="restart-button" style="margin-top: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer;">
            Play Again
        </button>
    `;
    
    document.getElementById('game-container').appendChild(gameOverDiv);
    
    // Add restart button event listener
    document.getElementById('restart-button').addEventListener('click', () => {
        gameOverDiv.remove();
        resetGame();
        gameLoop();
    });
}

// Initialize microphone for clap detection
async function initMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        
        microphone.connect(analyser);
        analyser.fftSize = 256;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const micLevel = document.getElementById('mic-level');
        const micStatusText = document.getElementById('mic-status-text');
        
        // Update mic status
        micStatusText.textContent = 'Microphone: Active';
        
        // Detect clap (sudden increase in volume)
        let lastVolume = 0;
        let isClapping = false;
        
        function detectClap() {
            analyser.getByteFrequencyData(dataArray);
            
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            
            const average = sum / bufferLength;
            const threshold = 50; // Adjust this value based on testing
            
            // Update visualizer
            const normalizedLevel = Math.min(100, Math.max(0, (average / 255) * 200)); // Scale to 0-100%
            micLevel.style.width = `${normalizedLevel}%`;
            
            // Change color based on volume level
            if (normalizedLevel > 80) {
                micLevel.style.background = 'linear-gradient(90deg, #f44336, #ff9800)';
            } else if (normalizedLevel > 50) {
                micLevel.style.background = 'linear-gradient(90deg, #ffc107, #ff9800)';
            } else {
                micLevel.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
            }
            
            // If volume increases suddenly above threshold, it's a clap
            if (average - lastVolume > threshold && average > 30) {
                if (gameStarted && !gameOver) {
                    bird.jump();
                    isClapping = true;
                    // Reset clap state after a short delay
                    setTimeout(() => { isClapping = false; }, 200);
                }
            }
            
            // Visual feedback when clap is detected
            if (isClapping) {
                micLevel.style.boxShadow = '0 0 10px 2px rgba(255, 255, 255, 0.8)';
            } else {
                micLevel.style.boxShadow = 'none';
            }
            
            lastVolume = average * 0.7; // Smoothing factor
            
            requestAnimationFrame(detectClap);
        }
        
        detectClap();
        micStatusText.textContent = 'Microphone: Active';
        
    } catch (err) {
        console.error('Error accessing microphone:', err);
        document.getElementById('mic-status-text').textContent = 'Microphone access denied. Using spacebar to jump.';
        document.getElementById('mic-level').style.background = '#f44336';
        
        // Fallback to spacebar if microphone is not available
        document.addEventListener('keydown', (e) => {
            if ((e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') && gameStarted && !gameOver) {
                bird.jump();
            }
        });
    }
}

// Initialize the bird
bird.init();

// Start button event listener
startButton.addEventListener('click', () => {
    init();
    initMicrophone();
});

// Also allow spacebar to start/restart the game
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        if (!gameStarted) {
            init();
            initMicrophone();
        } else if (gameOver) {
            const gameOverDiv = document.querySelector('#game-over-screen');
            if (gameOverDiv) {
                gameOverDiv.remove();
            }
            resetGame();
            gameLoop();
        }
    }
});

// Preload sounds
window.addEventListener('load', () => {
    // Preload sounds
    Object.values(sounds).forEach(sound => {
        sound.load();
        sound.volume = 0.3; // Lower volume for better experience
    });
    
    // Show start screen with instructions
    startScreen.style.display = 'flex';
});
