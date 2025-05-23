const express = require("express")
const cors = require("cors")
const fs = require("fs").promises
const path = require("path")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const TelegramBot = require("node-telegram-bot-api")

// Load environment variables
require("dotenv").config()

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Telegram Bot with error handling
let bot = null;
if (BOT_TOKEN) {
    try {
        bot = new TelegramBot(BOT_TOKEN, { polling: true });
        console.log('Telegram bot initialized successfully');
        
        // Handle bot errors
        bot.on('polling_error', (error) => {
            console.error('Telegram bot polling error:', error.message);
        });
        
        bot.on('error', (error) => {
            console.error('Telegram bot error:', error.message);
        });
    } catch (error) {
        console.error('Failed to initialize Telegram bot:', error.message);
    }
} else {
    console.warn('TELEGRAM_BOT_TOKEN not provided. Telegram bot functionality will be simulated.');
}

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DIRECTIONS_FILE = path.join(DATA_DIR, 'directions.json');
const TESTS_FILE = path.join(DATA_DIR, 'tests.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const VERIFICATION_FILE = path.join(DATA_DIR, 'verification.json');

// Store chat IDs for verification
const telegramChatIds = new Map();

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log('Data directory is ready');
    } catch (error) {
        console.error('Error creating data directory:', error);
    }
}

// Initialize data files if they don't exist
async function initDataFiles() {
    try {
        // Check if users file exists
        try {
            await fs.access(USERS_FILE);
            console.log('Users file exists');
        } catch (error) {
            // Create default admin user
            const adminUser = {
                id: '1',
                firstName: 'Admin',
                lastName: 'User',
                direction: 'Admin',
                phone: '+998901234567',
                telegram: '@admin',
                login: 'admin',
                password: await bcrypt.hash('isftqabul2025', 10),
                isAdmin: true,
                createdAt: new Date().toISOString()
            };
            await fs.writeFile(USERS_FILE, JSON.stringify([adminUser], null, 2));
            console.log('Created users file with admin user');
        }

        // Check if directions file exists
        try {
            await fs.access(DIRECTIONS_FILE);
            console.log('Directions file exists');
        } catch (error) {
            // Create default directions
            const directions = [
                { id: '1', name: 'Dasturlash' },
                { id: '2', name: 'Dizayn' },
                { id: '3', name: 'Marketing' },
                { id: '4', name: 'Buxgalteriya' },
                { id: '5', name: 'Tillar' }
            ];
            await fs.writeFile(DIRECTIONS_FILE, JSON.stringify(directions, null, 2));
            console.log('Created directions file with default directions');
        }

        // Check if tests file exists
        try {
            await fs.access(TESTS_FILE);
            console.log('Tests file exists');
        } catch (error) {
            // Create empty tests array
            await fs.writeFile(TESTS_FILE, JSON.stringify([], null, 2));
            console.log('Created empty tests file');
        }

        // Check if results file exists
        try {
            await fs.access(RESULTS_FILE);
            console.log('Results file exists');
        } catch (error) {
            // Create empty results array
            await fs.writeFile(RESULTS_FILE, JSON.stringify([], null, 2));
            console.log('Created empty results file');
        }

        // Check if verification file exists
        try {
            await fs.access(VERIFICATION_FILE);
            console.log('Verification file exists');
        } catch (error) {
            // Create empty verification array
            await fs.writeFile(VERIFICATION_FILE, JSON.stringify([], null, 2));
            console.log('Created empty verification file');
        }
    } catch (error) {
        console.error('Error initializing data files:', error);
    }
}

// Helper functions for data operations
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
}

async function writeJsonFile(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error);
        return false;
    }
}

// Telegram Bot handlers
if (bot) {
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Salom! Test platformasiga xush kelibsiz. Tasdiqlash kodi uchun kutib turing.');
    });
    
    // Store chat IDs for verification
    bot.onText(/\/register (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const username = match[1];
        
        // Store the chat ID with the username
        telegramChatIds.set(username, chatId);
        
        bot.sendMessage(chatId, `${username} sifatida ro'yxatdan o'tish uchun tasdiqlash kodi yuboriladi.`);
        console.log(`Registered chat ID ${chatId} for username ${username}`);
    });
}

// Middleware to authenticate token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token kerak' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Noto\'g\'ri token' });
        }
        req.user = user;
        next();
    });
}

// Middleware to require admin role
function requireAdmin(req, res, next) {
    if (!req.user.isAdmin) {
        return res.status(403).json({ success: false, message: 'Admin huquqi kerak' });
    }
    next();
}

// API Routes

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Test Platform API is running' });
});

