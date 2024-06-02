const socket = io();

let playerName = prompt('Enter your name');
let currentPlayer = null;
let selectedMonster = null;
let isMyTurn = false;
let myIndex = null;
let selectedSquare = null;
let board = Array.from({ length: 10 }, () => Array(10).fill(null));

// Function to generate and render the board
function renderBoard(board) {
    const boardDiv = document.getElementById('board');
    boardDiv.innerHTML = ''; // Clear existing board

    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
            const square = document.createElement('div');
            square.className = 'square';
            square.dataset.row = i;
            square.dataset.col = j;

            // Mark player's edges
            if (i === 0) {
                square.classList.add('player1-edge');
               } else if (i === 9) {
                square.classList.add('player2-edge');
               }

            // Check if there is a monster in the current cell and add appropriate class
            if (board[i][j]) {
                square.classList.add(board[i][j].type); // Assuming board[i][j].type is 'vampire', 'werewolf', or 'ghost'
                square.textContent = board[i][j].type.charAt(0).toUpperCase(); // Display first letter of monster type
                if (board[i][j].player === 0) {
                    square.classList.add('player1-monster');
                } else if (board[i][j].player === 1) {
                    square.classList.add('player2-monster');
                }
            }

            boardDiv.appendChild(square);
        }
    }
    // Add player labels
    if (!document.getElementById('player1-label')) {
        const player1Label = document.createElement('div');
        player1Label.id = 'player1-label';
        player1Label.className = 'label';
        player1Label.textContent = 'Player 1';
        boardDiv.appendChild(player1Label);
    }

    if (!document.getElementById('player2-label')) {
        const player2Label = document.createElement('div');
        player2Label.id = 'player2-label';
        player2Label.className = 'label';
        player2Label.textContent = 'Player 2';
        boardDiv.appendChild(player2Label);
    }
}

function calculateValidMoves(row, col) {
    const validMoves = [];

    // Horizontal and vertical moves
    for (let i = 0; i < 10; i++) {
        if (i !== row) validMoves.push({ row: i, col }); // Vertical
        if (i !== col) validMoves.push({ row, col: i }); // Horizontal
    }

    // Diagonal moves (up to 2 squares)
    for (let i = -2; i <= 2; i++) {
        if (i !== 0) {
            if (row + i >= 0 && row + i < 10 && col + i >= 0 && col + i < 10) {
                validMoves.push({ row: row + i, col: col + i });
            }
            if (row + i >= 0 && row + i < 10 && col - i >= 0 && col - i < 10) {
                validMoves.push({ row: row + i, col: col - i });
            }
        }
    }

    return validMoves.filter(move => board[move.row][move.col] === null); // Only return empty squares
}

function highlightValidMoves(validMoves) {
    validMoves.forEach(move => {
        const square = document.querySelector(`.square[data-row="${move.row}"][data-col="${move.col}"]`);
        square.classList.add('valid-move');
    });
}

function clearHighlights() {
    document.querySelectorAll('.valid-move').forEach(square => {
        square.classList.remove('valid-move');
    });
}


// Function to handle square clicks
function handleSquareClick(event) {
    if (isMyTurn && event.target.classList.contains('square')) {
        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);

        if (selectedMonster) {
            if ((myIndex === 0 && row === 0) || (myIndex === 1 && row === 9)) {
                console.log(`Placing monster: ${selectedMonster} at (${row}, ${col})`);
                socket.emit('placeMonster', { type: selectedMonster, row, col });
                selectedMonster = null;
                document.getElementById('monsterAction').textContent = 'Click on a monster to place on the board';
            } else {
                alert('You can only place monsters on your edge');
            }
        } else if (selectedSquare) {
            console.log(`Moving monster from (${selectedSquare.row}, ${selectedSquare.col}) to (${row}, ${col})`);
            socket.emit('moveMonster', {
                fromRow: selectedSquare.row,
                fromCol: selectedSquare.col,
                toRow: row,
                toCol: col
            });
            selectedSquare = null;
            clearHighlights();
        } else {
            const monster = board[row][col];
            if (monster && monster.player === myIndex && !monster.justPlaced) {
                selectedSquare = { row, col };
                console.log(`Selected monster at (${row}, ${col})`);
                const validMoves = calculateValidMoves(row, col);
                highlightValidMoves(validMoves);
            } else if (monster && monster.justPlaced) {
                alert('You cannot move a monster that was just placed');
            }
        }
    }
}

