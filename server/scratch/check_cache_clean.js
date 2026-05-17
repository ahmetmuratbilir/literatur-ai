import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import SearchCache from '../models/SearchCache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const allCaches = await SearchCache.find({}).lean();
  console.log(`Found total cache records: ${allCaches.length}`);

  let oldRecords = [];
  let invalidScoresRecords = [];

  for (const cached of allCaches) {
    const results = cached.data?.results || cached.results || [];
    const isLegacy = !cached.data;

    // Check if scores are undefined or if ahpScore/totalPoint is 0
    let hasInvalidScores = false;
    if (results.length === 0) {
      hasInvalidScores = true; // empty results are also considered invalid for this check
    } else {
      for (const res of results) {
        // Checking for undefined scores, or ahp score being 0/undefined
        const scores = res.scores;
        const ahpVal = res.totalPoint ?? res.ahpScore ?? scores?.total;
        if (!scores || scores.total === undefined || ahpVal === 0 || ahpVal === undefined) {
          hasInvalidScores = true;
          break;
        }
      }
    }

    if (isLegacy) {
      oldRecords.push(cached);
    } else if (hasInvalidScores) {
      invalidScoresRecords.push(cached);
    }
  }

  console.log(`\n--- ANALYSIS RESULTS ---`);
  console.log(`Total cache records: ${allCaches.length}`);
  console.log(`Legacy/Old Cache Records (no nested data field): ${oldRecords.length}`);
  console.log(`Cache Records with undefined scores or 0 AHP score: ${invalidScoresRecords.length}`);

  const toDeleteIds = [];
  
  if (oldRecords.length > 0) {
    console.log(`\nLegacy cache records found:`);
    for (const r of oldRecords) {
      console.log(`- ID: ${r._id}, Display: ${r.displayQuery || r.query}`);
      toDeleteIds.push(r._id);
    }
  }

  if (invalidScoresRecords.length > 0) {
    console.log(`\nInvalid scores or AHP = 0 cache records found:`);
    for (const r of invalidScoresRecords) {
      console.log(`- ID: ${r._id}, Display: ${r.displayQuery || r.query}`);
      toDeleteIds.push(r._id);
    }
  }

  if (toDeleteIds.length > 0) {
    console.log(`\nDeleting ${toDeleteIds.length} invalid/old cache records...`);
    const deleteResult = await SearchCache.deleteMany({ _id: { $in: toDeleteIds } });
    console.log(`Deleted successfully: ${deleteResult.deletedCount} documents.`);
  } else {
    console.log('\nNo legacy or invalid cache records found. Database cache is clean!');
  }

  await mongoose.disconnect();
  console.log('Database disconnected.');
}

run().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