// Get directions
app.get('/api/directions', async (req, res) => {
    try {
        const directions = await readJsonFile(DIRECTIONS_FILE);
        res.json(directions);
    } catch (error) {
        console.error('Error fetching directions:', error);
        res.status(500).json({ success: false, message: 'Yo\'nalishlarni yuklashda xatolik' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        
        if (!login || !password) {
            return res.status(400).json({ success: false, message: 'Login va parol kerak' });
        }
        
        const users = await readJsonFile(USERS_FILE);
        const user = users.find(u => u.login === login);
        
        if (!user) {
            return res.status(400).json({ success: false, message: 'Noto\'g\'ri login yoki parol' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, message: 'Noto\'g\'ri login yoki parol' });
        }
        
        const token = jwt.sign({ 
            userId: user.id, 
            isAdmin: user.isAdmin 
        }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ 
            success: true, 
            token, 
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                direction: user.direction,
                directionName: user.directionName,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Tizimga kirishda xatolik yuz berdi' });
    }
});

// Send verification code
app.post('/api/send-verification', async (req, res) => {
    try {
        const { telegram } = req.body;
        
        if (!telegram) {
            return res.status(400).json({ success: false, message: 'Telegram username kerak' });
        }
        
        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store verification code
        const verifications = await readJsonFile(VERIFICATION_FILE);
        
        // Remove any existing verification for this telegram username
        const filteredVerifications = verifications.filter(v => v.telegram !== telegram);
        
        // Add new verification
        const newVerification = {
            telegram,
            code,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes expiry
        };
        
        await writeJsonFile(VERIFICATION_FILE, [...filteredVerifications, newVerification]);
        
        // Try to send code via Telegram
        let codeSent = false;
        
        if (bot) {
            try {
                // Try to find chat ID by username
                const chatId = telegramChatIds.get(telegram);
                
                if (chatId) {
                    await bot.sendMessage(chatId, `Sizning tasdiqlash kodingiz: ${code}`);
                    codeSent = true;
                    console.log(`Sent verification code to ${telegram} via Telegram`);
                } else {
                    console.log(`No chat ID found for ${telegram}. User needs to message the bot first.`);
                }
            } catch (error) {
                console.error('Error sending Telegram message:', error);
            }
        }
        
        // For development/testing, always log the code
        console.log(`Verification code for ${telegram}: ${code}`);
        
        res.json({ 
            success: true, 
            message: codeSent ? 'Kod Telegram orqali yuborildi' : 'Kod yaratildi (Telegram bot ishlamayotgani uchun konsolda ko\'rsatildi)',
            devCode: !codeSent ? code : undefined // Only send code in response during development
        });
    } catch (error) {
        console.error('Send verification error:', error);
        res.status(500).json({ success: false, message: 'Kodni yuborishda xatolik yuz berdi' });
    }
});

// Verify code
app.post('/api/verify-code', async (req, res) => {
    try {
        const { telegram, code } = req.body;
        
        if (!telegram || !code) {
            return res.status(400).json({ success: false, message: 'Telegram username va kod kerak' });
        }
        
        const verifications = await readJsonFile(VERIFICATION_FILE);
        const verification = verifications.find(v => 
            v.telegram === telegram && 
            v.code === code &&
            new Date(v.expiresAt) > new Date()
        );
        
        if (!verification) {
            return res.status(400).json({ success: false, message: 'Noto\'g\'ri kod yoki kod eskirgan' });
        }
        
        // Remove the used verification
        const updatedVerifications = verifications.filter(v => !(v.telegram === telegram && v.code === code));
        await writeJsonFile(VERIFICATION_FILE, updatedVerifications);
        
        res.json({ success: true, message: 'Kod tasdiqlandi' });
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ success: false, message: 'Kodni tasdiqlashda xatolik yuz berdi' });
    }
});

// Register user
app.post('/api/register', async (req, res) => {
    try {
        const { firstName, lastName, direction, phone, telegram, login, password } = req.body;
        
        // Validate required fields
        if (!firstName || !lastName || !direction || !phone || !telegram || !login || !password) {
            return res.status(400).json({ success: false, message: 'Barcha maydonlar to\'ldirilishi kerak' });
        }
        
        const users = await readJsonFile(USERS_FILE);
        
        // Check if login already exists
        if (users.some(u => u.login === login)) {
            return res.status(400).json({ success: false, message: 'Bu login band' });
        }
        
        // Check if telegram already exists
        if (users.some(u => u.telegram === telegram)) {
            return res.status(400).json({ success: false, message: 'Bu telegram username band' });
        }
        
        // Get directions to validate and get name
        const directions = await readJsonFile(DIRECTIONS_FILE);
        const selectedDirection = directions.find(d => d.id === direction);
        
        if (!selectedDirection) {
            return res.status(400).json({ success: false, message: 'Noto\'g\'ri yo\'nalish' });
        }
        
        // Create new user
        const newUser = {
            id: Date.now().toString(),
            firstName,
            lastName,
            direction,
            directionName: selectedDirection.name,
            phone,
            telegram,
            login,
            password: await bcrypt.hash(password, 10),
            isAdmin: false,
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        await writeJsonFile(USERS_FILE, users);
        
        res.json({ success: true, message: 'Ro\'yxatdan o\'tish muvaffaqiyatli' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Ro\'yxatdan o\'tishda xatolik yuz berdi' });
    }
});

// Get tests for user
app.get('/api/tests', authenticateToken, async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE);
        const user = users.find(u => u.id === req.user.userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });
        }
        
        const tests = await readJsonFile(TESTS_FILE);
        const results = await readJsonFile(RESULTS_FILE);
        
        // Filter tests by user's direction
        let userTests = tests;
        if (!user.isAdmin) {
            userTests = tests.filter(t => t.direction === user.direction);
        }
        
        // Add completed flag
        const userResults = results.filter(r => r.userId === user.id);
        const testsWithStatus = userTests.map(test => {
            const completed = userResults.some(r => r.testId === test.id);
            return {
                ...test,
                completed
            };
        });
        
        res.json(testsWithStatus);
    } catch (error) {
        console.error('Get tests error:', error);
        res.status(500).json({ success: false, message: 'Testlarni yuklashda xatolik yuz berdi' });
    }
});

