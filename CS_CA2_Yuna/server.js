const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let board = Array.from({ length: 10 }, () => Array(10).fill(null));
let turnOrder = [];
let currentPlayerIndex = 0;
let round = 1;
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

  