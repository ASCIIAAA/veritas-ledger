const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const cors = require('cors');
const { spawn } = require('child_process'); 
const path = require('path');
const crypto = require('crypto'); 

const app = express();
app.use(cors());
const upload = multer();

app.post('/analyze', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");

        console.log("--- Processing File: " + req.file.originalname + " ---");
        const dataBuffer = req.file.buffer;
       
        const pdfResult = await pdf(dataBuffer);
        const pdfText = pdfResult.text; 

        console.log("--- DEBUG: EXTRACTED TEXT LENGTH: " + pdfText.length + " ---");

        const pythonProcess = spawn('python', [
            path.join(__dirname, 'ml_engine', 'analyzer.py')
        ]);

        let resultData = '';
        let errorData = '';

        // Write text to Python's stdin
        try {
            pythonProcess.stdin.write(pdfText);
            pythonProcess.stdin.end();
        } catch (stdinErr) {
            console.error("Stdin Error:", stdinErr);
            return res.status(500).json({ error: "Failed to send data to analyzer" });
        }

        pythonProcess.stdout.on('data', (data) => {
            resultData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
            console.error("Python Stderr:", data.toString()); 
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error("Python Process Exited with code:", code);
                // Return error if no result data was captured
                if (!resultData) {
                     return res.status(500).json({ error: "Analysis failed", details: errorData });
                }
            }

            try {
                // Find JSON in the output (clean up any potential prints)
                const jsonStart = resultData.indexOf('{');
                const jsonEnd = resultData.lastIndexOf('}');
                
                if (jsonStart === -1 || jsonEnd === -1) {
                    throw new Error("No JSON found in Python output");
                }

                const cleanResult = resultData.substring(jsonStart, jsonEnd + 1);
                const analysisResult = JSON.parse(cleanResult);
                
                // Calculate Hash
                const hashSum = crypto.createHash('sha256');
                hashSum.update(req.file.buffer); 
                const docHash = "0x" + hashSum.digest('hex');

                res.json({
                    docHash: docHash,           
                    score: analysisResult.score,
                    type: analysisResult.type,   
                    risks: analysisResult.risks,
                    entities: analysisResult.entities,
                    summary: analysisResult.summary, 
                     missing_clauses: analysisResult.missing_clauses
                });

            } catch (e) {
                console.error("JSON Parse Error:", e);
                console.error("Raw Output:", resultData);
                res.status(500).send("Error parsing analysis results");
            }
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).send("Error analyzing document");
    }
});

app.listen(3001, () => console.log('Server running on 3001'));