// Get test by ID
app.get('/api/tests/:id', authenticateToken, async (req, res) => {
    try {
        const testId = req.params.id;
        const tests = await readJsonFile(TESTS_FILE);
        const test = tests.find(t => t.id === testId);
        
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test topilmadi' });
        }
        
        // Remove correct answers from questions
        const testWithoutAnswers = {
            ...test,
            questions: test.questions.map(q => ({
                id: q.id,
                question: q.question,
                options: q.options
            }))
        };
        
        res.json(testWithoutAnswers);
    } catch (error) {
        console.error('Get test error:', error);
        res.status(500).json({ success: false, message: 'Testni yuklashda xatolik yuz berdi' });
    }
});

// Submit test
app.post('/api/submit-test', authenticateToken, async (req, res) => {
    try {
        const { testId, answers, timeSpent } = req.body;
        
        if (!testId || !answers) {
            return res.status(400).json({ success: false, message: 'Test ID va javoblar kerak' });
        }
        
        const tests = await readJsonFile(TESTS_FILE);
        const test = tests.find(t => t.id === testId);
        
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test topilmadi' });
        }
        
        // Check if user already completed this test
        const results = await readJsonFile(RESULTS_FILE);
        const existingResult = results.find(r => r.userId === req.user.userId && r.testId === testId);
        
        if (existingResult) {
            return res.status(400).json({ success: false, message: 'Bu testni allaqachon topshirgansiz' });
        }
        
        // Calculate score
        let score = 0;
        const questionResults = test.questions.map((question, index) => {
            const userAnswer = answers[index];
            const isCorrect = userAnswer === question.correct;
            
            if (isCorrect) {
                score++;
            }
            
            return {
                questionId: question.id,
                userAnswer,
                correctAnswer: question.correct,
                isCorrect
            };
        });
        
        // Create result
        const newResult = {
            id: Date.now().toString(),
            userId: req.user.userId,
            testId,
            score,
            totalQuestions: test.questions.length,
            percentage: Math.round((score / test.questions.length) * 100),
            timeSpent: timeSpent || 0,
            questionResults,
            createdAt: new Date().toISOString()
        };
        
        results.push(newResult);
        await writeJsonFile(RESULTS_FILE, results);
        
        res.json({
            success: true,
            score,
            totalQuestions: test.questions.length,
            percentage: Math.round((score / test.questions.length) * 100)
        });
    } catch (error) {
        console.error('Submit test error:', error);
        res.status(500).json({ success: false, message: 'Testni yuborishda xatolik yuz berdi' });
    }
});

// Get user results
app.get('/api/my-results', authenticateToken, async (req, res) => {
    try {
        const results = await readJsonFile(RESULTS_FILE);
        const tests = await readJsonFile(TESTS_FILE);
        
        const userResults = results.filter(r => r.userId === req.user.userId);
        
        const resultsWithTestInfo = userResults.map(result => {
            const test = tests.find(t => t.id === result.testId);
            return {
                ...result,
                testTitle: test ? test.title : 'Noma\'lum test'
            };
        });
        
        res.json(resultsWithTestInfo);
    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ success: false, message: 'Natijalarni yuklashda xatolik yuz berdi' });
    }
});

