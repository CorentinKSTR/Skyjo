import express from 'express';
import http from 'http';
import ip from 'ip';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});
app.use(cors());

let games = {};

app.get('/', (req, res) => {
    res.json('ip address: http://' + ip.address() + ':' + PORT);    
});

io.on('connection', (socket) => {
    console.log('a user connected');
    
    socket.on('disconnect', () => {
        console.log('user disconnected');
        socket.broadcast.emit('user disconnected');
    });

    socket.on('join', (room, playerName) => {
        console.log('join room: ' + room);
        socket.join(room);
        if (!games[room]) {
            games[room] = {
                players: {},
                deck: initializeDeck(),
                discardPile: [],
                currentPlayer: null,
                initialPhase: true,
                revealedCards: {},
            };
        }
        games[room].players[socket.id] = {
            name: playerName,
            hand: initializeHand(),
        };
        if (Object.keys(games[room].players).length === 2) {
            startGame(room);
        }
    });

    socket.on('revealCard', (room, index) => {
        let game = games[room];
        if (game && game.initialPhase) {
            let player = game.players[socket.id];
            player.hand[index].visible = true;
            player.hand[index].value = drawCardFromDeck(game.deck);  // Ensure the card has a value
            if (!game.revealedCards[socket.id]) {
                game.revealedCards[socket.id] = [];
            }
            game.revealedCards[socket.id].push(player.hand[index].value);
            if (game.revealedCards[socket.id].length === 2) {
                checkInitialPhaseEnd(room);
            }
            io.to(room).emit('gameUpdate', game);  // Envoyer la mise à jour du jeu
        }
    });

    socket.on('drawCard', (room) => {
        let game = games[room];
        if (game && game.currentPlayer === socket.id && !game.initialPhase) {
            let card = drawCardFromDeck(game.deck);
            io.to(socket.id).emit('drawnCard', card);
        }
    });

    socket.on('takeDiscard', (room) => {
        let game = games[room];
        if (game && game.currentPlayer === socket.id && !game.initialPhase) {
            let card = game.discardPile.pop();
            io.to(socket.id).emit('discardCardChosen', card);
        }
    });

    socket.on('swapCard', (room, index, drawnCard, source) => {
        let game = games[room];
        if (game && game.currentPlayer === socket.id) {
            let player = game.players[socket.id];
            let discarded = player.hand[index].value;  // Sauvegarder la valeur de la carte à défausser
            player.hand[index] = { value: drawnCard, visible: true };  // Remplacer la carte par celle piochée

            game.discardPile.push(discarded);  // Ajouter la carte défaussée à la pile de défausse

            if (game.deck.length === 0) {
                game.deck = shuffle(game.discardPile);
                game.discardPile = [];
            }

            game.currentPlayer = getNextPlayer(room, socket.id);
            io.to(room).emit('gameUpdate', game);
            io.to(room).emit('updateTurn', game.currentPlayer);
        }
    });

    socket.on('discardDrawnCard', (room, drawnCard) => {
        let game = games[room];
        if (game && game.currentPlayer === socket.id) {
            game.discardPile.push(drawnCard);  // Défausser la carte tirée
            io.to(room).emit('gameUpdate', game);
            // Ne pas passer le tour ici, attendre que le joueur retourne une carte
        }
    });

    socket.on('revealCardAfterDiscard', (room, index) => {
        let game = games[room];
        if (game && game.currentPlayer === socket.id) {
            let player = game.players[socket.id];
            player.hand[index].visible = true;
            game.currentPlayer = getNextPlayer(room, socket.id);
            io.to(room).emit('gameUpdate', game);
            io.to(room).emit('updateTurn', game.currentPlayer);
        }
    });
});

const startGame = (room) => {
    let game = games[room];
    let players = Object.keys(game.players);
    players.forEach(playerId => {
        game.players[playerId].hand = drawInitialCards(game.deck);
    });
    game.discardPile.push(game.deck.pop());
    io.to(room).emit('gameStart', game);
}

const checkInitialPhaseEnd = (room) => {
    let game = games[room];
    let players = Object.keys(game.players);
    if (players.every(playerId => game.revealedCards[playerId] && game.revealedCards[playerId].length === 2)) {
        game.initialPhase = false;
        let highestPlayerId = players[0];
        let highestSum = game.revealedCards[players[0]].reduce((a, b) => a + b, 0);
        players.forEach(playerId => {
            let sum = game.revealedCards[playerId].reduce((a, b) => a + b, 0);
            if (sum > highestSum) {
                highestSum = sum;
                highestPlayerId = playerId;
            }
        });
        game.currentPlayer = highestPlayerId;
        io.to(room).emit('updateTurn', game.currentPlayer);
    }
}

const getNextPlayer = (room, currentPlayer) => {
    let players = Object.keys(games[room].players);
    let currentIndex = players.indexOf(currentPlayer);
    return players[(currentIndex + 1) % players.length];
}

const initializeDeck = () => {
    let deck = [];
    for (let i = -2; i <= 12; i++) {
        for (let j = 0; j < 10; j++) {
            deck.push(i);
        }
    }
    return shuffle(deck);
}

const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const initializeHand = () => {
    let hand = [];
    for (let i = 0; i < 12; i++) {
        hand.push({ value: null, visible: false });
    }
    return hand;
}

const drawInitialCards = (deck) => {
    let hand = [];
    for (let i = 0; i < 12; i++) {
        hand.push({ value: deck.pop(), visible: false });
    }
    return hand;
}

const drawCardFromDeck = (deck) => {
    if (deck.length > 0) {
        return deck.pop();
    }
    return null;
}

server.listen(PORT, () => {
    console.log('Server ip : http://' + ip.address() + ":" + PORT);
});
