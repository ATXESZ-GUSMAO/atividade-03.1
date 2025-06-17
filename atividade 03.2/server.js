const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Armazena os usuários conectados
const connectedUsers = new Map();

// Cria/abre o arquivo de log
const logStream = fs.createWriteStream('chat.log', { flags: 'a' });

// Função para registrar logs
function logToFile(message) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
  console.log(message); // Também mostra no console
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Validação de username
function validateUsername(username) {
  username = username.trim();
  
  if (!username) {
    return { valid: false, message: 'O nome de usuário não pode estar vazio!' };
  }
  
  if (username.length > 20) {
    return { valid: false, message: 'O nome deve ter no máximo 20 caracteres!' };
  }
  
  if (connectedUsers.has(username)) {
    return { valid: false, message: 'Este nome já está em uso!' };
  }
  
  return { valid: true, message: `Bem-vindo(a), ${username}!` };
}

io.on('connection', (socket) => {
  logToFile(`Nova conexão: ${socket.id}`);

  socket.on('validate_username', (username, callback) => {
    const validation = validateUsername(username);
    
    if (validation.valid) {
      connectedUsers.set(username, socket.id);
      socket.username = username;
      
      io.emit('user_joined', username);
      io.emit('user_list', Array.from(connectedUsers.keys()));
      
      logToFile(`Usuário conectado: ${username}`);
    }
    
    callback(validation);
  });

  socket.on('chat_message', (msg) => {
    if (socket.username) {
      const messageData = {
        username: socket.username,
        message: msg,
        timestamp: new Date().toLocaleTimeString()
      };
      
      io.emit('chat_message', messageData);
      logToFile(`MENSAGEM: ${messageData.username} - ${messageData.message}`);
    }
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      connectedUsers.delete(socket.username);
      io.emit('user_left', socket.username);
      io.emit('user_list', Array.from(connectedUsers.keys()));
      
      logToFile(`Usuário desconectado: ${socket.username}`);
    }
  });
});

// Fecha o arquivo de log ao encerrar o servidor
process.on('SIGINT', () => {
  logToFile('Servidor encerrado');
  logStream.end();
  process.exit();
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logToFile(`Servidor iniciado na porta ${PORT}`);
});