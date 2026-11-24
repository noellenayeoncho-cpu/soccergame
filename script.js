const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

const playerScoreElement = document.getElementById("playerScore");
const robotScoreElement = document.getElementById("robotScore");
const timerElement = document.getElementById("timer");
const messageElement = document.getElementById("message");
const startButton = document.getElementById("startButton");

const keys = {};

let gameState = "menu";
let playerScore = 0;
let robotScore = 0;
let matchTime = 120;
let lastTime = 0;
let kickoffTimer = 0;

const CORNER_RADIUS = 75;
const CORNER_BOOST = 1.8;
const CORNER_MIN_SPEED = 12;
const MAX_BALL_SPEED = 18;

const corners = [
    { x: 10, y: 10, sx: 1, sy: 1, start: 0 },
    { x: WIDTH - 10, y: 10, sx: -1, sy: 1, start: Math.PI / 2 },
    { x: WIDTH - 10, y: HEIGHT - 10, sx: -1, sy: -1, start: Math.PI },
    { x: 10, y: HEIGHT - 10, sx: 1, sy: -1, start: Math.PI * 1.5 }
];

// Player images (put the PNGs in an "images" folder next to your HTML file)
const player1Image = new Image();
player1Image.src = "images/player1.png";

const player2Image = new Image();
player2Image.src = "images/player2.png";

const player = {
    x: 300,
    y: CENTER_Y,
    radius: 25,
    speed: 5,
    color: "#38a9e8",
    number: "1",
    image: player1Image
};

const robot = {
    x: 900,
    y: CENTER_Y,
    radius: 27,
    speed: 3.1,
    color: "#e45a50",
    number: "2",
    image: player2Image
};

const ball = {
    x: CENTER_X,
    y: CENTER_Y,
    radius: 13,
    vx: 0,
    vy: 0,
    friction: 0.992,
    bounce: 0.85
};

// Reset positions after kickoff or a goal
function resetPositions() {
    ball.x = CENTER_X;
    ball.y = CENTER_Y;
    ball.vx = 2.5;
    ball.vy = 0.8;

    player.x = 300;
    player.y = CENTER_Y;

    robot.x = 900;
    robot.y = CENTER_Y;

    kickoffTimer = 2.5;
}

// Start/restart game
function startGame() {
    playerScore = 0;
    robotScore = 0;
    matchTime = 120;

    updateScoreboard();
    resetPositions();

    gameState = "playing";

    messageElement.textContent = "Kickoff!";
    startButton.style.display = "none";

    lastTime = 0;
}

// Keyboard controls
document.addEventListener("keydown", function(event) {
    const key = event.key.toLowerCase();

    keys[key] = true;

    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
    }
});

document.addEventListener("keyup", function(event) {
    keys[event.key.toLowerCase()] = false;
});

// Release all keys when the window loses focus
window.addEventListener("blur", function() {
    for (const k in keys) keys[k] = false;
});

function movePlayer(dt) {
    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) dy--;
    if (keys["s"] || keys["arrowdown"]) dy++;
    if (keys["a"] || keys["arrowleft"]) dx--;
    if (keys["d"] || keys["arrowright"]) dx++;

    if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
    }

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    keepInsideField(player);
}

function moveRobot(dt) {
    // Robot attacks the LEFT goal, so it first gets to the right of the ball
    let tx = ball.x;
    let ty = ball.y;

    if (robot.x < ball.x + 25) {
        tx = ball.x + 70;
        ty = ball.y + (robot.y < ball.y ? -40 : 40);
    }

    const dx = tx - robot.x;
    const dy = ty - robot.y;
    const distance = Math.hypot(dx, dy);

    if (distance > 1) {
        robot.x += dx / distance * robot.speed * dt;
        robot.y += dy / distance * robot.speed * dt;
    }

    keepInsideField(robot);
}

function keepInsideField(object) {
    object.x = Math.max(
        object.radius + 10,
        Math.min(WIDTH - object.radius - 10, object.x)
    );

    object.y = Math.max(
        object.radius + 10,
        Math.min(HEIGHT - object.radius - 10, object.y)
    );
}

// Special corner bounce
function hitCornerKick() {
    const collisionRadius = CORNER_RADIUS + ball.radius;

    for (const corner of corners) {
        const dx = ball.x - corner.x;
        const dy = ball.y - corner.y;

        if (dx * corner.sx < 0 || dy * corner.sy < 0) {
            continue;
        }

        const distance = Math.sqrt(dx * dx + dy * dy);

        if (
            distance < collisionRadius &&
            distance > 0 &&
            distance > CORNER_RADIUS - ball.radius
        ) {
            const nx = dx / distance;
            const ny = dy / distance;

            ball.x = corner.x + nx * collisionRadius;
            ball.y = corner.y + ny * collisionRadius;

            const velocityTowardCorner = ball.vx * nx + ball.vy * ny;

            if (velocityTowardCorner < 0) {
                ball.vx -= 2 * velocityTowardCorner * nx;
                ball.vy -= 2 * velocityTowardCorner * ny;

                ball.vx *= CORNER_BOOST;
                ball.vy *= CORNER_BOOST;

                const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

                if (speed < CORNER_MIN_SPEED) {
                    const scale = CORNER_MIN_SPEED / Math.max(speed, 0.001);

                    ball.vx *= scale;
                    ball.vy *= scale;
                }
            }
        }
    }
}

