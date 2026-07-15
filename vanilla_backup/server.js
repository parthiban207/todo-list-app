const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all requests
app.use(cors());

// Parse incoming JSON requests
app.use(express.json());

// GET /health - Simple server running status checkpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: "Server Running"
  });
});

// POST /api/chat - Mock chatbot endpoint (Gemini to be integrated later)
app.post('/api/chat', (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      error: "Message is required in request body"
    });
  }

  // Construct a simulated reply placeholder
  const mockReply = `Received your message: "${message}". The Gemini API integration will be implemented in this handler later.`;

  res.status(200).json({
    reply: mockReply
  });
});

// Start listening for connections
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});
