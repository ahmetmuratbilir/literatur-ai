import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is not defined in server/.env!');
  process.exit(1);
}

// Inline schemas to avoid import resolution issues in standalone run
const SearchCache = mongoose.model('SearchCache', new mongoose.Schema({}, { strict: false }), 'searchcaches');
const WriterCache = mongoose.model('WriterCache', new mongoose.Schema({}, { strict: false }), 'writercaches');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully.');

    console.log('Clearing SearchCache collection...');
    const searchRes = await SearchCache.deleteMany({});
    console.log(`SearchCache cleared: ${searchRes.deletedCount} documents deleted.`);

    console.log('Clearing WriterCache collection...');
    const writerRes = await WriterCache.deleteMany({});
    console.log(`WriterCache cleared: ${writerRes.deletedCount} documents deleted.`);

    console.log('\n--- SUCCESS: Database Cache cleared safely! Clerk and all other data are completely untouched. ---');
  } catch (err) {
    console.error('An error occurred during cache clearing:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
