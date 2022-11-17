'use strict'

const fs = require('fs');
const express = require('express');
const app = express();
app.use(express.json());
//app.use(express.urlencoded({ extended: true }));
app.use(function(req, res, next) {
  // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Origin", "*"); // YOUR-DOMAIN.TLD
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const config = require('./config.json');

function createDb(path, filename) {
  if (!fs.existsSync(path)) {
    // Create dir
    fs.mkdirSync(path, { recursive: true });
  }
  let reset = false;
  const dbPath = path + filename;
  if (!fs.existsSync(dbPath)) {
    reset = true;
  }
  const adapter = new FileSync(dbPath);
  const db = low(adapter);
  if (reset) {
    // Set some defaults
    db.defaults({ data: [] })  
      .write();
  }
  return db;
}

function error(status, msg) {
  const err = new Error(msg);
  err.status = status;
  return err;
}

function removeTags (string) {
  return string ? string.replace(/<(?:.|\n)*?>/gm, '').trim() : '';
}

app.get('/:domain/logins', function(req, res, next) {
  const domain = req.params.domain;
  const db = createDb('./data/' + domain + '/', 'db.json');
  const data = db.get('data')
                 .value();
  if (data) res.send(data);
  else next();
});

app.post('/:domain', (req, res) => {
  const domain = req.params.domain;
  const db = createDb('./data/' + domain + '/', 'db.json');
  db.get('data')
    .push(req.body)
    .write();
  res.json({ message: 'Post Successful'});
});

// middleware with an arity of 4 are considered
// error handling middleware. When you next(err)
// it will be passed through the defined middleware
// in order, but ONLY those with an arity of 4, ignoring
// regular middleware.
app.use(function(err, req, res, next){
  // whatever you want here, feel free to populate
  // properties on `err` to treat it differently in here.
  res.status(err.status || 500);
  res.send({ error: err.message });
});

// our custom JSON 404 middleware. Since it's placed last
// it will be the last middleware called, if all others
// invoke next() and do not respond.
app.use(function(req, res){
  res.status(404);
  res.send({ error: "Sorry, can't find that" })
});

app.listen(config.port);
console.log(`listening on *:${config.port}`);
