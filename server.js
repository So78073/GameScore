require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { body, validationResult } = require('express-validator');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());


app.use(express.static(path.join(__dirname, 'public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
app.post('/register', [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 8 }).withMessage('A senha deve ter pelo menos 8 caracteres'),
    body('username')
        .notEmpty().withMessage('O nome de usuário é obrigatório')
        .matches(/^[^_]+$/).withMessage('O nome de usuário não pode conter "_"')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
    }

   
    const { data: existingEmail, error: emailError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

    if (existingEmail) {
        return res.status(400).json({ error: 'Email já está registrado!' });
    }

    
    const { data: existingUsername, error: usernameError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

    if (existingUsername) {
        return res.status(400).json({ error: 'Nome de usuário já existe!' });
    }

    
    const { data, error } = await supabase
        .from('users')
        .insert([{ username, email, password }]);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Usuário registrado com sucesso!' });
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username e senha são obrigatórios!' });
    }

    try {
        
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)  
            .single();  

        if (error || !user) {
            console.error("Erro ao buscar usuário:", error);
            return res.status(400).json({ error: 'Usuário não encontrado!' });
        }

        console.log("Usuário encontrado:", user);

        
        if (password !== user.password) {
            console.error('Senha inválida');
            return res.status(400).json({ error: 'Senha inválida!' });
        }

        
        res.json({ message: 'Login bem-sucedido!' });
    } catch (err) {
        console.error("Erro no login:", err);
        return res.status(500).json({ error: 'Erro interno do servidor. Tente novamente mais tarde.' });
    }
});



app.post('/profile', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username e senha são obrigatórios!' });
    }

    
    const userId = 1;

    
    const { data: user, error } = await supabase
        .from('users')
        .select('id, username, email, password') // Inclui a senha na consulta
        .eq('id', userId)
        .single();

    if (error || !user) {
        return res.status(400).json({ error: 'Usuário Admin não encontrado!' });
    }

    
    if (user.username !== username || password !== user.password) {
        return res.status(400).json({ error: 'Username ou senha inválidos!' });
    }

    
    res.json({
        message: 'Acesso autorizado!',
        user: { id: user.id, username: user.username, email: user.email },
    });
});


app.post('/update_score', async (req, res) => {
    const { username, password, timer, score } = req.body;

    // Verifica se todos os campos foram enviados
    if (!username || !password || !timer || score === undefined) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios!' });
    }

    try {

        const trimmedUsername = username.trim();

        console.log(`Procurando usuário com o username: ${trimmedUsername}`);

        
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username, password, score, best_time')
            .eq('username', trimmedUsername)
            .single();

        if (userError || !user) {
            console.error("Erro ao buscar usuário:", userError);
            return res.status(400).json({ error: 'Usuário não encontrado!' });
        }

        console.log("Usuário encontrado:", user);

        
        if (password !== user.password) {
            return res.status(400).json({ error: 'Senha inválida!' });
        }

        
        const bestTimeArray = user.best_time.split(':').map(Number);
        const newTimeArray = timer.split(':').map(Number);

        // Compara os tempos e define o novo melhor tempo
        let updatedBestTime = user.best_time;
        if (compareTimers(newTimeArray, bestTimeArray)) {
            updatedBestTime = timer; // Se for menor, atualiza o best_time
        }

        
        const updatedScore = user.score + score;

        
        const { error: updateError } = await supabase
            .from('users')
            .update({ best_time: updatedBestTime, score: updatedScore })
            .eq('id', user.id);

        if (updateError) {
            console.error("Erro ao atualizar usuário:", updateError);
            return res.status(500).json({ error: 'Erro ao atualizar os dados do usuário.' });
        }

        
        res.json({
            message: 'Score e best_time atualizados com sucesso!',
            user: {
                id: user.id,
                username: user.username,
                score: updatedScore,
                best_time: updatedBestTime
            }
        });

    } catch (err) {
        console.error("Erro ao verificar usuário:", err);
        return res.status(500).json({ error: 'Erro interno do servidor. Tente novamente mais tarde.' });
    }
});


function compareTimers(newTimer, bestTimer) {
    for (let i = 0; i < newTimer.length; i++) {
        if (newTimer[i] < bestTimer[i]) return true;
        if (newTimer[i] > bestTimer[i]) return false;
    }
    return false; 
}

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
