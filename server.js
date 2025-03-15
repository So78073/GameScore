require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

// 📌 Rota para servir o HTML na raiz "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📌 Rota de Registro (Sem Criptografia)
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
    }

    // Insere o usuário no Supabase (sem hash da senha)
    const { data, error } = await supabase
        .from('users')
        .insert([{ username, email, password }]);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Usuário registrado com sucesso!' });
});

// 📌 Rota de Login (Sem Hash de Senha)
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios!' });
    }

    // Busca o usuário no Supabase
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !users) {
        return res.status(400).json({ error: 'Usuário não encontrado!' });
    }

    // Verifica a senha diretamente (NÃO SEGURO, apenas para testes)
    if (password !== users.password) {
        return res.status(400).json({ error: 'Senha inválida!' });
    }

    // Gera um token JWT
    const token = jwt.sign({ id: users.id, email: users.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login bem-sucedido!', token });
});

// 📌 Rota Protegida
app.get('/profile', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado!' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Busca os dados do usuário autenticado
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, email')
            .eq('id', decoded.id)
            .single();

        if (error) return res.status(400).json({ error: error.message });

        res.json(user);
    } catch (error) {
        res.status(401).json({ error: 'Token inválido!' });
    }
});

// 📌 Rota de Teste da Conexão com o Supabase
app.get('/testsupabase', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('*').limit(1); // Apenas 1 registro para testar

        if (error) {
            return res.status(500).json({ error: 'Erro ao conectar ao Supabase', details: error.message });
        }

        res.json({ message: 'Conexão bem-sucedida!', data });
    } catch (err) {
        res.status(500).json({ error: 'Erro inesperado', details: err.message });
    }
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
