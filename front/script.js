let room = '';
let playerName = '';
let drawnCard = null;
let chosenCardSource = null;
let turnPhase = 'initial'; // Indicates the current phase: 'initial' or 'main'
const roomArea = document.querySelector('#room');
const playerCards = document.querySelector('#player-cards');
const opponentCards = document.querySelector('#opponent-cards');
const discardCard = document.querySelector('#discard-card');
const gameArea = document.querySelector('#game');
const loginArea = document.querySelector('#login');
const statusElement = document.querySelector('#status');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
    console.log('Connected');
});

socket.on('disconnect', () => {
    console.log('Disconnected');
});

socket.on('gameStart', (data) => {
    loginArea.style.display = 'none';
    gameArea.style.display = 'block';
    turnPhase = 'initial';
    updateGameBoard(data);
});

socket.on('gameUpdate', (data) => {
    updateGameBoard(data);
});

socket.on('drawnCard', (card) => {
    drawnCard = card;
    chosenCardSource = 'draw';
    alert(`You drew a card: ${card}`);
});

socket.on('discardCardChosen', (card) => {
    drawnCard = card;
    chosenCardSource = 'discard';
    alert(`You chose the discard card: ${card}`);
});

socket.on('updateTurn', (playerId) => {
    turnPhase = 'main';
    highlightCurrentPlayer(playerId);
});

let connect = () => {
    playerName = document.querySelector('#name').value;
    room = roomArea.value;
    socket.emit('join', room, playerName);
}

const updateGameBoard = (data) => {
    playerCards.innerHTML = '';
    data.players[socket.id].hand.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.innerText = card.visible ? card.value : '?';
        cardElement.id = `card-${index}`;  // Ajout d'un identifiant unique
        cardElement.onclick = () => cardClickHandler(index);
        playerCards.appendChild(cardElement);
    });

    const opponentId = Object.keys(data.players).find(id => id !== socket.id);
    opponentCards.innerHTML = '';
    data.players[opponentId].hand.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.innerText = card.visible ? card.value : '?';
        cardElement.id = `opponent-card-${index}`;
        opponentCards.appendChild(cardElement);
    });

    discardCard.innerText = data.discardPile[data.discardPile.length - 1] || '';
    highlightCurrentPlayer(data.currentPlayer);
}

const cardClickHandler = (index) => {
    console.log(`Card at index ${index} clicked`);  // Log pour vérifier le clic
    if (turnPhase === 'initial') {
        console.log("Entering reveal phase")
        socket.emit('revealCard', room, index);
    } else {
        console.log("Entering swap phase")
        swapCard(index);
    }
}

const drawCard = () => {
    socket.emit('drawCard', room);
}

const takeDiscard = () => {
    socket.emit('takeDiscard', room);
}

const endTurn = () => {
    socket.emit('endTurn', room);
}

const swapCard = (index) => {
    if (drawnCard !== null) {
        socket.emit('swapCard', room, index, drawnCard, chosenCardSource);
        drawnCard = null;
        chosenCardSource = null;
    } else {
        alert("Draw or choose a card first!");
    }
}

const highlightCurrentPlayer = (playerId) => {
    if (socket.id === playerId) {
        statusElement.innerText = "Your turn!";
        statusElement.style.color = "green";
    } else {
        statusElement.innerText = "Waiting for opponent...";
        statusElement.style.color = "red";
    }
}