// Ball movement and field collisions
function updateBall(dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    ball.vx *= Math.pow(ball.friction, dt);
    ball.vy *= Math.pow(ball.friction, dt);

    hitCornerKick();

    // Cap ball speed so it can't tunnel through players
    const spd = Math.hypot(ball.vx, ball.vy);
    if (spd > MAX_BALL_SPEED) {
        ball.vx *= MAX_BALL_SPEED / spd;
        ball.vy *= MAX_BALL_SPEED / spd;
    }

    // Top wall
    if (ball.y - ball.radius < 10) {
        ball.y = 10 + ball.radius;
        ball.vy = Math.abs(ball.vy) * ball.bounce;
    }

    // Bottom wall
    if (ball.y + ball.radius > HEIGHT - 10) {
        ball.y = HEIGHT - 10 - ball.radius;
        ball.vy = -Math.abs(ball.vy) * ball.bounce;
    }

    const goalTop = HEIGHT / 2 - 100;
    const goalBottom = HEIGHT / 2 + 100;

    // Left goal
    if (ball.x - ball.radius < 10) {
        if (ball.y > goalTop && ball.y < goalBottom) {
            scoreGoal("robot");
            return;
        }

        ball.x = 10 + ball.radius;
        ball.vx = Math.abs(ball.vx) * ball.bounce;
    }

    // Right goal
    if (ball.x + ball.radius > WIDTH - 10) {
        if (ball.y > goalTop && ball.y < goalBottom) {
            scoreGoal("player");
            return;
        }

        ball.x = WIDTH - 10 - ball.radius;
        ball.vx = -Math.abs(ball.vx) * ball.bounce;
    }
}

// Player-ball collision
function collide(object) {
    let dx = ball.x - object.x;
    let dy = ball.y - object.y;
    let dist = Math.hypot(dx, dy);
    const minDist = ball.radius + object.radius;

    if (dist >= minDist) return;

    if (dist === 0) {
        dx = 1;
        dy = 0;
        dist = 1;
    }

    const nx = dx / dist;
    const ny = dy / dist;

    // Move ball outside player
    ball.x += nx * (minDist - dist);
    ball.y += ny * (minDist - dist);

    // Reflect the part of the velocity heading into the player
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
        ball.vx -= 1.6 * vn * nx;
        ball.vy -= 1.6 * vn * ny;
    }

    // Top up to kick speed instead of stacking it every frame
    const kickPower = object === player ? 9 : 7;
    const vn2 = ball.vx * nx + ball.vy * ny;
    if (vn2 < kickPower) {
        ball.vx += nx * (kickPower - vn2);
        ball.vy += ny * (kickPower - vn2);
    }
}

// Goal scoring
function scoreGoal(team) {
    if (team === "player") {
        playerScore++;
        messageElement.textContent = "GOAL! Player 1";
    } else {
        robotScore++;
        messageElement.textContent = "GOAL! Player 2";
    }

    updateScoreboard();
    resetPositions();
}

// Update scoreboard
function updateScoreboard() {
    playerScoreElement.textContent = playerScore;
    robotScoreElement.textContent = robotScore;

    const minutes = Math.floor(matchTime / 60);
    const seconds = Math.floor(matchTime % 60);

    timerElement.textContent = minutes + ":" + String(seconds).padStart(2, "0");
}

// End game
function endGame() {
    gameState = "over";

    if (playerScore > robotScore) {
        messageElement.textContent = "Player 1 wins!";
    } else if (robotScore > playerScore) {
        messageElement.textContent = "Player 2 wins!";
    } else {
        messageElement.textContent = "It's a tie!";
    }

    startButton.textContent = "PLAY AGAIN";
    startButton.style.display = "block";
}

// Game update
function update(dt) {
    if (gameState !== "playing") return;

    // Countdown timer (120 seconds)
    matchTime -= dt / 60;

    if (matchTime <= 0) {
        matchTime = 0;
        updateScoreboard();
        endGame();
        return;
    }

    // Kickoff pause
    if (kickoffTimer > 0) {
        kickoffTimer -= dt / 60;

        if (kickoffTimer <= 0) messageElement.textContent = "";

        updateBall(dt);
        updateScoreboard();

        return;
    }

    movePlayer(dt);
    moveRobot(dt);
    updateBall(dt);

    collide(player);
    collide(robot);

    updateScoreboard();
}

