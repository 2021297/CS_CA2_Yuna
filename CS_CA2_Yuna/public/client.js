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
  