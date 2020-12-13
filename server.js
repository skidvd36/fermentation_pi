const express = require('express');
const mysql = require('mysql');
var pythonShell = require('python-shell');
const app = express();
const port = process.env.PORT || 5000;

let connection;
let shell;

var db_config = {
    host:       '127.0.0.1',
    user:       'TempWriter',
    password:   'TempWriter123',
    database:   'Fermentation'
};

app.use(express.json());       // support JSON-encoded bodies
app.use(express.urlencoded()); // support URL-encoded bodies

function handleDisconnect() {
    // Create connection
    connection = mysql.createConnection(db_config);
    
    // Attempt connection until successful
    connection.connect(function(err) {
        if(err) {
            console.log('Error connecting to database:', err);
            setTimeout(handleDisconnect, 2000);
        }
    });
    
    // Handle connection error and reconnect
    connection.on('error', function(err) {
        console.log('db error', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

app.get('/api/hello', (req, res) => {
  res.send({ express: 'Hello From Express' });
});

app.get('/api/config', (req, res) => {
  connection.query('SELECT * FROM Settings', function(err, results) {
      if (err) throw err;
      res.send(results);
  });
})

app.get('/api/graphdata', (req, res) => {
    connection.query('SELECT CONVERT(DATE_FORMAT(time_sample,\'%Y-%m-%d-%H:%i:00\'),DATETIME) as time_sample, temp_chamber, temp_carboy, temp_room, temp_set, temp_set_control, temp_hysteresis, compressor_on FROM Temperatures ORDER BY time_sample DESC LIMIT 100', function(err, results) {
        if (err) throw err;
        res.send(results);
    });
    console.log("Got to graphdata");
})

app.post('/api/settings', (req, res) => {
    const body = req.body;
    for (item in body)
    {
        connection.query('UPDATE Settings SET value = ' + parseFloat(body[item]) + ' WHERE name=\'' + item + '\'', function(err) {
        if (err) throw err;
        });
    }
    res.send("Yolo");
})


app.listen(port, () => console.log(`Listening on port ${port}`));

// Respond to a POST request for the homepage
app.post('/api/onoff', function (req, res) {
    const onoff = req.body.onoff;
    
    if (onoff == 1)
    {
        console.log("Spawn");
        shell = new pythonShell.PythonShell("main.py", { pythonPath: "/usr/bin/python", scriptPath: "/home/pi/source/python/" } );
    }
    else if (onoff == 0)
    {
        console.log("Kill");
        shell.childProcess.kill('SIGINT');
    }
    
    res.send("Hello POST");
})


console.log("START");
handleDisconnect();

connection.query('SELECT * FROM Settings WHERE name="Script_running"', function(err, results) {
    if (err) throw err;
    script_on = parseInt(results[0].value);
    
    if (script_on)
    {
        console.log("Kill");
        console.log("Spawn");
        shell = new pythonShell.PythonShell("main.py", { pythonPath: "/usr/bin/python", scriptPath: "/home/pi/source/brewpi2/python/" } );
    }
})
