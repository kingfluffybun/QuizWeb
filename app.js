const express = require('express');
const app = express();

// Set EJS as the template engine
app.set('view engine', 'ejs');

// Serve static assets from the "public" folder
app.use(express.static('public')); 

app.get('/', (req, res) => {
    res.render('index');
});

app.listen(3000, () => console.log('Server running on port 3000'));