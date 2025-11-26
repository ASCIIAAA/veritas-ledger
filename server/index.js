const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const OpenAI = require('openai'); // or google-generative-ai
const cors = require('cors');

const app = express();
app.use(cors());
const upload = multer(); // Handles file uploads

// 1. Setup OpenAI (The Virtual Lawyer)
const openai = new OpenAI({ apiKey: 'YOUR_API_KEY' });

app.post('/analyze', upload.single('pdf'), async (req, res) => {
    try {
        // 2. Parse PDF (The Reader)
        const dataBuffer = req.file.buffer;
        const pdfData = await pdf(dataBuffer);
        const pdfText = pdfData.text;

        // 3. Ask AI (The Analysis)
        const completion = await openai.chat.completions.create({
            messages: [{ 
                role: "system", 
                content: "Analyze this contract. Return a JSON object with: docHash (sha256 of text), score (0-100), and risks (array of strings)." 
            }, {
                role: "user",
                content: pdfText
            }],
            model: "gpt-4-turbo",
            response_format: { type: "json_object" }
        });

        // 4. Send back to React
        res.json(JSON.parse(completion.choices[0].message.content));

    } catch (error) {
        console.error(error);
        res.status(500).send("Error analyzing document");
    }
});

app.listen(3001, () => console.log('Server running on 3001'));