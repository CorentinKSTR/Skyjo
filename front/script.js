let room = '';
let playerName = '';
let drawnCard = null;
let chosenCardSource = null;
let turnPhase = 'initial'; // Indicates the current phase: 'initial' or 'main'
let cardDrawnThisTurn = false; // To track if a card has been drawn this turn
let discardPhase = false; // To track if we're in the discard phase
const roomArea = document.querySelector('#room');
const playerCards = document.querySelector('#player-cards');
const opponentCards = document.querySelector('#opponent-cards');
const discardCard = document.querySelector('#discard-card');
const gameArea = document.querySelector('#game');
const loginArea = document.querySelector('#login');
const playerArea = document.querySelector('.player');
const opponentArea = document.querySelector('.opponent');
const playerScore = document.querySelector('#player-score');
const opponentScore = document.querySelector('#opponent-score');
const socket = io('http://localhost:3000/');
// const socket = io('https://skyjo-tz8i.onrender.com/');

document.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    connect();
});

socket.on('connect', () => {
    console.log('Connected');
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});

socket.on('gameStart', (data) => {
    loginArea.style.display = 'none';
    gameArea.style.display = 'flex';
    turnPhase = 'initial';
    updateGameBoard(data);
});

socket.on('gameUpdate', (data) => {
    updateGameBoard(data);
});

socket.on('drawnCard', (card) => {
    drawnCard = card;
    chosenCardSource = 'draw';
    cardDrawnThisTurn = true;
    document.querySelector('#drawn-card').innerHTML = `<img src="assets/${card}.png" draggable="false"/>`;
});

socket.on('discardCardChosen', (card) => {
    drawnCard = card;
    chosenCardSource = 'discard';
    cardDrawnThisTurn = true;
    document.querySelector('#drawn-card').innerHTML = `<img src="assets/${card}.png" draggable="false"/>`;
});

socket.on('updateTurn', (playerId) => {
    turnPhase = 'main';
    drawnCard = null; // Reset drawn card at the start of a new turn
    cardDrawnThisTurn = false; // Reset card drawn flag at the start of a new turn
    discardPhase = false; // Reset discard phase
    document.querySelector('#drawn-card').innerHTML = '';
    highlightCurrentPlayer(playerId);
});

let connect = () => {
    playerName = document.querySelector('#name').value;
    room = roomArea.value;
    socket.emit('join', room, playerName);
}

const updateGameBoard = (data) => {
    playerCards.innerHTML = '';
    createCardColumns(data.players[socket.id].hand, playerCards);

    const opponentId = Object.keys(data.players).find(id => id !== socket.id);
    opponentCards.innerHTML = '';
    createCardColumns(data.players[opponentId].hand, opponentCards);

    discardCard.innerHTML = `<img src="assets/${data.discardPile[data.discardPile.length - 1]}.png" draggable="false"/>` || '';

    playerScore.innerText = `${data.players[socket.id].name}'s Score: ${data.players[socket.id].score}`;
    opponentScore.innerText = `${data.players[opponentId].name}'s Score: ${data.players[opponentId].score}`;

    highlightCurrentPlayer(data.currentPlayer);
}

const createCardColumns = (hand, container) => {
    const columns = [[], [], [], []];

    hand.forEach((card, index) => {
        const colIndex = index % 4;
        if (card) {
            columns[colIndex].push(card);
        }
    });

    columns.forEach((column, colIndex) => {
        const columnElement = document.createElement('div');
        columnElement.classList.add('colonne');
        columnElement.setAttribute('data-col', colIndex);

        column.forEach((card, rowIndex) => {
            if (card) {
                const cardElement = document.createElement('div');
                cardElement.classList.add('card');
                cardElement.innerHTML = `<img src="assets/${card.visible ? card.value : 'back'}.png" draggable="false"/>`;
                cardElement.id = `card-${colIndex}-${rowIndex}`;
                cardElement.onclick = () => cardClickHandler(colIndex, rowIndex, card.visible);
                columnElement.appendChild(cardElement);
            }
        });

        container.appendChild(columnElement);
    });
}

const cardClickHandler = (colIndex, rowIndex, visible) => {
    const index = colIndex + rowIndex * 4;
    console.log(`Card at column ${colIndex}, row ${rowIndex} clicked`);  // Log pour vérifier le clic
    if (turnPhase === 'initial') {
        console.log("Entering reveal phase")
        socket.emit('revealCard', room, index);
    } else if (turnPhase === 'main') {
        if (!isPlayerTurn()) return; // Bloquer les actions si ce n'est pas le tour du joueur
        if (discardPhase) {
            if (!visible) {
                console.log("Entering reveal after discard phase")
                socket.emit('revealCardAfterDiscard', room, index);
                discardPhase = false; // Reset discard phase after revealing
            } else {
                alert("You can only reveal a card that is face down.");
            }
        } else {
            console.log("Entering swap phase")
            if (drawnCard !== null) {
                swapCard(index);
            } else {
                alert("Draw or choose a card first!");
            }
        }
    }
}

const drawCard = () => {
    if (!isPlayerTurn()) return; // Bloquer les actions si ce n'est pas le tour du joueur
    if (!cardDrawnThisTurn) {
        socket.emit('drawCard', room);
    } else {
        alert("You can only draw one card per turn!");
    }
}

const handleDiscardClick = () => {
    if (!isPlayerTurn()) return; // Bloquer les actions si ce n'est pas le tour du joueur
    if (drawnCard !== null) {
        // Discard the drawn card and allow player to reveal a card
        socket.emit('discardDrawnCard', room, drawnCard);
        discardPhase = true; // Enter discard phase
        drawnCard = null;
        chosenCardSource = null;
        document.querySelector('#drawn-card').innerHTML = '';
    } else {
        if (!cardDrawnThisTurn) {
            socket.emit('takeDiscard', room);
        } else {
            alert("You can only draw one card per turn!");
        }
    }
}

const swapCard = (index) => {
    if (!isPlayerTurn()) return; // Bloquer les actions si ce n'est pas le tour du joueur
    if (drawnCard !== null) {
        socket.emit('swapCard', room, index, drawnCard, chosenCardSource);
        drawnCard = null;
        chosenCardSource = null;
        document.querySelector('#drawn-card').innerHTML = '';
    } else {
        alert("Draw or choose a card first!");
    }
}

const highlightCurrentPlayer = (playerId) => {
    if (turnPhase !== 'initial') {
        if (socket.id === playerId) {
            playerArea.style.background = 'rgba(0, 186, 81, 0.31)';
            opponentArea.style.background = 'none';
        } else {
            playerArea.style.background = 'none';
            opponentArea.style.background = 'rgba(255, 0, 0, 0.31)';
        }
    }
}

const isPlayerTurn = () => {
    return document.querySelector('.player').style.background === 'rgba(0, 186, 81, 0.31)';
}
