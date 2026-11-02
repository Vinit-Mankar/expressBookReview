const express = require('express');
const axios = require('axios');
const crypto = require('node:crypto');
const books = require('./booksdb');
const { isValid, users } = require('./auth_users');
const public_users = express.Router();

public_users.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(username) ||
      typeof password !== 'string' || password.length < 8 || password.length > 128)
    return res.status(400).json({ message: 'Provide a username and a password of 8-128 characters.' });
  if (isValid(username)) return res.status(409).json({ message: 'Username already exists.' });
  const salt = crypto.randomBytes(16).toString('hex');
  users.push({ username, salt, passwordHash: crypto.scryptSync(password, salt, 64).toString('hex') });
  return res.status(201).json({ message: 'Customer successfully registered. Now you can login' });
});

// Local catalog API provides the original starter data to the Axios-backed routes.
// These separate endpoints avoid recursively requesting the public routes.
public_users.get('/_catalog/books', (req, res) => res.json(books));
public_users.get('/_catalog/books/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  return res.json(books[req.params.isbn]);
});
public_users.get('/_catalog/author/:author', (req, res) => {
  const matches = Object.fromEntries(Object.entries(books).filter(([, book]) =>
    book.author.toLowerCase() === req.params.author.toLowerCase()));
  return res.json(matches);
});
public_users.get('/_catalog/title/:title', (req, res) => {
  const matches = Object.fromEntries(Object.entries(books).filter(([, book]) =>
    book.title.toLowerCase() === req.params.title.toLowerCase()));
  return res.json(matches);
});

// Use the actual listening port, never the untrusted Host request header.
const catalogUrl = req => `http://127.0.0.1:${req.socket.localPort}/_catalog`;
const options = { timeout: 5000, proxy: false };
const sendAxiosError = (res, error) => res.status(error.response?.status === 404 ? 404 : 502)
  .json({ message: error.response?.status === 404 ? 'Book not found.' : 'Catalog service unavailable.' });

// Task 10: Retrieve all books using an async callback and await with Axios.
public_users.get('/', async (req, res) => {
  try {
    const response = await axios.get(`${catalogUrl(req)}/books`, options);
    return res.json(response.data);
  } catch (error) { return sendAxiosError(res, error); }
});

// Task 11: Retrieve a book by ISBN using Axios Promise callbacks.
public_users.get('/isbn/:isbn', (req, res) => {
  return axios.get(`${catalogUrl(req)}/books/${encodeURIComponent(req.params.isbn)}`, options)
    .then(response => res.json(response.data))
    .catch(error => sendAxiosError(res, error));
});

// Task 12: Retrieve every matching book by author using async/await with Axios.
public_users.get('/author/:author', async (req, res) => {
  try {
    const response = await axios.get(`${catalogUrl(req)}/author/${encodeURIComponent(req.params.author)}`, options);
    return res.json(response.data);
  } catch (error) { return sendAxiosError(res, error); }
});

// Task 13: Retrieve matching titles using Axios Promise callbacks.
public_users.get('/title/:title', (req, res) => {
  return axios.get(`${catalogUrl(req)}/title/${encodeURIComponent(req.params.title)}`, options)
    .then(response => res.json(response.data))
    .catch(error => sendAxiosError(res, error));
});

public_users.get('/review/:isbn', (req, res) => {
  if (!Object.hasOwn(books, req.params.isbn)) return res.status(404).json({ message: 'Book not found.' });
  const reviews = books[req.params.isbn].reviews;
  return res.json(Object.keys(reviews).length ? { reviews } : { message: 'No reviews found for this book.', reviews });
});
module.exports.general = public_users;
