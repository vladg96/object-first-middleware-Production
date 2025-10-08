require('dotenv').config();
const express = require('express');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Middleware to parse XML/text for SOAP requests
app.use('/newMqlLeadCreated', express.text({ type: ['text/xml', 'application/xml'] }));

// Webhook endpoint for Salesforce Outbound Messages (SOAP)
app.post('/newMqlLeadCreated', async (req, res) => {
  try {
    console.log('Received webhook request:');
    console.log('Headers:', req.headers);
    console.log('Raw Body:', req.body);

    const xml = req.body || '';

    // Parse SOAP XML
    const parsed = await xml2js.parseStringPromise(xml, {
      explicitArray: false,
      trim: true
    });

    console.log('Parsed SOAP:', JSON.stringify(parsed, null, 2));

    // Extract Lead ID from Salesforce Outbound Message structure
    // Typical path: Envelope > Body > notifications > Notification > sObject > Id
    const notification = parsed?.['soapenv:Envelope']?.['soapenv:Body']?.notifications?.Notification ||
                        parsed?.Envelope?.Body?.notifications?.Notification;

    const sObject = Array.isArray(notification) ? notification[0]?.sObject : notification?.sObject;
    const leadId = sObject?.Id || sObject?.LeadId || '00Q8a00001w4YCLEA2';

    console.log('Extracted Lead ID:', leadId);
    console.log('Full sObject data:', JSON.stringify(sObject, null, 2));

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

    console.log('Agent response status:', agentResponse.status);

    // Prepare SOAP acknowledgment response
    let ackValue = 'true';

    if (agentResponse.status === 200) {
      console.log('Successfully triggered AI agent for lead:', leadId);
      const responseData = await agentResponse.json();
      console.log('Agent response:', responseData);
    } else {
      console.error('Agent execution failed with status:', agentResponse.status);
      const errorText = await agentResponse.text();
      console.error('Error response:', errorText);
      ackValue = 'false'; // Tell Salesforce to retry
    }

    // Return SOAP acknowledgment to Salesforce
    const soapResponse =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
      `<soapenv:Body>` +
      `<notificationsResponse xmlns="http://soap.sforce.com/2005/09/outbound">` +
      `<Ack>${ackValue}</Ack>` +
      `</notificationsResponse>` +
      `</soapenv:Body>` +
      `</soapenv:Envelope>`;

    res.set('Content-Type', 'text/xml');
    return res.status(200).send(soapResponse);

  } catch (error) {
    console.error('Error processing webhook:', error);

    // Return SOAP NACK so Salesforce will retry
    const soapErrorResponse =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
      `<soapenv:Body>` +
      `<notificationsResponse xmlns="http://soap.sforce.com/2005/09/outbound">` +
      `<Ack>false</Ack>` +
      `</notificationsResponse>` +
      `</soapenv:Body>` +
      `</soapenv:Envelope>`;

    res.set('Content-Type', 'text/xml');
    return res.status(200).send(soapErrorResponse);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Middleware server running on port ${PORT}`);
  console.log(`Webhook endpoint: POST http://localhost:${PORT}/newMqlLeadCreated`);
  console.log(`Ready to receive Salesforce SOAP Outbound Messages`);
});
