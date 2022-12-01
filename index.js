'use strict'

const fs = require('fs');
const express = require('express');
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Origin", "*"); // YOUR-DOMAIN.TLD
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const config = require('./config.json');

const mainDb = createDb();
let allData;
updateData();

function updateData() {
  allData = mainDb.get('data')
                  .sortBy('name')
                  .value();
}

function getDb(directory) {
  const path = './data/' + directory + '/';
  if (fs.existsSync(path)) {
    const adapter = new FileSync(path + 'db.json');
    return low(adapter);
  }

  return null;
}

function createDb(directory = '') {
  const path = './data/' + directory + '/';
  let reset = false;
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
    reset = true;
  }
  const db = getDb(directory);
  if (reset) {
    db.defaults({ data: [] })
      .write();
  }

  return db;
}

function removeTags (string) {
  return string ? string.replace(/<(?:.|\n)*?>/gm, '').trim() : '';
}

app.get('/', function(req, res, next) {
  if (allData) res.send(allData);
  else next();
});

app.route('/:domain')
  .get((req, res, next) => {
    const domain = removeTags(req.params.domain);
    const db = getDb(domain);
    let data = [];
    if (db) {
      data = db.get('data')
               .sortBy(['up', 'date'])
               .reverse()
               .value();
    }
    res.send(data);
  })
  .post((req, res, next) => {
    const domain = removeTags(req.params.domain);
    try {
      new URL('http://' + domain)
    }
    catch (err) {
      return next(err);
    }
    if (!(req.body.user && req.body.pass)) {
      return next();
    }
    const db = createDb(domain);
    const date = new Date().toISOString();
    db.get('data')
      .push({
        date: date,
        user: removeTags(req.body.user),
        pass: removeTags(req.body.pass),
        up: 1,
        down: 0
      })
      .write();
    
    const exists = mainDb.get('data')
                         .find({ name: domain })
                         .value();
  
    if (exists) {
      mainDb.get('data')
            .find({ name: domain })
            .assign({ date: date })
            .write();
    }
    else {
      mainDb.get('data')
            .push({
              date: date,
              name: domain
            })
            .write();
    }
    updateData();

    res.json({ message: 'OK'});
  })
  .put((req, res, next) => {
    const domain = removeTags(req.params.domain);
    try {
      new URL('http://' + domain)
    }
    catch (err) {
      return next(err);
    }
    const date = req.body.date;
    const vote = req.body.vote;
    if (!(date && vote)) {
      return next();
    }
    const db = createDb(domain);
    const login = db.get('data')
                    .find({ date: date })
                    .value();
    if (vote === 1) {
      db.get('data')
        .find({ date: date })
        .assign({ up: login.up + 1 })
        .write();
    }
    else if (vote === -1) {
      db.get('data')
        .find({ date: date })
        .assign({ down: login.down + 1 })
        .write();
    }

    res.json({ message: 'OK'});
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
