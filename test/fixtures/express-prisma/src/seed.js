#!/usr/bin/env node
// Fills the database with sample users: node src/seed.js <count>
const n = Number(process.argv[2] || 10);
module.exports = n;
