import app from './functions/server/server.mjs';

const port = process.env.PORT || 5176;
app.listen(port, () => {
  console.log(`✅ Listening locally on http://localhost:${port}`);
}); 