// Admin routes

// Get all users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE);
        
        // Filter out admin users and sensitive info
        const filteredUsers = users
            .filter(u => !u.isAdmin)
            .map(u => ({
                id: u.id,
                firstName: u.firstName,
                lastName: u.lastName,
                direction: u.direction,
                directionName: u.directionName,
                phone: u.phone,
                telegram: u.telegram,
                login: u.login,
                createdAt: u.createdAt
            }));
        
        res.json(filteredUsers);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Foydalanuvchilarni yuklashda xatolik yuz berdi' });
    }
});

// Get all tests
app.get('/api/admin/tests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const tests = await readJsonFile(TESTS_FILE);
        res.json(tests);
    } catch (error) {
        console.error('Get admin tests error:', error);
        res.status(500).json({ success: false, message: 'Testlarni yuklashda xatolik yuz berdi' });
    }
});

// Create test
app.post('/api/admin/tests', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, direction, timeLimit, attempts, questions } = req.body;
        
        if (!title || !direction || !timeLimit || !attempts || !questions || !questions.length) {
            return res.status(400).json({ success: false, message: 'Barcha maydonlar to\'ldirilishi kerak' });
        }
        
        // Validate direction
        const directions = await readJsonFile(DIRECTIONS_FILE);
        const selectedDirection = directions.find(d => d.id === direction);
        
        if (!selectedDirection) {
            return res.status(400).json({ success: false, message: 'Noto\'g\'ri yo\'nalish' });
        }
        
        // Create new test
        const newTest = {
            id: Date.now().toString(),
            title,
            direction,
            directionName: selectedDirection.name,
            timeLimit: parseInt(timeLimit),
            attempts: parseInt(attempts),
            questions: questions.map((q, index) => ({
                id: (index + 1).toString(),
                ...q
            })),
            createdAt: new Date().toISOString()
        };
        
        const tests = await readJsonFile(TESTS_FILE);
        tests.push(newTest);
        await writeJsonFile(TESTS_FILE, tests);
        
        res.json({ success: true, test: newTest });
    } catch (error) {
        console.error('Create test error:', error);
        res.status(500).json({ success: false, message: 'Testni yaratishda xatolik yuz berdi' });
    }
});

// Get all results
app.get('/api/admin/results', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const results = await readJsonFile(RESULTS_FILE);
        const users = await readJsonFile(USERS_FILE);
        const tests = await readJsonFile(TESTS_FILE);
        
        const resultsWithInfo = results.map(result => {
            const user = users.find(u => u.id === result.userId);
            const test = tests.find(t => t.id === result.testId);
            
            return {
                ...result,
                userName: user ? `${user.firstName} ${user.lastName}` : 'Noma\'lum',
                testTitle: test ? test.title : 'Noma\'lum test'
            };
        });
        
        res.json(resultsWithInfo);
    } catch (error) {
        console.error('Get admin results error:', error);
        res.status(500).json({ success: false, message: 'Natijalarni yuklashda xatolik yuz berdi' });
    }
});

// Get statistics
app.get('/api/admin/statistics', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await readJsonFile(USERS_FILE);
        const tests = await readJsonFile(TESTS_FILE);
        const results = await readJsonFile(RESULTS_FILE);
        const directions = await readJsonFile(DIRECTIONS_FILE);
        
        const stats = {
            totalUsers: users.filter(u => !u.isAdmin).length,
            totalTests: tests.length,
            totalResults: results.length,
            directionStats: {}
        };
        
        // Calculate stats for each direction
        directions.forEach(direction => {
            const directionUsers = users.filter(u => u.direction === direction.id);
            const directionTests = tests.filter(t => t.direction === direction.id);
            const directionResults = results.filter(r => {
                const user = users.find(u => u.id === r.userId);
                return user && user.direction === direction.id;
            });
            
            stats.directionStats[direction.name] = {
                users: directionUsers.length,
                tests: directionTests.length,
                results: directionResults.length
            };
        });
        
        res.json(stats);
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ success: false, message: 'Statistikani yuklashda xatolik yuz berdi' });
    }
});

