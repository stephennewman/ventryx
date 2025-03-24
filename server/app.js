const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Your other routes here...

const PORT = process.env.PORT || 5176;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; 