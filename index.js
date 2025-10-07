require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Webhook endpoint
app.post('/newMqlLeadCreated', async (req, res) => {
  try {
    console.log('Received webhook request:');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // For now, use hardcoded lead ID as specified
    const leadId = '00Q8a00001w4YCLEA2';

    // TODO: Extract leadId from req.body once we know the structure
    // const leadId = req.body.leadId || req.body.id || '00Q8a00001w4YCLEA2';

    // Trigger the Integrail AI agent
    const agentUrl = 'https://objectfirst.everworker.ai/api/v1/agents/execute';

    const agentResponse = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTEGRAIL_AUTH_TOKEN}`
      },
      body: JSON.stringify({
        agentId: process.env.INTEGRAIL_AGENT_ID,
        inputParams: {
          leadId: leadId
        }
      })
    });

    if (agentResponse.status === 200) {
      console.log('Successfully triggered AI agent for lead:', leadId);
      const responseData = await agentResponse.json();
      console.log('Agent response:', responseData);

      return res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        leadId: leadId
      });
    } else {
      console.error('Agent execution failed with status:', agentResponse.status);
      const errorText = await agentResponse.text();
      console.error('Error response:', errorText);

      return res.status(500).json({
        success: false,
        message: 'Failed to trigger AI agent',
        error: errorText
      });
    }

  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Middleware server running on port ${PORT}`);
  console.log(`Webhook endpoint: POST http://localhost:${PORT}/newMqlLeadCreated`);
});