// Delete test
app.delete('/api/admin/tests/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const testId = req.params.id;
        const tests = await readJsonFile(TESTS_FILE);
        
        const testIndex = tests.findIndex(t => t.id === testId);
        if (testIndex === -1) {
            return res.status(404).json({ success: false, message: 'Test topilmadi' });
        }
        
        tests.splice(testIndex, 1);
        await writeJsonFile(TESTS_FILE, tests);
        
        res.json({ success: true, message: 'Test o\'chirildi' });
    } catch (error) {
        console.error('Delete test error:', error);
        res.status(500).json({ success: false, message: 'Testni o\'chirishda xatolik yuz berdi' });
    }
});

// Update test
app.put('/api/admin/tests/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const testId = req.params.id;
        const { title, direction, timeLimit, attempts, questions } = req.body;
        
        if (!title || !direction || !timeLimit || !attempts || !questions || !questions.length) {
            return res.status(400).json({ success: false, message: 'Barcha maydonlar to\'ldirilishi kerak' });
        }
        
        const tests = await readJsonFile(TESTS_FILE);
        const testIndex = tests.findIndex(t => t.id === testId);
        
        if (testIndex === -1) {
            return res.status(404).json({ success: false, message: 'Test topilmadi' });
        }
        
        // Validate direction
        const directions = await readJsonFile(DIRECTIONS_FILE);
        const selectedDirection = directions.find(d => d.id === direction);
        
        if (!selectedDirection) {
            return res.status(400).json({ success: false, message: 'Noto\'g\'ri yo\'nalish' });
        }
        
        // Update test
        tests[testIndex] = {
            ...tests[testIndex],
            title,
            direction,
            directionName: selectedDirection.name,
            timeLimit: parseInt(timeLimit),
            attempts: parseInt(attempts),
            questions: questions.map((q, index) => ({
                id: (index + 1).toString(),
                ...q
            })),
            updatedAt: new Date().toISOString()
        };
        
        await writeJsonFile(TESTS_FILE, tests);
        
        res.json({ success: true, test: tests[testIndex] });
    } catch (error) {
        console.error('Update test error:', error);
        res.status(500).json({ success: false, message: 'Testni yangilashda xatolik yuz berdi' });
    }
});

// Add direction
app.post('/api/admin/directions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: 'Yo\'nalish nomi kerak' });
        }
        
        const directions = await readJsonFile(DIRECTIONS_FILE);
        
        // Check if direction already exists
        if (directions.some(d => d.name === name)) {
            return res.status(400).json({ success: false, message: 'Bu yo\'nalish allaqachon mavjud' });
        }
        
        // Create new direction
        const newDirection = {
            id: Date.now().toString(),
            name
        };
        
        directions.push(newDirection);
        await writeJsonFile(DIRECTIONS_FILE, directions);
        
        res.json({ success: true, direction: newDirection });
    } catch (error) {
        console.error('Add direction error:', error);
        res.status(500).json({ success: false, message: 'Yo\'nalishni qo\'shishda xatolik yuz berdi' });
    }
});

// Delete direction
app.delete('/api/admin/directions/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const directionId = req.params.id;
        const directions = await readJsonFile(DIRECTIONS_FILE);
        
        const directionIndex = directions.findIndex(d => d.id === directionId);
        if (directionIndex === -1) {
            return res.status(404).json({ success: false, message: 'Yo\'nalish topilmadi' });
        }
        
        // Check if direction is in use
        const users = await readJsonFile(USERS_FILE);
        const tests = await readJsonFile(TESTS_FILE);
        
        if (users.some(u => u.direction === directionId)) {
            return res.status(400).json({ success: false, message: 'Bu yo\'nalish foydalanuvchilar tomonidan ishlatilmoqda' });
        }
        
        if (tests.some(t => t.direction === directionId)) {
            return res.status(400).json({ success: false, message: 'Bu yo\'nalish testlar tomonidan ishlatilmoqda' });
        }
        
        directions.splice(directionIndex, 1);
        await writeJsonFile(DIRECTIONS_FILE, directions);
        
        res.json({ success: true, message: 'Yo\'nalish o\'chirildi' });
    } catch (error) {
        console.error('Delete direction error:', error);
        res.status(500).json({ success: false, message: 'Yo\'nalishni o\'chirishda xatolik yuz berdi' });
    }
});

// Telegram bot commands
app.get('/api/telegram-commands', (req, res) => {
    res.json({
        success: true,
        commands: [
            { command: '/start', description: 'Botni ishga tushirish' },
            { command: '/register @username', description: 'Ro\'yxatdan o\'tish uchun username\'ni ulash' }
        ]
    });
});

// Start server
async function startServer() {
    try {
        await ensureDataDir();
        await initDataFiles();
        
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            if (bot) {
                console.log('Telegram bot is running...');
            } else {
                console.log('Telegram bot is NOT running (token not provided)');
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

startServer();