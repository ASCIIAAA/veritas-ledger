const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const cors = require('cors');
const { spawn } = require('child_process'); // Import spawn
const path = require('path');

const app = express();
app.use(cors());
const upload = multer();

app.post('/analyze', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");

        // 1. Parse PDF to Text
        const dataBuffer = req.file.buffer;
        const pdfData = await pdf(dataBuffer);
        const pdfText = pdfData.text;
        const crypto = require('crypto');

        console.log("--- DEBUG: EXTRACTED TEXT ---");
        console.log(pdfText.substring(0, 500)); // Print first 500 chars
        console.log("-----------------------------");

        // 2. Call Python Script for NLP
        // We pass the pdfText as a command line argument
        const pythonProcess = spawn('python', [
            path.join(__dirname, 'ml_engine', 'analyzer.py'), 
            pdfText
        ]);

        let resultData = '';
        let errorData = '';

        // Collect data from Python script
        pythonProcess.stdout.on('data', (data) => {
            resultData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error("Python Error:", errorData);
                return res.status(500).json({ error: "Analysis failed" });
            }

            try {
                const analysisResult = JSON.parse(resultData);
                
                // --- NEW: Calculate Real SHA-256 Hash ---
                const hashSum = crypto.createHash('sha256');
                hashSum.update(req.file.buffer); 
                const docHash = "0x" + hashSum.digest('hex');
                // ----------------------------------------

                res.json({
                    docHash: docHash,           // The real hash for Blockchain
                    score: analysisResult.score,
                    type: analysisResult.type,   // The document type from Python
                    risks: analysisResult.risks,
                    entities: analysisResult.entities
                });

            } catch (e) {
                console.error("JSON Parse Error:", e);
                res.status(500).send("Error parsing analysis results");
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Error analyzing document");
    }
});

app.listen(3001, () => console.log('Server running on 3001'));