// Event listener for receiving updated board data
socket.on('updateBoard', (boardData) => {
    board = boardData;
    console.log('Updating board with data:', board);
    renderBoard(board);
});

// Client side event listener
socket.on('setPlayerIndex', (index) => {
    if (typeof index === 'number' && !isNaN(index)) {
        myIndex = index;
        document.getElementById('playerIndex').textContent = `You are player ${myIndex + 1}`;
        console.log(`My player index is ${myIndex}`);
    } else {
        console.error('Received an invalid player index:', index);
    }
});



socket.on('setTurn', (currentPlayerIndex) => {
    console.log(`Current player index is ${currentPlayerIndex}`);
    isMyTurn = currentPlayerIndex === myIndex;
    document.getElementById('turnNotification').textContent = isMyTurn ? 'Your turn' : 'Opponent\'s turn';
    document.querySelectorAll('.monster-btn').forEach(button => {
        console.log(`Setting button ${button.dataset.monster} disabled: ${!isMyTurn}`);
        button.disabled = !isMyTurn;
    });
    const endTurnButton = document.getElementById('endTurnButton');
    if (endTurnButton) {
        console.log(`Setting end turn button disabled: ${!isMyTurn}`);
        endTurnButton.disabled = !isMyTurn;
    }
});

socket.on('updateRemovedMonstersCount', (counts) => {
    document.getElementById('player1Removed').textContent = counts[0];
    document.getElementById('player2Removed').textContent = counts[1];
});

socket.on('gameOver', (winnerIndex) => {
    const winnerMessage = `Player ${winnerIndex + 1} wins!`;
    alert(winnerMessage);
    const endTurnButton = document.getElementById('endTurnButton');
    endTurnButton.disabled = true;
    const vampireButton = document.getElementById('monster-btn.vampire');
    vampireButton.disabled = true;
    const werewolfButton = document.getElementById('monster-btn.werewolf');
    werewolfButton.disabled = true;
    const ghostButton = document.getElementById('monster-btn.ghost');
    ghostButton.disabled = true;
});
socket.on('updateStats', (stats) => {
    document.getElementById('totalGames').textContent = stats.totalGames;
    document.getElementById('player1Wins').textContent = stats.wins[0];
    document.getElementById('player2Wins').textContent = stats.wins[1];
    document.getElementById('player1Losses').textContent = stats.losses[0];
    document.getElementById('player2Losses').textContent = stats.losses[1];
});

// Event listener for board clicks
document.getElementById('board').addEventListener('click', handleSquareClick);

// Event listener for monster selection
document.querySelectorAll('.monster-btn').forEach(button => {
    button.addEventListener('click', () => {
       if (isMyTurn) {
           selectedMonster = button.dataset.type;
           console.log(`Selected monster: ${selectedMonster}`); // Debug log
           document.getElementById('monsterAction').textContent = 'Select a place on your side';
       }
    });
});
// Event listener for end turn button
document.getElementById('endTurnButton').addEventListener('click', () => {
    if (isMyTurn) {
        console.log('Ending turn');
        socket.emit('endTurn');
    }
});

// Event listener for submitting chat messages
document.getElementById('chatForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const messageInput = document.getElementById('chatMessage');
    const message = messageInput.value;
    socket.emit('chatMessage', { playerIndex: myIndex, message }); // Include playerIndex
    messageInput.value = '';
});


// Event listener for receiving chat messages
socket.on('chatMessage', (message) => {
    const chatBox = document.getElementById('chatBox');
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
});


// Log initial board setup to ensure the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    socket.emit('requestBoardUpdate'); // Emit an event to request initial board state from the server
});

socket.on('updateRound', (round) => {
    // Code to update the round on the client side
    console.log('Current Round:', round);
});
