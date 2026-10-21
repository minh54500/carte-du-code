// API server.
const express = require('express');
const { prisma } = require('./db');
const app = express();
app.get('/users', async (req, res) => res.json(await prisma.user.findMany()));
app.post('/posts/:id', async (req, res) => res.json(await prisma.post.create({})));
