const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let board = Array.from({ length: 10 }, () => Array(10).fill(null));
let turnOrder = [];
let currentPlayerIndex = 0;
let round = 0; // Initialize the round counter
let removedMonstersCount = [0, 0]; // Initialize removed monsters count for two players
let players = [];

app.use(express.static('public'));

io.on('connection', (socket) => {
   
    players.push({ id: socket.id, removedCount: 0 });

    if (players.length === 2) {
        initializeTurnOrder();
        startNextTurn();
    }
    
    // Send initial board state and player index
    socket.emit('updateBoard', board);
    socket.emit('updateRemovedMonstersCount', removedMonstersCount);
    socket.emit('setPlayerIndex', players.length - 1); // Ensure this is a number

    io.emit('setTurn', currentPlayerIndex);

    socket.on('placeMonster', ({ type, row, col }) => {
        if (!board[row][col]) { // Check if the square is empty
            if (isValidPlacement(type, row, col, currentPlayerIndex)) {
                board[row][col] = { type, player: currentPlayerIndex, justPlaced: true };
                io.emit('updateBoard', board);
            }
        }
    });
    
    // Send initial board state
    socket.emit('updateBoard', board);

    socket.on('moveMonster', ({ fromRow, fromCol, toRow, toCol }) => {
        const movingMonster = board[fromRow][fromCol];
        const targetSquare = board[toRow][toCol];
    
        // Check if the move is valid
        if (isValidMove(movingMonster, fromRow, fromCol, toRow, toCol)) {
            if (targetSquare) {
                // Handle conflict resolution
                if (movingMonster.player !== targetSquare.player) {
                    const conflictResult = resolveConflict(movingMonster, targetSquare);
                    if (conflictResult === null) {
                        removedMonstersCount[movingMonster.player]++;
                        removedMonstersCount[targetSquare.player]++;
                    } else if (conflictResult.player !== movingMonster.player) {
                        removedMonstersCount[movingMonster.player]++;
                    } else {
                        removedMonstersCount[targetSquare.player]++;
                    }
                    board[toRow][toCol] = conflictResult;
                } else {
                    return; // Cannot move to a square occupied by your own monster
                }
            } else {
                board[toRow][toCol] = movingMonster;
            }
            board[fromRow][fromCol] = null;
            io.emit('updateBoard', board);
            io.emit('updateRemovedMonstersCount', removedMonstersCount);
            checkWinLoss();
        }
    });

     socket.on('endTurn', () => {
        // Reset justPlaced property
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
                if (board[i][j] && board[i][j].player === currentPlayerIndex) {
                    board[i][j].justPlaced = false;
                }
            }
        }
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        io.emit('setTurn', currentPlayerIndex);
        if (currentPlayerIndex === 0) {
            round++;
            io.emit('updateRound', round); // Notify clients of the new round
        }

        io.emit('updateBoard', board);
    });
      

   socket.on('disconnect', () => {
        console.log('A user disconnected');
        players = players.filter(player => player !== socket);
        if (currentPlayerIndex >= players.length) {
            currentPlayerIndex = 0;
        }
        io.emit('setTurn', currentPlayerIndex);
    });

    // Store player index in the socket's data
    socket.on('setPlayerIndex', (index) => {
      socket.playerIndex = index;
      console.log('My player index is:', myIndex);
    });

    socket.on('chatMessage', (data) => {
        const message = `Player ${data.playerIndex + 1}: ${data.message}`;
    
        // Broadcast the message to all connected clients
        io.emit('chatMessage', message);
    });
    

});
function initializeTurnOrder() {
    const monsterCounts = players.map((player, index) => ({
        index,
        count: board.flat().filter((cell) => cell && cell.player === index).length,
    }));

    monsterCounts.sort((a, b) => a.count - b.count || Math.random() - 0.5);
    turnOrder = monsterCounts.map((player) => player.index);
    currentPlayerIndex = 0;
}

function startNextTurn() {
    const nextPlayer = turnOrder[currentPlayerIndex];
    players.forEach((player, index) => {
        io.to(player.id).emit(index === nextPlayer ? 'yourTurn' : 'opponentsTurn');
    });
}

function isValidPlacement(type, row, col, playerIndex) {
    if (playerIndex === 0 && row !== 0) return false; // Player 1 can only place on row 0
    if (playerIndex === 1 && row !== 9) return false; // Player 2 can only place on row 9
    return true;
}

function resolveConflict(monster1, monster2) {
    if (monster1.type === 'vampire' && monster2.type === 'werewolf') {
        return monster1;
    } else if (monster1.type === 'werewolf' && monster2.type === 'vampire') {
        return monster2;
    } else if (monster1.type === 'werewolf' && monster2.type === 'ghost') {
        return monster1;
    } else if (monster1.type === 'ghost' && monster2.type === 'werewolf') {
        return monster2;
    } else if (monster1.type === 'ghost' && monster2.type === 'vampire') {
        return monster1;
    } else if (monster1.type === 'vampire' && monster2.type === 'ghost') {
        return monster2;
    } else {
        // If two monsters of the same type, both are removed
        return null;
    }
}

function isValidMove(monster, fromRow, fromCol, toRow, toCol) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    // Horizontal or vertical move
    if (rowDiff === 0 || colDiff === 0) {
        return true;
    }

    // Diagonal move up to 2 squares
    if (rowDiff === colDiff && rowDiff <= 2) {
        return true;
    }

    return false;
}

function checkWinLoss() {
    for (let i = 0; i < players.length; i++) {
        if (removedMonstersCount[i] >= 10) {
            io.emit('gameOver', i === 0 ? 1 : 0); // Notify clients of the winning player index
            break;
        }
    }
}

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
