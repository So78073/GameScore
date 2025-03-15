require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

app.post('/register', [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 8 }).withMessage('A senha deve ter pelo menos 8 caracteres'),
    body('username').notEmpty().withMessage('O nome de usuário é obrigatório')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
    }

    // Verifica se o email já existe
    const { data: existingUser, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (existingUser) {
        return res.status(400).json({ error: 'Email já está registrado!' });
    }

    // Criptografar a senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insere o usuário no Supabase com a senha criptografada
    const { data, error } = await supabase
        .from('users')
        .insert([{ username, email, password: hashedPassword }]);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Usuário registrado com sucesso!' });
});



// 📌 Rota de Login (comparando senha criptografada)
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
        console.error('Erro ao buscar o usuário:', error);
        return res.status(400).json({ error: 'Usuário não encontrado!' });
    }

    // Verifica a senha de forma segura
    const passwordMatch = await bcrypt.compare(password, users.password);
    if (!passwordMatch) {
        console.error('Senha inválida');
        return res.status(400).json({ error: 'Senha inválida!' });
    }

    // Gera um token JWT
    const token = jwt.sign({ id: users.id, email: users.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login bem-sucedido!', token });
});



// 📌 Rota Protegida
app.get('/profile', async (req, res) => {

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

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
