const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3000;
const cors = require('cors');

app.use(cors());


app.use(express.json());

const USERS_FILE = 'users.json';

// Carregar usuários do arquivo JSON
const loadUsers = () => {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
};

// Salvar usuários no arquivo JSON
const saveUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Rota de registro
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    let users = loadUsers();
    
    if (users.find(user => user.username === username)) {
        return res.status(400).json({ error: 'Usuário já existe!' });
    }
    
    users.push({ username, password });
    saveUsers(users);
    
    res.json({ message: 'Usuário registrado com sucesso!' });
});

// Rota de login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    let users = loadUsers();
    
    const user = users.find(user => user.username === username && user.password === password);
    if (!user) {
        return res.status(400).json({ error: 'Usuário ou senha inválidos!' });
    }
    
    res.json({ message: 'Login bem-sucedido!' });
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));