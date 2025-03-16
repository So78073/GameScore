require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { body, validationResult } = require('express-validator');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

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

    // Insere o usuário no Supabase com a senha em texto simples
    const { data, error } = await supabase
        .from('users')
        .insert([{ username, email, password }]);  // Armazenando a senha em texto simples

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Usuário registrado com sucesso!' });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username e senha são obrigatórios!' });
    }

    try {
        // Busca o usuário no Supabase usando o username
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)  // Busca pelo username
            .single();  // Aqui estamos pegando apenas um usuário com o mesmo username

        if (error || !user) {
            console.error("Erro ao buscar usuário:", error);
            return res.status(400).json({ error: 'Usuário não encontrado!' });
        }

        console.log("Usuário encontrado:", user);

        // Verifica se a senha fornecida é a mesma que está no banco de dados
        if (password !== user.password) {
            console.error('Senha inválida');
            return res.status(400).json({ error: 'Senha inválida!' });
        }

        // Se o login for bem-sucedido, apenas retorne uma mensagem de sucesso
        res.json({ message: 'Login bem-sucedido!' });
    } catch (err) {
        console.error("Erro no login:", err);
        return res.status(500).json({ error: 'Erro interno do servidor. Tente novamente mais tarde.' });
    }
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
    if (user.username !== username || password !== user.password) {
        return res.status(400).json({ error: 'Username ou senha inválidos!' });
    }

    // Se tudo estiver correto, retorna os dados do Admin
    res.json({
        message: 'Acesso autorizado!',
        user: { id: user.id, username: user.username, email: user.email },
    });
});


app.post('/update_score', async (req, res) => {
    const { username, password, timer, score } = req.body;

    // Verifica se todos os campos necessários foram enviados
    if (!username || !password || !timer || !score) {
        return res.status(400).json({ error: 'Username, senha, timer e score são obrigatórios!' });
    }

    try {
        // Remove espaços extras no username
        const trimmedUsername = username.trim();

        // Busca o usuário no banco de dados
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username, password, score, best_timer')
            .eq('username', trimmedUsername)  // Verificando por username exato
            .single();  // Espera-se que seja um único usuário

        if (userError || !user) {
            return res.status(400).json({ error: 'Usuário não encontrado!' });
        }

        // Verifica se a senha fornecida é a mesma que está no banco de dados
        if (password !== user.password) {
            return res.status(400).json({ error: 'Senha inválida!' });
        }

        // Converte o best_timer do banco de dados para um array, caso esteja em formato string
        let bestTimer = user.best_timer ? JSON.parse(user.best_timer) : [0, 0, 0];  // [minutos, segundos, milissegundos]

        // Compara o novo timer com o melhor timer atual
        if (compareTimers(timer, bestTimer)) {
            // Atualiza o melhor tempo
            bestTimer = timer;
        }

        // Atualiza o score do usuário (adicionando o score novo ao existente)
        const newScore = user.score + score;

        // Atualiza o usuário no banco de dados com o novo score e best_timer
        const { error: updateError } = await supabase
            .from('users')
            .update({
                score: newScore,
                best_timer: JSON.stringify(bestTimer)  // Converte o timer para string antes de salvar
            })
            .eq('id', user.id);  // Identificando o usuário pelo ID

        if (updateError) {
            return res.status(400).json({ error: 'Erro ao atualizar os dados do usuário!' });
        }

        // Retorna a resposta com os dados atualizados
        res.json({
            message: 'Score e best_timer atualizados com sucesso!',
            user: { 
                id: user.id,
                username: user.username,
                score: newScore,
                best_timer: bestTimer
            }
        });
    } catch (err) {
        console.error("Erro ao atualizar score e best_timer:", err);
        return res.status(500).json({ error: 'Erro interno do servidor. Tente novamente mais tarde.' });
    }
});

// Função para comparar os timers (minutos, segundos, milissegundos)
function compareTimers(newTimer, bestTimer) {
    const [newMinutes, newSeconds, newMilliseconds] = newTimer;
    const [bestMinutes, bestSeconds, bestMilliseconds] = bestTimer;

    if (newMinutes < bestMinutes) return true;
    if (newMinutes === bestMinutes) {
        if (newSeconds < bestSeconds) return true;
        if (newSeconds === bestSeconds && newMilliseconds < bestMilliseconds) return true;
    }
    return false;
}


// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
