const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Configurações da bola
const INITIAL_BALL_SPEED = 3;
const BALL_ACCELERATION = 1.1;
const MAX_BALL_SPEED = 15;

const gameState = {
    ball: {
        x: 400,
        y: 200,
        speedX: INITIAL_BALL_SPEED,
        speedY: INITIAL_BALL_SPEED,
        size: 10,
        currentSpeed: INITIAL_BALL_SPEED
    },
    paddles: {
        player1: {
            y: 160,
            score: 0
        },
        player2: {
            y: 160,
            score: 0
        }
    },
    gameStarted: false
};

let players = [];

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    if (players.length >= 2) {
        socket.emit('gameFull', 'Jogo já tem 2 jogadores');
        socket.disconnect();
        return;
    }

    const playerNumber = players.length + 1;
    players.push({
        id: socket.id,
        number: playerNumber
    });

    socket.emit('playerNumber', playerNumber);
    
    io.emit('playersUpdate', {
        bothConnected: players.length === 2
    });

    socket.on('startGame', () => {
        const player = players.find(p => p.id === socket.id);
        if (player && player.number === 1 && players.length === 2) {
            gameState.gameStarted = true;
            resetBall();
            io.emit('gameStart', gameState);
        }
    });

    socket.on('paddleMove', (data) => {
        const player = players.find(p => p.id === socket.id);
        if (player && gameState.gameStarted) {
            if (player.number === 1) {
                gameState.paddles.player1.y = data.y;
            } else {
                gameState.paddles.player2.y = data.y;
            }
            io.emit('gameStateUpdate', gameState);
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        players = players.filter(p => p.id !== socket.id);
        gameState.gameStarted = false;
        gameState.paddles.player1.score = 0;
        gameState.paddles.player2.score = 0;
        resetBall();
        io.emit('playerDisconnected');
        io.emit('playersUpdate', {
            bothConnected: players.length === 2
        });
    });
});

// Reset da bola com direção baseada no último ponto
function resetBall(scoringPlayer = null) {
    gameState.ball.x = 400;
    gameState.ball.y = 200;
    gameState.ball.currentSpeed = INITIAL_BALL_SPEED;

    // Direção aleatória vertical
    const randomVertical = Math.random() * 2 - 1; // valor entre -1 e 1
    
    if (scoringPlayer === 1) {
        // Bola vai em direção ao Player 1 (esquerda)
        gameState.ball.speedX = -INITIAL_BALL_SPEED;
    } else if (scoringPlayer === 2) {
        // Bola vai em direção ao Player 2 (direita)
        gameState.ball.speedX = INITIAL_BALL_SPEED;
    } else {
        // Direção horizontal aleatória no início do jogo
        gameState.ball.speedX = Math.random() > 0.5 ? INITIAL_BALL_SPEED : -INITIAL_BALL_SPEED;
    }
    
    gameState.ball.speedY = INITIAL_BALL_SPEED * randomVertical;
}

setInterval(() => {
    if (gameState.gameStarted && players.length === 2) {
        // Atualiza posição da bola
        gameState.ball.x += gameState.ball.speedX;
        gameState.ball.y += gameState.ball.speedY;

        // Colisão com paredes (topo e base)
        if (gameState.ball.y <= 0 || gameState.ball.y >= 400) {
            gameState.ball.speedY *= -1;
        }

        // Colisão com paddles
        if (gameState.ball.x <= 30 && 
            gameState.ball.y >= gameState.paddles.player1.y && 
            gameState.ball.y <= gameState.paddles.player1.y + 80) {
            // Inverte direção X
            gameState.ball.speedX *= -1;
            
            // Aumenta velocidade
            const newSpeed = Math.min(gameState.ball.currentSpeed * BALL_ACCELERATION, MAX_BALL_SPEED);
            const speedRatio = newSpeed / gameState.ball.currentSpeed;
            
            gameState.ball.currentSpeed = newSpeed;
            gameState.ball.speedX *= speedRatio;
            gameState.ball.speedY *= speedRatio;
        }

        if (gameState.ball.x >= 760 && 
            gameState.ball.y >= gameState.paddles.player2.y && 
            gameState.ball.y <= gameState.paddles.player2.y + 80) {
            // Inverte direção X
            gameState.ball.speedX *= -1;
            
            // Aumenta velocidade
            const newSpeed = Math.min(gameState.ball.currentSpeed * BALL_ACCELERATION, MAX_BALL_SPEED);
            const speedRatio = newSpeed / gameState.ball.currentSpeed;
            
            gameState.ball.currentSpeed = newSpeed;
            gameState.ball.speedX *= speedRatio;
            gameState.ball.speedY *= speedRatio;
        }

        // Pontuação
        if (gameState.ball.x <= 0) {
            gameState.paddles.player2.score++;
            resetBall(2); // Bola vai em direção ao Player 2
        } else if (gameState.ball.x >= 800) {
            gameState.paddles.player1.score++;
            resetBall(1); // Bola vai em direção ao Player 1
        }

        io.emit('gameStateUpdate', gameState);
    }
}, 1000/60);

// server.listen(3000, () => {
//     console.log('Server running on http://localhost:3000');
// });

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});