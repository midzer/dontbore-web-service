'use strict'

const fs = require('fs');
const express = require('express');
const app = express();
app.use(express.json());
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

const mainDb = createDb('./data/', 'db.json');
let allData;
updateData();

function updateData() {
  allData = mainDb.get('data')
                  .sortBy('name')
                  .value();
}

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

function removeTags (string) {
  return string ? string.replace(/<(?:.|\n)*?>/gm, '').trim() : '';
}

function isValidDomain (string) {
  return /^([a-z0-9]{1,63}(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(string);
}

app.options('*', function (req,res) { res.sendStatus(200); });

app.get('/', function(req, res, next) {
  if (allData) res.send(allData);
  else next();
});

app.route('/:domain')
  .get((req, res, next) => {
    const domain = req.params.domain;
    const db = createDb('./data/' + domain + '/', 'db.json');
    const data = db.get('data')
                   .sortBy(['vote', 'date'])
                   .reverse()
                   .value();
    if (data) res.send(data);
    else next();
  })
  .post((req, res, next) => {
    const domain = req.params.domain;
    if (isValidDomain(domain)) {
      try {
        new URL('https://' + domain)
      }
      catch (err) {
        return next(err);
      }
    }
    const db = createDb('./data/' + domain + '/', 'db.json');
    const date = new Date().toISOString();
    db.get('data')
      .push({
        date: date,
        user: removeTags(req.body.user),
        pass: removeTags(req.body.pass),
        vote: 1
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
              name: removeTags(domain)
            })
            .write();
    }
    updateData();

    res.json({ message: 'OK'});
  })
  .put((req, res, next) => {
    const domain = req.params.domain;
    if (isValidDomain(domain)) {
      try {
        new URL('https://' + domain)
      }
      catch (err) {
        return next(err);
      }
    }
    const db = createDb('./data/' + domain + '/', 'db.json');
    db.get('data')
      .find({ date: req.body.date })
      .assign({ vote: req.body.vote })
      .write();
  
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