// Draw soccer field
function drawField() {
    // Grass
    ctx.fillStyle = "#397c42";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Grass stripes
    const stripeWidth = WIDTH / 10;

    for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
            ctx.fillStyle = "rgba(255,255,255,0.035)";
            ctx.fillRect(i * stripeWidth, 0, stripeWidth, HEIGHT);
        }
    }

    // Field boundary
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;

    ctx.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20);

    // Center line
    ctx.beginPath();
    ctx.moveTo(CENTER_X, 10);
    ctx.lineTo(CENTER_X, HEIGHT - 10);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 100, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = "white";

    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    ctx.strokeRect(10, CENTER_Y - 170, 170, 340);
    ctx.strokeRect(WIDTH - 180, CENTER_Y - 170, 170, 340);

    // Goal areas
    ctx.strokeRect(10, CENTER_Y - 90, 65, 180);
    ctx.strokeRect(WIDTH - 75, CENTER_Y - 90, 65, 180);

    // Goal posts
    ctx.fillStyle = "#d6d6d0";

    ctx.fillRect(0, CENTER_Y - 100, 15, 200);
    ctx.fillRect(WIDTH - 15, CENTER_Y - 100, 15, 200);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;

    ctx.strokeRect(0, CENTER_Y - 100, 35, 200);
    ctx.strokeRect(WIDTH - 35, CENTER_Y - 100, 35, 200);

    // Corner arcs
    ctx.strokeStyle = "#e8d36b";
    ctx.lineWidth = 4;

    for (const corner of corners) {
        ctx.beginPath();

        ctx.arc(
            corner.x,
            corner.y,
            CORNER_RADIUS,
            corner.start,
            corner.start + Math.PI / 2
        );

        ctx.stroke();
    }
}

// Draw players using PNG images
function drawPlayer(object, label) {
    ctx.save();

    // Shadow
    ctx.beginPath();

    ctx.fillStyle = "rgba(0,0,0,0.22)";

    ctx.ellipse(
        object.x + 3,
        object.y + 7,
        object.radius + 2,
        object.radius * 0.65,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    // Use player image if it loads
    if (object.image.complete && object.image.naturalWidth > 0) {
        ctx.drawImage(
            object.image,
            object.x - object.radius,
            object.y - object.radius,
            object.radius * 2,
            object.radius * 2
        );
    } else {
        // Fallback circle
        ctx.beginPath();

        ctx.fillStyle = object.color;
        ctx.arc(object.x, object.y, object.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = "white";
        ctx.font = "bold 17px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(object.number, object.x, object.y);
    }

    // Player label
    ctx.fillStyle = "white";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;

    ctx.fillText(
        label,
        object.x,
        object.y - object.radius - 13
    );

    ctx.restore();
}

// Draw ball
function drawBall() {
    ctx.save();

    // Ball shadow
    ctx.beginPath();

    ctx.fillStyle = "rgba(0,0,0,0.2)";

    ctx.ellipse(
        ball.x + 3,
        ball.y + 5,
        ball.radius,
        ball.radius * 0.65,
        0,
        0,
        Math.PI * 2
    );

    ctx.fill();

    // Ball
    ctx.beginPath();

    ctx.fillStyle = "#f5f5ed";
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ball markings
    ctx.fillStyle = "#292929";

    for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;

        const x = ball.x + Math.cos(angle) * 6;
        const y = ball.y + Math.sin(angle) * 6;

        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// Detect corner position
function ballIsInCorner() {
    const cornerDistance = 90;

    const nearLeft = ball.x < cornerDistance;
    const nearRight = ball.x > WIDTH - cornerDistance;
    const nearTop = ball.y < cornerDistance;
    const nearBottom = ball.y > HEIGHT - cornerDistance;

    return (nearLeft || nearRight) && (nearTop || nearBottom);
}

// Draw everything
function draw() {
    drawField();

    if (ballIsInCorner()) {
        drawBall();
        drawPlayer(player, "PLAYER 1");
        drawPlayer(robot, "PLAYER 2");
    } else {
        drawPlayer(player, "PLAYER 1");
        drawPlayer(robot, "PLAYER 2");
        drawBall();
    }

    // Menu screen
    if (gameState === "menu") {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "bold 48px Arial";

        ctx.fillText("SOCCER", CENTER_X, CENTER_Y - 45);

        ctx.font = "20px Arial";

        ctx.fillText("PLAYER 1  vs  PLAYER 2", CENTER_X, CENTER_Y + 5);

        ctx.font = "16px Arial";

        ctx.fillText("120 SECOND MATCH", CENTER_X, CENTER_Y + 38);
    }

    // Full-time screen
    if (gameState === "over") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "bold 48px Arial";

        ctx.fillText("FULL TIME", CENTER_X, CENTER_Y - 25);

        ctx.font = "25px Arial";

        ctx.fillText(
            playerScore + "  -  " + robotScore,
            CENTER_X,
            CENTER_Y + 25
        );
    }

    // Kickoff message
    if (gameState === "playing" && kickoffTimer > 0) {
        ctx.save();

        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "bold 28px Arial";

        ctx.shadowColor = "black";
        ctx.shadowBlur = 4;

        ctx.fillText("KICKOFF", CENTER_X, CENTER_Y - 65);

        ctx.restore();
    }
}

// Main game loop
function loop(timestamp) {
    const dt = lastTime
        ? Math.min((timestamp - lastTime) / (1000 / 60), 2)
        : 1;

    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(loop);
}

// Start button
startButton.addEventListener("click", startGame);

// Initialize
resetPositions();
updateScoreboard();
draw();

requestAnimationFrame(loop);