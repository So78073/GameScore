require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const path = require('path');

const hashedPassword = await bcrypt.hash(password, 10);

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

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios!' });
    }

    // Busca o usuário no Supabase
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();  // Aqui estamos pegando apenas um usuário com o mesmo email

    if (error || !user) {
        return res.status(400).json({ error: 'Usuário não encontrado!' });
    }

    // Verifica a senha de forma segura
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return res.status(400).json({ error: 'Senha inválida!' });
    }

    // Gera um token JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login bem-sucedido!', token });
});


// 📌 Rota Protegida com verificação de username e senha para o Admin
app.post('/profile', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username e senha são obrigatórios!' });
    }

    // Verifica se o usuário é o Admin (ID 1)
    const userId = 1; // ID do Admin

    // Busca o usuário com ID 1 (Admin)
    const { data: user, error } = await supabase
        .from('users')
        .select('id, username, email, password') // Inclui a senha na consulta
        .eq('id', userId)
        .single();

    if (error || !user) {
        return res.status(400).json({ error: 'Usuário Admin não encontrado!' });
    }

    // Compara o username e a senha
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (user.username !== username || !passwordMatch) {
        return res.status(400).json({ error: 'Username ou senha inválidos!' });
    }

    // Se tudo estiver correto, retorna os dados do Admin
    res.json({
        message: 'Acesso autorizado!',
        user: { id: user.id, username: user.username, email: user.email },
    });
});


// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
