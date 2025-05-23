require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { MongoClient } = require('mongodb');

// Configuration
const DATA_DIR = path.join(__dirname, 'data');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://root:19990507@isftdatabase.ehpoxpk.mongodb.net/?retryWrites=true&w=majority&appName=isftdatabase';

// Data files
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DIRECTIONS_FILE = path.join(DATA_DIR, 'directions.json');
const TESTS_FILE = path.join(DATA_DIR, 'tests.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');

async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
}

async function migrateToMongoDB() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db();
        
        // Migrate users
        const usersData = await readJsonFile(USERS_FILE);
        if (usersData.length > 0) {
            await db.collection('users').deleteMany({});
            await db.collection('users').insertMany(usersData);
            console.log(`Migrated ${usersData.length} users`);
        }
        
        // Migrate directions
        const directionsData = await readJsonFile(DIRECTIONS_FILE);
        if (directionsData.length > 0) {
            await db.collection('directions').deleteMany({});
            await db.collection('directions').insertMany(directionsData);
            console.log(`Migrated ${directionsData.length} directions`);
        }
        
        // Migrate tests
        const testsData = await readJsonFile(TESTS_FILE);
        if (testsData.length > 0) {
            await db.collection('tests').deleteMany({});
            await db.collection('tests').insertMany(testsData);
            console.log(`Migrated ${testsData.length} tests`);
        }
        
        // Migrate results
        const resultsData = await readJsonFile(RESULTS_FILE);
        if (resultsData.length > 0) {
            await db.collection('results').deleteMany({});
            await db.collection('results').insertMany(resultsData);
            console.log(`Migrated ${resultsData.length} results`);
        }
        
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await client.close();
    }
}

migrateToMongoDB().catch(console.error);